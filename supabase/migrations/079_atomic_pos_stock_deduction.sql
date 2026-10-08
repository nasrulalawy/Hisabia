-- 079_atomic_pos_stock_deduction.sql
-- Memperbaiki bug pengurangan stok pada transaksi POS dan Katalog:
-- 1. Menyediakan RPC deduct_outlet_product_stock_batch agar pengurangan stok terjadi secara atomik di database
--    (mencegah race condition, mengatasi bug duplicate item di cart, dan menghindari stale state React).
-- 2. Memperbaiki izin di set_outlet_product_stock agar mengenali active employees (public.user_org_ids()).
-- 3. Memperbaiki finalize_order agar pesanan katalog memotong outlet_product_stock sesuai outlet pemroses.

-- 1) RPC Pengurangan Stok Atomik (Batch)
CREATE OR REPLACE FUNCTION public.deduct_outlet_product_stock_batch(
  p_org_id uuid,
  p_outlet_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_product_id uuid;
  v_qty numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF NOT (p_org_id IN (SELECT public.user_org_ids())) THEN
    RETURN jsonb_build_object('error', 'Tidak punya akses');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'count', 0);
  END IF;

  -- Agregasikan quantity per product_id untuk menghindari multi-row overwrite
  FOR v_item IN
    SELECT
      (elem->>'product_id')::uuid AS product_id,
      SUM(GREATEST(0, (elem->>'quantity')::numeric)) AS total_qty
    FROM jsonb_array_elements(p_items) AS elem
    WHERE elem->>'product_id' IS NOT NULL
    GROUP BY (elem->>'product_id')::uuid
  LOOP
    v_product_id := v_item.product_id;
    v_qty := v_item.total_qty;

    IF v_qty > 0 THEN
      IF p_outlet_id IS NOT NULL THEN
        -- Pastikan baris outlet_product_stock sudah ada
        INSERT INTO public.outlet_product_stock (organization_id, outlet_id, product_id, stock, updated_at)
        VALUES (p_org_id, p_outlet_id, v_product_id, 0, now())
        ON CONFLICT (outlet_id, product_id) DO NOTHING;

        -- Kurangi stok outlet secara atomik
        UPDATE public.outlet_product_stock
        SET stock = GREATEST(0, stock - v_qty),
            updated_at = now()
        WHERE outlet_id = p_outlet_id AND product_id = v_product_id;

        -- Sinkronkan total ke products.stock
        UPDATE public.products p
        SET stock = COALESCE((
          SELECT SUM(ops.stock) FROM public.outlet_product_stock ops WHERE ops.product_id = p.id
        ), 0),
        updated_at = now()
        WHERE p.id = v_product_id;
      ELSE
        -- Fallback jika outlet tidak diset
        UPDATE public.products
        SET stock = GREATEST(0, COALESCE(stock, 0) - v_qty),
            updated_at = now()
        WHERE id = v_product_id;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.deduct_outlet_product_stock_batch IS
  'Mengurangi stok produk di outlet secara atomik per daftar item yang terjual.';

GRANT EXECUTE ON FUNCTION public.deduct_outlet_product_stock_batch(uuid, uuid, jsonb) TO authenticated;

-- 2) Update set_outlet_product_stock dengan pengecekan user_org_ids()
CREATE OR REPLACE FUNCTION public.set_outlet_product_stock(
  p_org_id uuid,
  p_outlet_id uuid,
  p_product_id uuid,
  p_stock numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT (p_org_id IN (SELECT public.user_org_ids())) THEN
    RAISE EXCEPTION 'Tidak punya akses';
  END IF;

  v_stock := GREATEST(0, COALESCE(p_stock, 0));

  INSERT INTO public.outlet_product_stock (organization_id, outlet_id, product_id, stock, updated_at)
  VALUES (p_org_id, p_outlet_id, p_product_id, v_stock, now())
  ON CONFLICT (outlet_id, product_id) DO UPDATE
  SET stock = v_stock, updated_at = now();

  -- Mirror ke products.stock = jumlah semua outlet (kompatibilitas lama)
  UPDATE public.products p
  SET stock = COALESCE((
    SELECT SUM(ops.stock) FROM public.outlet_product_stock ops WHERE ops.product_id = p.id
  ), 0),
  updated_at = now()
  WHERE p.id = p_product_id;

  RETURN v_stock;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_outlet_product_stock(uuid, uuid, uuid, numeric) TO authenticated;

-- 3) Perbaiki finalize_order agar memotong outlet_product_stock
CREATE OR REPLACE FUNCTION public.finalize_order(p_order_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_order_id uuid;
  v_outlet_id uuid;
  v_total numeric;
  v_item record;
  v_conv numeric;
  v_qty_base numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT id, organization_id, outlet_id, total, status INTO v_order_id, v_org_id, v_outlet_id, v_total
  FROM public.orders
  WHERE order_token = trim(p_order_token) LIMIT 1;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Pesanan tidak ditemukan');
  END IF;

  IF NOT (v_org_id IN (SELECT public.user_org_ids())) THEN
    RETURN jsonb_build_object('error', 'Tidak punya akses untuk memproses pesanan ini');
  END IF;

  IF (SELECT status FROM public.orders WHERE id = v_order_id) = 'paid' THEN
    RETURN jsonb_build_object('error', 'Pesanan sudah diproses');
  END IF;

  -- Potong stok & catat stock_movements
  FOR v_item IN
    SELECT oi.product_id, oi.unit_id, oi.quantity, p.name
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order_id AND oi.product_id IS NOT NULL
  LOOP
    SELECT conversion_to_base INTO v_conv FROM public.product_units
    WHERE product_id = v_item.product_id AND (unit_id = v_item.unit_id OR (v_item.unit_id IS NULL AND is_base))
    LIMIT 1;
    v_conv := COALESCE(v_conv, 1);
    v_qty_base := v_item.quantity * v_conv;

    IF v_outlet_id IS NOT NULL THEN
      INSERT INTO public.outlet_product_stock (organization_id, outlet_id, product_id, stock, updated_at)
      VALUES (v_org_id, v_outlet_id, v_item.product_id, 0, now())
      ON CONFLICT (outlet_id, product_id) DO NOTHING;

      UPDATE public.outlet_product_stock
      SET stock = GREATEST(0, stock - v_qty_base),
          updated_at = now()
      WHERE outlet_id = v_outlet_id AND product_id = v_item.product_id;

      UPDATE public.products p
      SET stock = COALESCE((
        SELECT SUM(ops.stock) FROM public.outlet_product_stock ops WHERE ops.product_id = p.id
      ), 0),
      updated_at = now()
      WHERE p.id = v_item.product_id;
    ELSE
      UPDATE public.products
      SET stock = GREATEST(0, (stock)::numeric - v_qty_base), updated_at = now()
      WHERE id = v_item.product_id;
    END IF;

    INSERT INTO public.stock_movements (organization_id, warehouse_id, outlet_id, product_id, type, quantity, notes)
    VALUES (v_org_id, NULL, v_outlet_id, v_item.product_id, 'out', v_qty_base,
      'Pesanan katalog #' || substr(v_order_id::text, 1, 8));
  END LOOP;

  -- Update status order
  UPDATE public.orders SET status = 'paid', updated_at = now() WHERE id = v_order_id;

  -- Catat arus kas masuk
  INSERT INTO public.cash_flows (organization_id, outlet_id, type, amount, description, reference_type, reference_id)
  VALUES (v_org_id, v_outlet_id, 'in', v_total, 'Pesanan katalog #' || substr(v_order_id::text, 1, 8), 'order', v_order_id);

  RETURN jsonb_build_object('success', true, 'orderId', v_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_order(text) TO authenticated;

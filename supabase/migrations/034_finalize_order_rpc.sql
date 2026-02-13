-- finalize_order: toko proses pesanan → potong stok, update status paid, catat arus kas
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

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org_id AND user_id = v_user_id
  ) THEN
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

    UPDATE public.products
    SET stock = GREATEST(0, (stock)::numeric - v_item.quantity * v_conv), updated_at = now()
    WHERE id = v_item.product_id;

    INSERT INTO public.stock_movements (organization_id, warehouse_id, product_id, type, quantity, notes)
    VALUES (v_org_id, NULL, v_item.product_id, 'out', v_item.quantity * v_conv,
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

-- get_order_by_token: tambah organization_id agar frontend bisa cek apakah user adalah member toko
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_items jsonb;
  v_customer_name text;
  v_org_name text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token required');
  END IF;

  SELECT id, customer_id, organization_id, status, subtotal, discount, total, notes, created_at, order_token
  INTO v_order
  FROM public.orders
  WHERE order_token = trim(p_token) OR id::text = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pesanan tidak ditemukan');
  END IF;

  SELECT jsonb_agg(jsonb_build_object('name', name, 'price', price, 'quantity', quantity) ORDER BY created_at)
  INTO v_items FROM public.order_items WHERE order_id = v_order.id;

  SELECT name INTO v_customer_name FROM public.customers WHERE id = v_order.customer_id;
  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_order.organization_id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'organization_id', v_order.organization_id,
    'order_token', v_order.order_token,
    'status', v_order.status,
    'subtotal', v_order.subtotal,
    'discount', COALESCE(v_order.discount, 0),
    'total', v_order.total,
    'notes', v_order.notes,
    'created_at', v_order.created_at,
    'customer_name', v_customer_name,
    'organization_name', v_org_name,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

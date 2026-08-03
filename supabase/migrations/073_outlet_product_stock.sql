-- Stok produk per outlet (katalog tetap bersama organisasi)
-- Cabang tidak lagi memakai stok outlet pusat.

CREATE TABLE IF NOT EXISTS public.outlet_product_stock (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock decimal(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (outlet_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_outlet_product_stock_org ON public.outlet_product_stock(organization_id);
CREATE INDEX IF NOT EXISTS idx_outlet_product_stock_product ON public.outlet_product_stock(product_id);

COMMENT ON TABLE public.outlet_product_stock IS 'Qty stok produk per outlet. Katalog produk tetap di products (org-wide).';

ALTER TABLE public.outlet_product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outlet_product_stock_select" ON public.outlet_product_stock
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "outlet_product_stock_insert" ON public.outlet_product_stock
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "outlet_product_stock_update" ON public.outlet_product_stock
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "outlet_product_stock_delete" ON public.outlet_product_stock
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlet_product_stock TO authenticated;

-- Outlet pada mutasi & opname
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_outlet ON public.stock_movements(outlet_id);

ALTER TABLE public.stock_opname_sessions
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

-- Backfill: stok existing masuk ke outlet default (pusat) per org
INSERT INTO public.outlet_product_stock (organization_id, outlet_id, product_id, stock, updated_at)
SELECT p.organization_id, o.id, p.id, COALESCE(p.stock, 0), now()
FROM public.products p
JOIN public.outlets o ON o.organization_id = p.organization_id AND o.is_default = true
ON CONFLICT (outlet_id, product_id) DO NOTHING;

-- Jika org tanpa is_default, pakai outlet tertua
INSERT INTO public.outlet_product_stock (organization_id, outlet_id, product_id, stock, updated_at)
SELECT p.organization_id, o.id, p.id, COALESCE(p.stock, 0), now()
FROM public.products p
JOIN LATERAL (
  SELECT id FROM public.outlets
  WHERE organization_id = p.organization_id
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1
) o ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.outlet_product_stock ops
  WHERE ops.product_id = p.id
)
ON CONFLICT (outlet_id, product_id) DO NOTHING;

-- Set absolute stock for outlet (upsert)
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
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
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

-- delete_order: kembalikan stok ke outlet order
CREATE OR REPLACE FUNCTION public.delete_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_outlet_id uuid;
  v_user_id uuid;
  v_item record;
  v_conv numeric;
  v_qty_base numeric;
  v_current numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT organization_id, outlet_id INTO v_org_id, v_outlet_id
  FROM public.orders WHERE id = p_order_id;
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Order tidak ditemukan');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Tidak punya akses');
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.unit_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    v_conv := 1;
    IF v_item.unit_id IS NOT NULL THEN
      SELECT conversion_to_base INTO v_conv FROM public.product_units
      WHERE product_id = v_item.product_id AND unit_id = v_item.unit_id LIMIT 1;
      v_conv := COALESCE(v_conv, 1);
    END IF;
    v_qty_base := v_item.quantity * v_conv;

    IF v_outlet_id IS NOT NULL THEN
      SELECT COALESCE(stock, 0) INTO v_current
      FROM public.outlet_product_stock
      WHERE outlet_id = v_outlet_id AND product_id = v_item.product_id;
      v_current := COALESCE(v_current, 0) + v_qty_base;
      PERFORM public.set_outlet_product_stock(v_org_id, v_outlet_id, v_item.product_id, v_current);
    ELSE
      UPDATE public.products
      SET stock = COALESCE(stock, 0) + v_qty_base, updated_at = now()
      WHERE id = v_item.product_id;
    END IF;

    INSERT INTO public.stock_movements (organization_id, warehouse_id, outlet_id, product_id, type, quantity, notes)
    VALUES (v_org_id, NULL, v_outlet_id, v_item.product_id, 'in', v_qty_base,
      'Pembatalan order #' || substr(p_order_id::text, 1, 8));
  END LOOP;

  DELETE FROM public.cash_flows
  WHERE reference_type = 'order' AND reference_id = p_order_id;

  DELETE FROM public.receivables WHERE order_id = p_order_id;

  DELETE FROM public.orders WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- finalize_stock_opname: adjust stok per outlet sesi
CREATE OR REPLACE FUNCTION public.finalize_stock_opname(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_warehouse_id uuid;
  v_outlet_id uuid;
  v_status text;
  v_line record;
  v_current numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT organization_id, warehouse_id, outlet_id, status
  INTO v_org_id, v_warehouse_id, v_outlet_id, v_status
  FROM public.stock_opname_sessions
  WHERE id = p_session_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Sesi opname tidak ditemukan');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Tidak punya akses untuk organisasi ini');
  END IF;

  IF v_status = 'finalized' THEN
    RETURN jsonb_build_object('error', 'Opname ini sudah difinalisasi');
  END IF;

  -- Fallback outlet: dari warehouse, atau default org
  IF v_outlet_id IS NULL AND v_warehouse_id IS NOT NULL THEN
    SELECT outlet_id INTO v_outlet_id FROM public.warehouses WHERE id = v_warehouse_id;
  END IF;
  IF v_outlet_id IS NULL THEN
    SELECT id INTO v_outlet_id FROM public.outlets
    WHERE organization_id = v_org_id
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1;
  END IF;

  FOR v_line IN
    SELECT ol.product_id, ol.adjustment_qty
    FROM public.stock_opname_lines ol
    WHERE ol.opname_session_id = p_session_id
      AND ol.adjustment_qty IS NOT NULL
      AND ol.adjustment_qty != 0
  LOOP
    IF v_outlet_id IS NOT NULL THEN
      SELECT COALESCE(stock, 0) INTO v_current
      FROM public.outlet_product_stock
      WHERE outlet_id = v_outlet_id AND product_id = v_line.product_id;
      v_current := GREATEST(0, COALESCE(v_current, 0) + v_line.adjustment_qty);
      PERFORM public.set_outlet_product_stock(v_org_id, v_outlet_id, v_line.product_id, v_current);
    ELSE
      UPDATE public.products
      SET stock = GREATEST(0, (stock)::numeric + v_line.adjustment_qty),
          updated_at = now()
      WHERE id = v_line.product_id;
    END IF;

    INSERT INTO public.stock_movements (organization_id, warehouse_id, outlet_id, product_id, type, quantity, notes)
    VALUES (
      v_org_id,
      v_warehouse_id,
      v_outlet_id,
      v_line.product_id,
      'adjust',
      v_line.adjustment_qty,
      'Stock opname #' || substr(p_session_id::text, 1, 8)
    );
  END LOOP;

  UPDATE public.stock_opname_sessions
  SET status = 'finalized',
      finalized_at = now(),
      updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('success', true, 'sessionId', p_session_id);
END;
$$;

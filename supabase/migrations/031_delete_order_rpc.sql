-- RPC: Hapus transaksi (order) beserta reversal stok dan cleanup
CREATE OR REPLACE FUNCTION public.delete_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_item record;
  v_conv numeric;
  v_qty_base numeric;
  v_order record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT organization_id INTO v_org_id FROM public.orders WHERE id = p_order_id;
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Order tidak ditemukan');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_org_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Tidak punya akses');
  END IF;

  -- 1. Kembalikan stok untuk setiap order_item yang punya product_id
  FOR v_item IN
    SELECT oi.product_id, oi.unit_id, oi.quantity, p.stock
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    v_conv := 1;
    IF v_item.unit_id IS NOT NULL THEN
      SELECT conversion_to_base INTO v_conv FROM public.product_units
      WHERE product_id = v_item.product_id AND unit_id = v_item.unit_id LIMIT 1;
      v_conv := COALESCE(v_conv, 1);
    END IF;
    v_qty_base := v_item.quantity * v_conv;
    UPDATE public.products
    SET stock = COALESCE(stock, 0) + v_qty_base, updated_at = now()
    WHERE id = v_item.product_id;
    INSERT INTO public.stock_movements (organization_id, warehouse_id, product_id, type, quantity, notes)
    VALUES (v_org_id, NULL, v_item.product_id, 'in', v_qty_base,
      'Pembatalan order #' || substr(p_order_id::text, 1, 8));
  END LOOP;

  -- 2. Hapus cash_flows yang terkait order
  DELETE FROM public.cash_flows
  WHERE reference_type = 'order' AND reference_id = p_order_id;

  -- 3. Hapus receivables yang terkait order
  DELETE FROM public.receivables WHERE order_id = p_order_id;

  -- 4. Hapus order (cascade ke order_items)
  DELETE FROM public.orders WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_order(uuid) TO authenticated;

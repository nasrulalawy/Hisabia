-- Finalize stock opname: apply adjustment ke stok. Hanya INSERT (stock_movements) dan UPDATE (products, session). Tidak ada DELETE.
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
  v_status text;
  v_line record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT organization_id, warehouse_id, status
  INTO v_org_id, v_warehouse_id, v_status
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

  FOR v_line IN
    SELECT ol.product_id, ol.adjustment_qty
    FROM public.stock_opname_lines ol
    WHERE ol.opname_session_id = p_session_id
      AND ol.adjustment_qty IS NOT NULL
      AND ol.adjustment_qty != 0
  LOOP
    UPDATE public.products
    SET stock = GREATEST(0, (stock)::numeric + v_line.adjustment_qty),
        updated_at = now()
    WHERE id = v_line.product_id;

    INSERT INTO public.stock_movements (organization_id, warehouse_id, product_id, type, quantity, notes)
    VALUES (
      v_org_id,
      v_warehouse_id,
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

GRANT EXECUTE ON FUNCTION public.finalize_stock_opname(uuid) TO authenticated;

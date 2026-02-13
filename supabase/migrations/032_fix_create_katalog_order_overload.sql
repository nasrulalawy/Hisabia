-- Fix ambiguous function overload: drop both signatures and recreate with explicit numeric
DROP FUNCTION IF EXISTS public.create_katalog_order(uuid, jsonb, text, numeric);
DROP FUNCTION IF EXISTS public.create_katalog_order(uuid, jsonb, text, double precision);

CREATE OR REPLACE FUNCTION public.create_katalog_order(
  p_org_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_discount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_customer_id uuid;
  v_outlet_id uuid;
  v_org record;
  v_order_id uuid;
  v_order_token text;
  v_item jsonb;
  v_product record;
  v_pu record;
  v_price numeric;
  v_qty int;
  v_unit_id uuid;
  v_conv numeric;
  v_sym text;
  v_subtotal numeric := 0;
  v_total numeric;
  v_discount numeric;
  v_order_detail_url text;
  v_product_prices jsonb;
  v_product_units jsonb;
  v_cust_price numeric;
  v_retail_price numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT id, catalog_public, phone INTO v_org FROM public.organizations WHERE id = p_org_id;
  IF v_org.id IS NULL OR NOT COALESCE(v_org.catalog_public, false) THEN
    RETURN jsonb_build_object('error', 'Katalog tidak tersedia');
  END IF;

  SELECT id INTO v_customer_id FROM public.customers
  WHERE organization_id = p_org_id AND user_id = v_user_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM public.customers
    WHERE organization_id = p_org_id AND email = (SELECT email FROM auth.users WHERE id = v_user_id) LIMIT 1;
  END IF;

  SELECT id INTO v_outlet_id FROM public.outlets
  WHERE organization_id = p_org_id AND is_default = true LIMIT 1;
  IF v_outlet_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Outlet tidak ditemukan');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Keranjang kosong');
  END IF;

  v_order_token := public.gen_order_token();
  v_discount := LEAST(GREATEST(COALESCE(p_discount, 0)::numeric, 0), 999999999);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND organization_id = p_org_id LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_qty := GREATEST(1, (v_item->>'quantity')::int);
    v_unit_id := (v_item->>'unit_id')::uuid;
    IF v_unit_id IS NULL THEN v_unit_id := v_product.default_unit_id; END IF;

    SELECT pu.conversion_to_base, u.symbol INTO v_conv, v_sym
    FROM public.product_units pu
    LEFT JOIN public.units u ON u.id = pu.unit_id
    WHERE pu.product_id = v_product.id AND (pu.unit_id = v_unit_id OR (v_unit_id IS NULL AND pu.is_base))
    LIMIT 1;
    v_conv := COALESCE(v_conv, 1);
    v_sym := COALESCE(v_sym, 'pcs');

    SELECT price INTO v_cust_price FROM public.product_prices
    WHERE product_id = v_product.id AND unit_id = v_unit_id AND customer_id = v_customer_id LIMIT 1;
    IF v_cust_price IS NOT NULL THEN v_price := v_cust_price;
    ELSIF (SELECT is_base FROM public.product_units WHERE product_id = v_product.id AND unit_id = v_unit_id LIMIT 1) THEN
      v_price := v_product.selling_price;
    ELSE
      v_price := v_product.selling_price * v_conv;
    END IF;

    IF (v_product.stock)::numeric < (v_qty * v_conv) THEN
      RETURN jsonb_build_object('error', 'Stok "' || v_product.name || '" tidak mencukupi. Tersedia: ' || v_product.stock || ' (dalam satuan dasar)');
    END IF;

    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  v_total := GREATEST(0, v_subtotal - v_discount);

  INSERT INTO public.orders (organization_id, outlet_id, created_by, customer_id, status, subtotal, tax, discount, total, payment_method, notes, order_token)
  VALUES (p_org_id, v_outlet_id, v_user_id, v_customer_id, 'pending', v_subtotal, 0, v_discount, v_total, NULL, NULLIF(trim(p_notes), ''), v_order_token)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND organization_id = p_org_id LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_qty := GREATEST(1, (v_item->>'quantity')::int);
    v_unit_id := (v_item->>'unit_id')::uuid;
    IF v_unit_id IS NULL THEN v_unit_id := v_product.default_unit_id; END IF;

    SELECT pu.conversion_to_base, u.symbol INTO v_conv, v_sym
    FROM public.product_units pu LEFT JOIN public.units u ON u.id = pu.unit_id
    WHERE pu.product_id = v_product.id AND (pu.unit_id = v_unit_id OR (v_unit_id IS NULL AND pu.is_base))
    LIMIT 1;
    v_conv := COALESCE(v_conv, 1);
    v_sym := COALESCE(v_sym, 'pcs');

    SELECT price INTO v_cust_price FROM public.product_prices
    WHERE product_id = v_product.id AND unit_id = v_unit_id AND customer_id = v_customer_id LIMIT 1;
    IF v_cust_price IS NOT NULL THEN v_price := v_cust_price;
    ELSIF (SELECT is_base FROM public.product_units WHERE product_id = v_product.id AND unit_id = v_unit_id LIMIT 1) THEN
      v_price := v_product.selling_price;
    ELSE
      v_price := v_product.selling_price * v_conv;
    END IF;

    INSERT INTO public.order_items (order_id, menu_item_id, product_id, unit_id, name, price, quantity, notes)
    VALUES (v_order_id, NULL, v_product.id, v_unit_id, v_product.name || ' (' || v_sym || ')', v_price, v_qty, NULL);

    UPDATE public.products SET stock = GREATEST(0, (stock)::numeric - v_qty * v_conv), updated_at = now() WHERE id = v_product.id;
    INSERT INTO public.stock_movements (organization_id, warehouse_id, product_id, type, quantity, notes)
    VALUES (p_org_id, NULL, v_product.id, 'out', v_qty * v_conv, 'Pesanan katalog #' || substr(v_order_id::text, 1, 8) || ' (' || v_qty || ' ' || v_sym || ')');
  END LOOP;

  RETURN jsonb_build_object(
    'orderId', v_order_id,
    'orderToken', v_order_token,
    'orderDetailUrl', '/order/' || v_order_token,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_katalog_order(uuid, jsonb, text, numeric) TO authenticated;

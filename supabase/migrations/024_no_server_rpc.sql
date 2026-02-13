-- RPC pengganti server API (tanpa Node server / Vercel serverless)
-- Digunakan saat deploy frontend-only ke Vercel.

SET search_path = public;

-- Plan Free (sama seperti seed)
-- create_organization: buat usaha + member + outlet + subscription (auth)
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text,
  p_slug text DEFAULT NULL,
  p_outlet_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_slug text;
  v_outlet_name text;
  v_org_id uuid;
  v_plan_id uuid := '11111111-1111-1111-1111-111111111101'::uuid;
  v_period_end timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  v_slug := COALESCE(trim(p_slug), '') ;
  IF v_slug = '' THEN
    v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
    v_slug := regexp_replace(v_slug, '-+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
  END IF;
  v_outlet_name := COALESCE(NULLIF(trim(p_outlet_name), ''), trim(p_name), 'Outlet Utama');

  INSERT INTO public.organizations (name, slug, plan_id)
  VALUES (trim(p_name), v_slug, v_plan_id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  INSERT INTO public.outlets (organization_id, name, is_default)
  VALUES (v_org_id, v_outlet_name, true);

  v_period_end := now() + interval '14 days';
  INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
  VALUES (v_org_id, v_plan_id, 'trialing', now(), v_period_end);

  RETURN jsonb_build_object('organizationId', v_org_id);
END;
$$;

-- get_invite_by_token: info undangan pelanggan (anon)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust record;
  v_org record;
  v_catalog_url text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT id, email, organization_id, invite_expires_at, user_id
  INTO v_cust
  FROM public.customers
  WHERE invite_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid atau sudah kadaluarsa');
  END IF;
  IF v_cust.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Akun untuk pelanggan ini sudah terhubung');
  END IF;
  IF v_cust.email IS NULL OR trim(v_cust.email) = '' THEN
    RETURN jsonb_build_object('error', 'Data pelanggan tidak memiliki email');
  END IF;
  IF v_cust.invite_expires_at IS NOT NULL AND v_cust.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;

  SELECT id, name INTO v_org FROM public.organizations WHERE id = v_cust.organization_id;
  v_catalog_url := '/katalog/' || v_cust.organization_id;

  RETURN jsonb_build_object(
    'email', trim(v_cust.email),
    'orgName', COALESCE(v_org.name, 'Toko'),
    'catalogUrl', v_catalog_url,
    'orgId', v_cust.organization_id
  );
END;
$$;

-- link_invite_token: hubungkan akun setelah daftar/login (auth)
CREATE OR REPLACE FUNCTION public.link_invite_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_cust record;
  v_org record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT id, email, organization_id, invite_expires_at, user_id
  INTO v_cust
  FROM public.customers
  WHERE invite_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid');
  END IF;
  IF v_cust.user_id IS NOT NULL THEN
    SELECT name INTO v_org FROM public.organizations WHERE id = v_cust.organization_id;
    RETURN jsonb_build_object('linked', true, 'catalogUrl', '/katalog/' || v_cust.organization_id);
  END IF;
  IF v_cust.invite_expires_at IS NOT NULL AND v_cust.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;
  IF lower(trim(v_cust.email)) <> lower(trim(v_user_email)) THEN
    RETURN jsonb_build_object('error', 'Email akun harus sama dengan email pelanggan yang diundang');
  END IF;

  UPDATE public.customers
  SET user_id = v_user_id, invite_token = NULL, invite_expires_at = NULL, updated_at = now()
  WHERE id = v_cust.id;

  RETURN jsonb_build_object('linked', true, 'catalogUrl', '/katalog/' || v_cust.organization_id);
END;
$$;

-- get_shop_by_token: info toko by shop token (anon)
CREATE OR REPLACE FUNCTION public.get_shop_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust record;
  v_org record;
  v_outlet record;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token required');
  END IF;

  SELECT c.id, c.name, c.organization_id
  INTO v_cust
  FROM public.customers c
  WHERE c.shop_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link tidak valid atau sudah tidak aktif');
  END IF;

  SELECT id, name, phone INTO v_org FROM public.organizations WHERE id = v_cust.organization_id;
  SELECT id, name INTO v_outlet FROM public.outlets
  WHERE organization_id = v_cust.organization_id AND is_default = true
  LIMIT 1;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object('id', v_cust.id, 'name', v_cust.name),
    'organization', CASE WHEN v_org.id IS NOT NULL THEN jsonb_build_object('id', v_org.id, 'name', v_org.name, 'phone', v_org.phone) ELSE NULL END,
    'outlet', CASE WHEN v_outlet.id IS NOT NULL THEN jsonb_build_object('id', v_outlet.id, 'name', v_outlet.name) ELSE NULL END
  );
END;
$$;

-- get_shop_catalog: produk + kategori untuk shop token (anon) - return simplified catalog
CREATE OR REPLACE FUNCTION public.get_shop_catalog(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust_id uuid;
  v_org_id uuid;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'categories', '[]'::jsonb);
  END IF;

  SELECT id, organization_id INTO v_cust_id, v_org_id
  FROM public.customers WHERE shop_token = trim(p_token) LIMIT 1;
  IF v_cust_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link tidak valid');
  END IF;

  WITH prods AS (
    SELECT p.id, p.name, p.stock, p.selling_price, p.default_unit_id, p.category_id, p.image_url
    FROM public.products p
    WHERE p.organization_id = v_org_id AND p.is_available = true
    ORDER BY p.name
  ),
  cats AS (
    SELECT id, name, sort_order FROM public.menu_categories
    WHERE organization_id = v_org_id
    ORDER BY sort_order, name
  ),
  -- Build products with units and prices (simplified: one row per product with default price)
  prod_json AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.id, 'name', p.name, 'stock', (p.stock)::numeric, 'image_url', p.image_url,
        'category_id', p.category_id, 'default_unit_id', p.default_unit_id,
        'units', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', pu.id, 'unit_id', pu.unit_id, 'conversion_to_base', pu.conversion_to_base,
            'is_base', pu.is_base, 'symbol', COALESCE(u.symbol, 'pcs'), 'name', COALESCE(u.name, 'Pcs'),
            'price', COALESCE(
              (SELECT pr.price FROM public.product_prices pr WHERE pr.product_id = p.id AND pr.unit_id = pu.unit_id AND (pr.customer_id = v_cust_id OR pr.customer_id IS NULL) ORDER BY CASE WHEN pr.customer_id = v_cust_id THEN 0 ELSE 1 END LIMIT 1),
              CASE WHEN pu.is_base THEN p.selling_price ELSE (p.selling_price * pu.conversion_to_base) END
            )
          ))
          FROM public.product_units pu
          LEFT JOIN public.units u ON u.id = pu.unit_id
          WHERE pu.product_id = p.id
        ), jsonb_build_array(jsonb_build_object('id', 'default', 'unit_id', p.default_unit_id, 'conversion_to_base', 1, 'is_base', true, 'symbol', 'pcs', 'name', 'Pcs', 'price', p.selling_price))),
        'default_price', p.selling_price,
        'default_unit', COALESCE(
          (SELECT jsonb_build_object('id', pu.id, 'unit_id', pu.unit_id, 'conversion_to_base', pu.conversion_to_base, 'is_base', pu.is_base, 'symbol', COALESCE(u.symbol, 'pcs'), 'name', COALESCE(u.name, 'Pcs'), 'price', CASE WHEN pu.is_base THEN p.selling_price ELSE p.selling_price * pu.conversion_to_base END)
           FROM public.product_units pu LEFT JOIN public.units u ON u.id = pu.unit_id WHERE pu.product_id = p.id AND pu.is_base LIMIT 1),
          jsonb_build_object('id', 'default', 'unit_id', p.default_unit_id, 'conversion_to_base', 1, 'is_base', true, 'symbol', 'pcs', 'name', 'Pcs', 'price', p.selling_price)
        )
      )
    ) AS arr FROM prods p
  ),
  cat_json AS (SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'sort_order', sort_order) ORDER BY sort_order, name) AS arr FROM cats)
  SELECT jsonb_build_object(
    'products', COALESCE((SELECT arr FROM prod_json), '[]'::jsonb),
    'categories', COALESCE((SELECT arr FROM cat_json), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- get_order_by_token: detail pesanan by order_token atau id (anon)
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

-- Helper: generate base64url-safe token (no pgcrypto; uses gen_random_uuid)
CREATE OR REPLACE FUNCTION public.gen_order_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT replace(replace(replace(
    encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
    '+', '-'), '/', '_'), '=', '');
$$;

-- create_katalog_order: buat pesanan katalog (auth, pelanggan login)
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

-- create_shop_order: buat pesanan via shop token (anon)
CREATE OR REPLACE FUNCTION public.create_shop_order(
  p_token text,
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
  v_cust_id uuid;
  v_org_id uuid;
  v_outlet_id uuid;
  v_order_id uuid;
  v_order_token text;
  v_item jsonb;
  v_product record;
  v_conv numeric;
  v_sym text;
  v_price numeric;
  v_qty int;
  v_unit_id uuid;
  v_subtotal numeric := 0;
  v_total numeric;
  v_discount numeric;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token required');
  END IF;

  SELECT id, organization_id INTO v_cust_id, v_org_id
  FROM public.customers WHERE shop_token = trim(p_token) LIMIT 1;
  IF v_cust_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link tidak valid');
  END IF;

  SELECT id INTO v_outlet_id FROM public.outlets
  WHERE organization_id = v_org_id AND is_default = true LIMIT 1;
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
    WHERE id = (v_item->>'product_id')::uuid AND organization_id = v_org_id LIMIT 1;
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

    SELECT price INTO v_price FROM public.product_prices
    WHERE product_id = v_product.id AND unit_id = v_unit_id AND (customer_id = v_cust_id OR customer_id IS NULL)
    ORDER BY CASE WHEN customer_id = v_cust_id THEN 0 ELSE 1 END LIMIT 1;
    IF v_price IS NULL THEN
      IF (SELECT is_base FROM public.product_units WHERE product_id = v_product.id AND unit_id = v_unit_id LIMIT 1) THEN
        v_price := v_product.selling_price;
      ELSE
        v_price := v_product.selling_price * v_conv;
      END IF;
    END IF;

    IF (v_product.stock)::numeric < (v_qty * v_conv) THEN
      RETURN jsonb_build_object('error', 'Stok "' || v_product.name || '" tidak mencukupi. Tersedia: ' || v_product.stock);
    END IF;

    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  v_total := GREATEST(0, v_subtotal - v_discount);

  INSERT INTO public.orders (organization_id, outlet_id, created_by, customer_id, status, subtotal, tax, discount, total, payment_method, notes, order_token)
  VALUES (v_org_id, v_outlet_id, NULL, v_cust_id, 'pending', v_subtotal, 0, v_discount, v_total, NULL, NULLIF(trim(p_notes), ''), v_order_token)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND organization_id = v_org_id LIMIT 1;
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

    SELECT price INTO v_price FROM public.product_prices
    WHERE product_id = v_product.id AND unit_id = v_unit_id AND (customer_id = v_cust_id OR customer_id IS NULL)
    ORDER BY CASE WHEN customer_id = v_cust_id THEN 0 ELSE 1 END LIMIT 1;
    IF v_price IS NULL THEN
      IF (SELECT is_base FROM public.product_units WHERE product_id = v_product.id AND unit_id = v_unit_id LIMIT 1) THEN
        v_price := v_product.selling_price;
      ELSE
        v_price := v_product.selling_price * v_conv;
      END IF;
    END IF;

    INSERT INTO public.order_items (order_id, menu_item_id, product_id, unit_id, name, price, quantity, notes)
    VALUES (v_order_id, NULL, v_product.id, v_unit_id, v_product.name || ' (' || v_sym || ')', v_price, v_qty, NULL);

    UPDATE public.products SET stock = GREATEST(0, (stock)::numeric - v_qty * v_conv), updated_at = now() WHERE id = v_product.id;
    INSERT INTO public.stock_movements (organization_id, warehouse_id, product_id, type, quantity, notes)
    VALUES (v_org_id, NULL, v_product.id, 'out', v_qty * v_conv, 'Pesanan toko online #' || substr(v_order_id::text, 1, 8));
  END LOOP;

  RETURN jsonb_build_object(
    'orderId', v_order_id,
    'orderToken', v_order_token,
    'orderDetailUrl', '/order/' || v_order_token,
    'total', v_total
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_invite_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_catalog(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_katalog_order(uuid, jsonb, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shop_order(text, jsonb, text, numeric) TO anon, authenticated;

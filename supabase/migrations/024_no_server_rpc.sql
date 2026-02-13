-- RPC pengganti server API (tanpa server, deploy Vercel/frontend only)
-- Plan Free ID dari seed
-- create_organization: auth required
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

  IF trim(coalesce(p_name, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Nama usaha wajib diisi.');
  END IF;

  v_slug := trim(coalesce(p_slug, ''));
  IF v_slug = '' THEN
    v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
    v_slug := regexp_replace(v_slug, '-+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
  END IF;

  v_outlet_name := trim(coalesce(p_outlet_name, ''));
  IF v_outlet_name = '' THEN v_outlet_name := trim(p_name); END IF;
  IF v_outlet_name = '' THEN v_outlet_name := 'Outlet Utama'; END IF;

  INSERT INTO organizations (name, slug, plan_id)
  VALUES (trim(p_name), v_slug, v_plan_id)
  RETURNING id INTO v_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  INSERT INTO outlets (organization_id, name, is_default)
  VALUES (v_org_id, v_outlet_name, true);

  v_period_end := now() + interval '14 days';
  INSERT INTO subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
  VALUES (v_org_id, v_plan_id, 'trialing', now(), v_period_end);

  RETURN jsonb_build_object('organizationId', v_org_id);
END;
$$;

-- get_invite_by_token: anon, returns invite info
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust record;
  v_org record;
  v_expires_at timestamptz;
BEGIN
  IF trim(coalesce(p_token, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT id, email, organization_id, invite_expires_at, user_id
  INTO v_cust
  FROM customers
  WHERE invite_token = p_token
  LIMIT 1;

  IF v_cust.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid atau sudah kadaluarsa');
  END IF;

  IF v_cust.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Akun untuk pelanggan ini sudah terhubung');
  END IF;

  IF trim(coalesce(v_cust.email, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Data pelanggan tidak memiliki email');
  END IF;

  v_expires_at := v_cust.invite_expires_at;
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;

  SELECT id, name INTO v_org FROM organizations WHERE id = v_cust.organization_id;

  RETURN jsonb_build_object(
    'email', trim(v_cust.email),
    'orgName', coalesce(v_org.name, 'Toko'),
    'orgId', v_cust.organization_id
  );
END;
$$;

-- link_invite_token: auth required, link user to customer
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
  v_expires_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF trim(coalesce(p_token, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT id, email, organization_id, invite_expires_at, user_id
  INTO v_cust
  FROM customers
  WHERE invite_token = p_token
  LIMIT 1;

  IF v_cust.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid');
  END IF;

  IF v_cust.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('linked', true, 'orgId', v_cust.organization_id);
  END IF;

  v_expires_at := v_cust.invite_expires_at;
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;

  IF lower(trim(v_cust.email)) <> lower(trim(coalesce(v_user_email, ''))) THEN
    RETURN jsonb_build_object('error', 'Email akun harus sama dengan email pelanggan yang diundang');
  END IF;

  UPDATE customers
  SET user_id = v_user_id, invite_token = null, invite_expires_at = null, updated_at = now()
  WHERE id = v_cust.id;

  RETURN jsonb_build_object('linked', true, 'orgId', v_cust.organization_id);
END;
$$;

-- get_shop_by_token: anon, shop info by shop_token
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
  IF trim(coalesce(p_token, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Token required');
  END IF;

  SELECT id, name, organization_id INTO v_cust
  FROM customers WHERE shop_token = p_token LIMIT 1;

  IF v_cust.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link tidak valid atau sudah tidak aktif');
  END IF;

  SELECT id, name, phone INTO v_org FROM organizations WHERE id = v_cust.organization_id;
  SELECT id, name INTO v_outlet FROM outlets
  WHERE organization_id = v_cust.organization_id AND is_default = true
  LIMIT 1;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object('id', v_cust.id, 'name', v_cust.name),
    'organization', jsonb_build_object('id', v_org.id, 'name', v_org.name, 'phone', v_org.phone),
    'outlet', jsonb_build_object('id', v_outlet.id, 'name', v_outlet.name)
  );
END;
$$;

-- get_shop_catalog: anon, products + product_units + product_prices + categories (client builds catalog)
CREATE OR REPLACE FUNCTION public.get_shop_catalog(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust_id uuid;
  v_org_id uuid;
  v_products jsonb;
  v_product_units jsonb;
  v_product_prices jsonb;
  v_categories jsonb;
BEGIN
  IF trim(coalesce(p_token, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Token required', 'products', '[]'::jsonb, 'categories', '[]'::jsonb, 'product_units', '[]'::jsonb, 'product_prices', '[]'::jsonb);
  END IF;

  SELECT c.id, c.organization_id INTO v_cust_id, v_org_id
  FROM customers c WHERE c.shop_token = p_token LIMIT 1;
  IF v_cust_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link tidak valid', 'products', '[]'::jsonb, 'categories', '[]'::jsonb, 'product_units', '[]'::jsonb, 'product_prices', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'name', p.name, 'stock', (p.stock)::float, 'selling_price', (p.selling_price)::float,
      'default_unit_id', p.default_unit_id, 'category_id', p.category_id, 'image_url', p.image_url
    ) ORDER BY p.name
  ), '[]'::jsonb) INTO v_products
  FROM products p WHERE p.organization_id = v_org_id AND p.is_available = true;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pu.id, 'product_id', pu.product_id, 'unit_id', pu.unit_id,
      'conversion_to_base', (pu.conversion_to_base)::float, 'is_base', pu.is_base,
      'symbol', coalesce(u.symbol, 'pcs'), 'name', coalesce(u.name, 'Pcs')
    )
  ), '[]'::jsonb) INTO v_product_units
  FROM product_units pu
  LEFT JOIN units u ON u.id = pu.unit_id
  WHERE pu.product_id IN (SELECT id FROM products WHERE organization_id = v_org_id AND is_available = true);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object('product_id', pp.product_id, 'unit_id', pp.unit_id, 'customer_id', pp.customer_id, 'price', (pp.price)::float)
  ), '[]'::jsonb) INTO v_product_prices
  FROM product_prices pp
  WHERE pp.product_id IN (SELECT id FROM products WHERE organization_id = v_org_id AND is_available = true);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object('id', mc.id, 'name', mc.name, 'sort_order', mc.sort_order) ORDER BY mc.sort_order, mc.name
  ), '[]'::jsonb) INTO v_categories
  FROM menu_categories mc WHERE mc.organization_id = v_org_id;

  RETURN jsonb_build_object(
    'products', coalesce(v_products, '[]'::jsonb),
    'categories', coalesce(v_categories, '[]'::jsonb),
    'product_units', coalesce(v_product_units, '[]'::jsonb),
    'product_prices', coalesce(v_product_prices, '[]'::jsonb),
    'customer_id', v_cust_id,
    'organization_id', v_org_id
  );
END;
$$;

-- get_order_by_token: anon, order detail by order_token or id
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
  IF trim(coalesce(p_token, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Token required');
  END IF;

  SELECT id, customer_id, organization_id, status, subtotal, discount, total, notes, created_at, order_token
  INTO v_order
  FROM orders
  WHERE order_token = p_token
  LIMIT 1;

  IF v_order.id IS NULL THEN
    BEGIN
      SELECT id, customer_id, organization_id, status, subtotal, discount, total, notes, created_at, order_token
      INTO v_order FROM orders WHERE id = p_token::uuid LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Pesanan tidak ditemukan');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', oi.name, 'price', (oi.price)::float, 'quantity', oi.quantity
  ) ORDER BY oi.created_at), '[]'::jsonb) INTO v_items
  FROM order_items oi WHERE oi.order_id = v_order.id;

  SELECT name INTO v_customer_name FROM customers WHERE id = v_order.customer_id;
  SELECT name INTO v_org_name FROM organizations WHERE id = v_order.organization_id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'order_token', v_order.order_token,
    'status', v_order.status,
    'subtotal', (v_order.subtotal)::float,
    'discount', (coalesce(v_order.discount, 0))::float,
    'total', (v_order.total)::float,
    'notes', v_order.notes,
    'created_at', v_order.created_at,
    'customer_name', v_customer_name,
    'organization_name', v_org_name,
    'items', coalesce(v_items, '[]'::jsonb)
  );
END;
$$;

-- create_katalog_order: auth, create order for katalog (pelanggan login)
CREATE OR REPLACE FUNCTION public.create_katalog_order(
  p_org_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_discount float DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org record;
  v_customer_id uuid;
  v_outlet_id uuid;
  v_order_id uuid;
  v_order_token text;
  v_item jsonb;
  v_product record;
  v_unit_id uuid;
  v_is_base boolean;
  v_price float;
  v_qty int;
  v_conv float;
  v_sym text;
  v_subtotal float := 0;
  v_total float;
  v_discount float;
  v_stock float;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_org_id IS NULL OR jsonb_array_length(p_items) IS NULL OR jsonb_array_length(p_items) < 1 THEN
    RETURN jsonb_build_object('error', 'Keranjang kosong');
  END IF;

  v_discount := least(greatest(coalesce(p_discount, 0)::float, 0), 999999999);

  SELECT id, catalog_public INTO v_org FROM organizations WHERE id = p_org_id;
  IF v_org.id IS NULL OR NOT coalesce(v_org.catalog_public, false) THEN
    RETURN jsonb_build_object('error', 'Katalog tidak tersedia');
  END IF;

  SELECT id INTO v_customer_id FROM customers
  WHERE organization_id = p_org_id AND user_id = v_user_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM customers c
    JOIN auth.users u ON u.email = c.email
    WHERE c.organization_id = p_org_id AND u.id = v_user_id LIMIT 1;
  END IF;

  SELECT id INTO v_outlet_id FROM outlets
  WHERE organization_id = p_org_id AND is_default = true LIMIT 1;
  IF v_outlet_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Outlet tidak ditemukan');
  END IF;

  v_order_token := encode(gen_random_bytes(16), 'base64');
  v_order_token := replace(replace(replace(v_order_token, '+', '-'), '/', '_'), '=', '');

  INSERT INTO orders (organization_id, outlet_id, created_by, customer_id, status, subtotal, tax, discount, total, notes, order_token)
  VALUES (
    p_org_id, v_outlet_id, v_user_id, v_customer_id, 'pending',
    0, 0, v_discount, 0,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_order_token
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, name, stock, selling_price, default_unit_id INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid AND organization_id = p_org_id;

    IF v_product.id IS NULL THEN CONTINUE; END IF;

    v_qty := greatest(1, (v_item->>'quantity')::int);
    SELECT pu.unit_id, pu.conversion_to_base, coalesce(pu.is_base, true), coalesce(u.symbol, 'pcs')
    INTO v_unit_id, v_conv, v_is_base, v_sym
    FROM product_units pu
    LEFT JOIN units u ON u.id = pu.unit_id
    WHERE pu.product_id = v_product.id
      AND (pu.unit_id = (v_item->>'unit_id')::uuid OR ((v_item->>'unit_id') IS NULL AND pu.is_base))
    LIMIT 1;

    IF v_unit_id IS NULL THEN
      SELECT pu.unit_id, pu.conversion_to_base, coalesce(pu.is_base, true), coalesce(u.symbol, 'pcs')
      INTO v_unit_id, v_conv, v_is_base, v_sym
      FROM product_units pu
      LEFT JOIN units u ON u.id = pu.unit_id
      WHERE pu.product_id = v_product.id
      LIMIT 1;
    END IF;
    v_conv := coalesce(v_conv, 1);
    v_sym := coalesce(v_sym, 'pcs');

    SELECT COALESCE(
      (SELECT (pp.price)::float FROM product_prices pp
       WHERE pp.product_id = v_product.id AND pp.unit_id = v_unit_id AND pp.customer_id = v_customer_id LIMIT 1),
      (SELECT (pp.price)::float FROM product_prices pp
       WHERE pp.product_id = v_product.id AND pp.unit_id = v_unit_id AND pp.customer_id IS NULL LIMIT 1),
      CASE WHEN coalesce(v_is_base, true) THEN (v_product.selling_price)::float ELSE (v_product.selling_price * v_conv)::float END
    ) INTO v_price;

    v_stock := (v_product.stock)::float;
    IF v_stock < (v_qty * v_conv) THEN
      DELETE FROM orders WHERE id = v_order_id;
      RETURN jsonb_build_object('error', 'Stok "' || v_product.name || '" tidak mencukupi. Tersedia: ' || v_stock);
    END IF;

    INSERT INTO order_items (order_id, product_id, unit_id, name, price, quantity)
    VALUES (v_order_id, v_product.id, v_unit_id, v_product.name || ' (' || v_sym || ')', v_price, v_qty);

    v_subtotal := v_subtotal + (v_price * v_qty);

    UPDATE products SET stock = greatest(0, (stock)::float - v_qty * v_conv), updated_at = now() WHERE id = v_product.id;
    INSERT INTO stock_movements (organization_id, warehouse_id, product_id, type, quantity, notes)
    VALUES (p_org_id, null, v_product.id, 'out', v_qty * v_conv, 'Pesanan katalog #' || substring(v_order_id::text, 1, 8));
  END LOOP;

  v_total := greatest(0, v_subtotal - v_discount);
  UPDATE orders SET subtotal = v_subtotal, total = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'orderId', v_order_id,
    'orderToken', v_order_token,
    'total', v_total
  );
END;
$$;

-- create_shop_order: anon, create order by shop_token
CREATE OR REPLACE FUNCTION public.create_shop_order(
  p_token text,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_discount float DEFAULT 0
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
  v_unit_id uuid;
  v_conv float;
  v_sym text;
  v_price float;
  v_qty int;
  v_subtotal float := 0;
  v_discount float;
  v_total float;
  v_stock float;
  v_item_name text;
BEGIN
  IF trim(coalesce(p_token, '')) = '' THEN
    RETURN jsonb_build_object('error', 'Token required');
  END IF;

  SELECT c.id, c.organization_id INTO v_cust_id, v_org_id
  FROM customers c WHERE c.shop_token = p_token LIMIT 1;
  IF v_cust_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Link tidak valid');
  END IF;

  SELECT id INTO v_outlet_id FROM outlets
  WHERE organization_id = v_org_id AND is_default = true LIMIT 1;
  IF v_outlet_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Outlet tidak ditemukan');
  END IF;

  IF jsonb_array_length(p_items) IS NULL OR jsonb_array_length(p_items) < 1 THEN
    RETURN jsonb_build_object('error', 'Keranjang kosong');
  END IF;

  v_discount := least(greatest(coalesce(p_discount, 0)::float, 0), 999999999);
  v_order_token := replace(replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'), '=', '');

  INSERT INTO orders (organization_id, outlet_id, created_by, customer_id, status, subtotal, tax, discount, total, notes, order_token)
  VALUES (v_org_id, v_outlet_id, null, v_cust_id, 'pending', 0, 0, v_discount, 0, nullif(trim(coalesce(p_notes, '')), ''), v_order_token)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, name, stock, selling_price, default_unit_id INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::uuid AND organization_id = v_org_id;
    IF v_product.id IS NULL THEN CONTINUE; END IF;

    v_qty := greatest(1, (v_item->>'quantity')::int);
    SELECT pu.unit_id, pu.conversion_to_base, coalesce(u.symbol, 'pcs')
    INTO v_unit_id, v_conv, v_sym
    FROM product_units pu
    LEFT JOIN units u ON u.id = pu.unit_id
    WHERE pu.product_id = v_product.id
      AND (pu.unit_id = (v_item->>'unit_id')::uuid OR ((v_item->>'unit_id') IS NULL AND pu.is_base))
    LIMIT 1;
    IF v_unit_id IS NULL THEN
      SELECT pu.unit_id, pu.conversion_to_base, coalesce(u.symbol, 'pcs')
      INTO v_unit_id, v_conv, v_sym
      FROM product_units pu LEFT JOIN units u ON u.id = pu.unit_id
      WHERE pu.product_id = v_product.id LIMIT 1;
    END IF;
    v_conv := coalesce(v_conv, 1);
    v_sym := coalesce(v_sym, 'pcs');

    SELECT COALESCE(
      (SELECT (pp.price)::float FROM product_prices pp
       WHERE pp.product_id = v_product.id AND pp.unit_id = v_unit_id AND pp.customer_id = v_cust_id LIMIT 1),
      (SELECT (pp.price)::float FROM product_prices pp
       WHERE pp.product_id = v_product.id AND pp.unit_id = v_unit_id AND pp.customer_id IS NULL LIMIT 1),
      (v_product.selling_price * v_conv)::float
    ) INTO v_price;

    v_stock := (v_product.stock)::float;
    IF v_stock < (v_qty * v_conv) THEN
      DELETE FROM orders WHERE id = v_order_id;
      RETURN jsonb_build_object('error', 'Stok "' || v_product.name || '" tidak mencukupi. Tersedia: ' || v_stock);
    END IF;

    v_item_name := v_product.name || ' (' || v_sym || ')';
    INSERT INTO order_items (order_id, product_id, unit_id, name, price, quantity)
    VALUES (v_order_id, v_product.id, v_unit_id, v_item_name, v_price, v_qty);
    v_subtotal := v_subtotal + (v_price * v_qty);

    UPDATE products SET stock = greatest(0, (stock)::float - v_qty * v_conv), updated_at = now() WHERE id = v_product.id;
    INSERT INTO stock_movements (organization_id, warehouse_id, product_id, type, quantity, notes)
    VALUES (v_org_id, null, v_product.id, 'out', v_qty * v_conv, 'Pesanan toko #' || substring(v_order_id::text, 1, 8));
  END LOOP;

  v_total := greatest(0, v_subtotal - v_discount);
  UPDATE orders SET subtotal = v_subtotal, total = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object('orderId', v_order_id, 'orderToken', v_order_token, 'total', v_total);
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_invite_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_catalog(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_katalog_order(uuid, jsonb, text, float) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shop_order(text, jsonb, text, float) TO anon, authenticated;
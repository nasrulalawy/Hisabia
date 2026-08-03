-- Harga jual per outlet (katalog tetap bersama; harga bisa beda per cabang)
ALTER TABLE public.outlet_product_stock
  ADD COLUMN IF NOT EXISTS selling_price decimal(12,2);

COMMENT ON COLUMN public.outlet_product_stock.selling_price IS
  'Harga jual outlet. NULL = pakai products.selling_price (harga default org).';

-- Backfill dari harga produk untuk baris yang sudah ada
UPDATE public.outlet_product_stock ops
SET selling_price = p.selling_price
FROM public.products p
WHERE ops.product_id = p.id
  AND ops.selling_price IS NULL;

-- Set harga jual outlet (upsert, pertahankan stok)
CREATE OR REPLACE FUNCTION public.set_outlet_product_selling_price(
  p_org_id uuid,
  p_outlet_id uuid,
  p_product_id uuid,
  p_selling_price numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
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

  v_price := GREATEST(0, COALESCE(p_selling_price, 0));

  SELECT stock INTO v_stock
  FROM public.outlet_product_stock
  WHERE outlet_id = p_outlet_id AND product_id = p_product_id;

  INSERT INTO public.outlet_product_stock (organization_id, outlet_id, product_id, stock, selling_price, updated_at)
  VALUES (p_org_id, p_outlet_id, p_product_id, COALESCE(v_stock, 0), v_price, now())
  ON CONFLICT (outlet_id, product_id) DO UPDATE
  SET selling_price = v_price, updated_at = now();

  RETURN v_price;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_outlet_product_selling_price(uuid, uuid, uuid, numeric) TO authenticated;

-- Pastikan set stok tidak menghapus harga jual
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

  UPDATE public.products p
  SET stock = COALESCE((
    SELECT SUM(ops.stock) FROM public.outlet_product_stock ops WHERE ops.product_id = p.id
  ), 0),
  updated_at = now()
  WHERE p.id = p_product_id;

  RETURN v_stock;
END;
$$;

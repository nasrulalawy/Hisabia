-- HPP / harga modal per outlet
ALTER TABLE public.outlet_product_stock
  ADD COLUMN IF NOT EXISTS cost_price decimal(12,2);

COMMENT ON COLUMN public.outlet_product_stock.cost_price IS
  'HPP / harga modal outlet. NULL = pakai products.cost_price (default org).';

UPDATE public.outlet_product_stock ops
SET cost_price = p.cost_price
FROM public.products p
WHERE ops.product_id = p.id
  AND ops.cost_price IS NULL;

CREATE OR REPLACE FUNCTION public.set_outlet_product_cost_price(
  p_org_id uuid,
  p_outlet_id uuid,
  p_product_id uuid,
  p_cost_price numeric
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

  v_price := GREATEST(0, COALESCE(p_cost_price, 0));

  SELECT stock INTO v_stock
  FROM public.outlet_product_stock
  WHERE outlet_id = p_outlet_id AND product_id = p_product_id;

  INSERT INTO public.outlet_product_stock (organization_id, outlet_id, product_id, stock, cost_price, updated_at)
  VALUES (p_org_id, p_outlet_id, p_product_id, COALESCE(v_stock, 0), v_price, now())
  ON CONFLICT (outlet_id, product_id) DO UPDATE
  SET cost_price = v_price, updated_at = now();

  RETURN v_price;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_outlet_product_cost_price(uuid, uuid, uuid, numeric) TO authenticated;

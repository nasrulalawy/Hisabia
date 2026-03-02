-- HPP variant selalu add-on (tambahan) ke HPP produk. Bisa positif (+) atau negatif (-). Kosong = 0.
CREATE OR REPLACE FUNCTION public.get_product_cost_price(
  p_product_id uuid,
  p_product_variant_id uuid DEFAULT NULL
)
RETURNS decimal(12,2)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT (
    (SELECT COALESCE(cost_price, 0) FROM public.products WHERE id = p_product_id LIMIT 1)
    + COALESCE(
        (SELECT pv.cost_price FROM public.product_variants pv
         WHERE pv.id = p_product_variant_id AND pv.product_id = p_product_id
         LIMIT 1),
        0
    )
  )::decimal(12,2);
$$;

COMMENT ON FUNCTION public.get_product_cost_price(uuid, uuid) IS 'HPP: produk + tambahan HPP variant (bisa negatif). Tanpa variant = HPP produk saja.';

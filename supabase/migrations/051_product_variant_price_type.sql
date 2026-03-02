-- Jenis harga variant: ganti total (replace) atau tambahan di atas harga dasar (addon).
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'replace'
  CHECK (price_type IN ('replace', 'addon'));

COMMENT ON COLUMN public.product_variants.price_type IS 'replace: harga jual variant menggantikan harga produk. addon: nilai variant ditambah ke harga dasar produk.';

-- Harga jual efektif: replace = pakai selling_price variant (atau default produk); addon = harga produk + selling_price variant.
CREATE OR REPLACE FUNCTION public.get_product_selling_price(
  p_product_id uuid,
  p_product_variant_id uuid DEFAULT NULL
)
RETURNS decimal(12,2)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
      WHEN pv.price_type = 'addon' THEN
        (SELECT COALESCE(selling_price, 0) FROM public.products WHERE id = p_product_id LIMIT 1) + COALESCE(pv.selling_price, 0)
      ELSE
        COALESCE(pv.selling_price, (SELECT selling_price FROM public.products WHERE id = p_product_id LIMIT 1))
    END
     FROM public.product_variants pv
     WHERE pv.id = p_product_variant_id AND pv.product_id = p_product_id
     LIMIT 1),
    (SELECT selling_price FROM public.products WHERE id = p_product_id LIMIT 1),
    0
  )::decimal(12,2);
$$;

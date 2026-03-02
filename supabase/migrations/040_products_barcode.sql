-- Barcode/SKU untuk scan di POS. Unik per organisasi (satu barcode = satu produk).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_barcode
  ON public.products(organization_id, barcode)
  WHERE barcode IS NOT NULL AND barcode != '';

COMMENT ON COLUMN public.products.barcode IS 'Barcode/SKU untuk scan kamera di POS. Unik per organisasi.';

-- Multiple barcode per produk: satu produk bisa punya banyak barcode, scan salah satu → produk yang sama.
CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_barcodes_org_barcode
  ON public.product_barcodes(organization_id, barcode)
  WHERE barcode IS NOT NULL AND barcode != '';

CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON public.product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_org ON public.product_barcodes(organization_id);

COMMENT ON TABLE public.product_barcodes IS 'Barcode/SKU ganda per produk. Scan salah satu barcode di POS → produk yang sama.';

-- RLS
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_barcodes_select" ON public.product_barcodes
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "product_barcodes_insert" ON public.product_barcodes
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "product_barcodes_update" ON public.product_barcodes
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "product_barcodes_delete" ON public.product_barcodes
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- Migrasi: salin barcode yang sudah ada di products ke product_barcodes (satu produk = satu barcode saat ini)
INSERT INTO public.product_barcodes (organization_id, product_id, barcode)
SELECT organization_id, id, barcode
FROM public.products
WHERE barcode IS NOT NULL AND barcode != '';

-- Kredit Syariah: total pembiayaan dari produk + margin % (prinsip murabahah)
-- Harga barang = jumlah dari produk yang dipilih; Total pembiayaan = Harga barang × (1 + margin%/100); Angsuran = Total / tenor

ALTER TABLE public.kredit_syariah_akad
  ADD COLUMN IF NOT EXISTS harga_barang decimal(12,2),
  ADD COLUMN IF NOT EXISTS margin_percent decimal(5,2);

COMMENT ON COLUMN public.kredit_syariah_akad.harga_barang IS 'Total harga barang (sebelum margin) dari produk yang dikredit.';
COMMENT ON COLUMN public.kredit_syariah_akad.margin_percent IS 'Margin keuntungan (%) — prinsip murabahah, bukan bunga.';

-- Detail produk per akad (barang yang dikredit)
CREATE TABLE IF NOT EXISTS public.kredit_syariah_akad_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  akad_id uuid NOT NULL REFERENCES public.kredit_syariah_akad(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text,
  quantity decimal(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price decimal(12,2) NOT NULL CHECK (unit_price >= 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kredit_syariah_akad_items_akad ON public.kredit_syariah_akad_items(akad_id);

COMMENT ON TABLE public.kredit_syariah_akad_items IS 'Daftar produk yang dibiayai per akad (murabahah).';

ALTER TABLE public.kredit_syariah_akad_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kredit_syariah_akad_items_via_akad"
  ON public.kredit_syariah_akad_items FOR ALL
  USING (
    akad_id IN (
      SELECT id FROM public.kredit_syariah_akad
      WHERE organization_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    akad_id IN (
      SELECT id FROM public.kredit_syariah_akad
      WHERE organization_id IN (SELECT user_org_ids())
    )
  );

GRANT ALL ON public.kredit_syariah_akad_items TO authenticated;

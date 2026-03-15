-- Gerakan stok bahan: pembelian (in), pemakaian karena penjualan (usage), penyesuaian (adjust).
-- Membantu membedakan "bahan belum terpakai" (stok saat ini) vs "bahan terpakai" (riwayat usage).
CREATE TABLE IF NOT EXISTS public.ingredient_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in', 'out', 'usage', 'adjust')),
  quantity decimal(12,4) NOT NULL,
  notes text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_org ON public.ingredient_stock_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_ingredient ON public.ingredient_stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_created ON public.ingredient_stock_movements(created_at DESC);

COMMENT ON TABLE public.ingredient_stock_movements IS 'Riwayat stok bahan: in=pembelian, usage=pemakaian karena penjualan produk (resep), out/adjust=penyesuaian.';
COMMENT ON COLUMN public.ingredient_stock_movements.reference_type IS 'order = pemakaian dari penjualan; purchase_ingredient = dari pembelian bahan (opsional).';

ALTER TABLE public.ingredient_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_stock_movements_select" ON public.ingredient_stock_movements
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "ingredient_stock_movements_insert" ON public.ingredient_stock_movements
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "ingredient_stock_movements_delete" ON public.ingredient_stock_movements
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

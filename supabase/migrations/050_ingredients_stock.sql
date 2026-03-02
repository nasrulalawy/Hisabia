-- Ingredients punya stok (dalam satuan unit_id). Bisa diisi manual atau lewat pembelian/penyesuaian.
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS stock decimal(12,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ingredients.stock IS 'Stok bahan dalam satuan unit_id.';

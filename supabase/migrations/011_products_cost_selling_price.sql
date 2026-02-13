-- Harga beli (HPP) dan harga jual di level produk
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price decimal(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price decimal(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.cost_price IS 'Harga pokok penjualan / harga beli (HPP)';
COMMENT ON COLUMN public.products.selling_price IS 'Harga jual default';

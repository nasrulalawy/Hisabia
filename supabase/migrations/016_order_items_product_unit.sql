-- order_items: product_id & unit_id untuk produk (multi satuan)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

COMMENT ON COLUMN public.order_items.product_id IS 'Untuk item produk (bukan menu_item). Digunakan untuk pengurangan stok.';
COMMENT ON COLUMN public.order_items.unit_id IS 'Satuan penjualan (pcs, dus, dll) untuk konversi stok.';

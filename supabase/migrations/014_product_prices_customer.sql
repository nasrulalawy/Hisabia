-- Harga khusus per pelanggan
ALTER TABLE public.product_prices
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_prices_customer ON public.product_prices(customer_id);

COMMENT ON COLUMN public.product_prices.customer_id IS 'Null = harga umum. Terisi = harga khusus pelanggan.';

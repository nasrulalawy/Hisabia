-- Link belanja pelanggan ( unique token untuk akses katalog dan pemesanan tanpa login )
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS shop_token text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_customers_shop_token ON public.customers(shop_token) WHERE shop_token IS NOT NULL;

COMMENT ON COLUMN public.customers.shop_token IS 'Token unik untuk link belanja pelanggan. Dibagikan toko ke pelanggan untuk akses katalog dan pemesanan.';

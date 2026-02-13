-- Nomor WA toko (untuk link WhatsApp setelah pelanggan memesan)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.organizations.phone IS 'Nomor WA toko (format: 6281234567890). Dibuka otomatis saat pelanggan selesai memesan.';

-- Token untuk link detail pesanan (public, shareable)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_token text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_order_token ON public.orders(order_token) WHERE order_token IS NOT NULL;

COMMENT ON COLUMN public.orders.order_token IS 'Token unik untuk link detail pesanan. Dibagikan ke pelanggan untuk buka via WA.';

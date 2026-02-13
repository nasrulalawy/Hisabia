-- Undang pelanggan buat akun (link ke data pelanggan)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_invite_token
  ON public.customers(invite_token) WHERE invite_token IS NOT NULL;

COMMENT ON COLUMN public.customers.invite_token IS 'Token unik untuk link undangan daftar akun pelanggan.';
COMMENT ON COLUMN public.customers.invite_expires_at IS 'Batas waktu link undangan (mis. 7 hari).';

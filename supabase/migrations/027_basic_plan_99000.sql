-- Basic plan: Rp 99.000/bulan (bukan gratis)
-- Aplikasi hanya gratis selama trial 14 hari, setelah itu wajib berlangganan
UPDATE public.subscription_plans SET
  price_monthly = 99000,
  description = '1 outlet, 2 user (Owner + Kasir). Paket berbayar setelah trial.',
  updated_at = now()
WHERE slug = 'basic';

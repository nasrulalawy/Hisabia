-- Update paket subscription: Basic, Pro, Business
-- Basic: 1 outlet, 2 member (super admin + kasir)
-- Pro: 3 outlet, 5 member
-- Business: 10 outlet, 15 member
-- Enterprise: unlimited

-- Update existing plans (by id dari 004_seed_plans)
UPDATE public.subscription_plans SET
  name = 'Basic',
  slug = 'basic',
  description = '1 outlet, 2 user (Owner + Kasir). Cocok untuk usaha kecil.',
  price_monthly = 0,
  outlet_limit = 1,
  member_limit = 2,
  features = '["1 Outlet", "2 User (Owner + Kasir)", "POS Dasar", "Laporan Sederhana"]'::jsonb,
  updated_at = now()
WHERE id = '11111111-1111-1111-1111-111111111101'::uuid;

UPDATE public.subscription_plans SET
  name = 'Pro',
  slug = 'pro',
  description = 'Hingga 3 outlet, 5 user. Multi-outlet & tim kecil.',
  price_monthly = 99000,
  outlet_limit = 3,
  member_limit = 5,
  features = '["3 Outlet", "5 User", "POS Lengkap", "Laporan Lanjutan", "Multi-outlet"]'::jsonb,
  updated_at = now()
WHERE id = '11111111-1111-1111-1111-111111111102'::uuid;

UPDATE public.subscription_plans SET
  name = 'Business',
  slug = 'business',
  description = 'Hingga 10 outlet, 15 user. Untuk usaha berkembang.',
  price_monthly = 249000,
  outlet_limit = 10,
  member_limit = 15,
  features = '["10 Outlet", "15 User", "Semua Fitur Pro", "Accounting", "Prioritas Support"]'::jsonb,
  updated_at = now()
WHERE id = '11111111-1111-1111-1111-111111111103'::uuid;

-- Tambah Enterprise jika belum ada
INSERT INTO public.subscription_plans (id, name, slug, description, price_monthly, outlet_limit, member_limit, features)
VALUES (
  '11111111-1111-1111-1111-111111111104'::uuid,
  'Enterprise',
  'enterprise',
  'Outlet & user tak terbatas. Untuk usaha besar.',
  499000,
  999,
  999,
  '["Unlimited Outlet", "Unlimited User", "Semua Fitur Business", "Dedicated Support"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Seed subscription plans
INSERT INTO public.subscription_plans (id, name, slug, description, price_monthly, outlet_limit, features)
VALUES
  ('11111111-1111-1111-1111-111111111101'::uuid, 'Free', 'free', '1 outlet, fitur dasar', 0, 1, '["1 Outlet", "POS Dasar", "Laporan Sederhana"]'),
  ('11111111-1111-1111-1111-111111111102'::uuid, 'Pro', 'pro', 'Hingga 5 outlet', 99.00, 5, '["5 Outlet", "POS Lengkap", "Laporan Lanjutan", "Multi-user"]'),
  ('11111111-1111-1111-1111-111111111103'::uuid, 'Business', 'business', 'Outlet tak terbatas', 299.00, 999, '["Unlimited Outlet", "Semua Fitur Pro", "Accounting", "Priority Support"]')
ON CONFLICT (id) DO NOTHING;

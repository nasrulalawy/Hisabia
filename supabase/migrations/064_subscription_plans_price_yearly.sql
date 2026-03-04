-- Opsi langganan bulanan atau tahunan: tambah kolom price_yearly
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price_yearly decimal(12,2);

COMMENT ON COLUMN public.subscription_plans.price_yearly IS 'Harga langganan tahunan (opsional). Jika null, tahunan = price_monthly * 12.';

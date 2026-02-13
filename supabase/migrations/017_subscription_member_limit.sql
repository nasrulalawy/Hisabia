-- Tambah member_limit: maksimal user/device dalam organisasi
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS member_limit int NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.subscription_plans.member_limit IS 'Maksimal jumlah member (user) dalam organisasi per paket.';

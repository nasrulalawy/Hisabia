-- Tambah konfigurasi CRUD fitur per paket langganan (level subscription_plans)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS feature_permissions jsonb;

COMMENT ON COLUMN public.subscription_plans.feature_permissions IS
  'Map feature_key -> { can_create, can_read, can_update, can_delete } untuk paket ini.';


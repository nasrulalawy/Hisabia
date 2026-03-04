-- Addon paket mengunci satu fitur (feature_key); tidak pakai CRUD matrix
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS addon_feature_key text;

COMMENT ON COLUMN public.subscription_plans.addon_feature_key IS 'Untuk paket addon (is_addon=true): feature_key yang dibuka addon ini (mis. product_ingredients, bahan).';

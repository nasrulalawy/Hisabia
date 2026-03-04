-- Addon bisa membuka banyak fitur (array feature_key)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS addon_feature_keys jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.subscription_plans.addon_feature_keys IS 'Untuk paket addon: array feature_key yang dibuka (mis. ["bahan", "product_ingredients"]).';

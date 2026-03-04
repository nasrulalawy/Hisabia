-- Kolom untuk kontrol tampilan di landing page + CRUD paket oleh super admin
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS show_on_landing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscription_plans.show_on_landing IS 'Tampilkan paket di section Harga di landing page.';
COMMENT ON COLUMN public.subscription_plans.sort_order IS 'Urutan tampilan (asc).';

-- Super admin boleh insert/update/delete subscription_plans
CREATE POLICY "subscription_plans_insert_saas_owner"
  ON public.subscription_plans FOR INSERT
  WITH CHECK (public.is_saas_owner());

CREATE POLICY "subscription_plans_update_saas_owner"
  ON public.subscription_plans FOR UPDATE
  USING (public.is_saas_owner())
  WITH CHECK (public.is_saas_owner());

CREATE POLICY "subscription_plans_delete_saas_owner"
  ON public.subscription_plans FOR DELETE
  USING (public.is_saas_owner());

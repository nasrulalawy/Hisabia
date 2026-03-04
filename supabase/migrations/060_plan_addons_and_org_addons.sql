-- Paket addon: dijual terpisah, harga ditambah ke paket utama
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS is_addon boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscription_plans.is_addon IS 'True = paket addon; harga bulanan ditambahkan ke paket utama (basic + addon1 + addon2...).';

-- Organisasi bisa punya beberapa addon (di atas paket utama)
CREATE TABLE IF NOT EXISTS public.organization_addon_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, plan_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_addon_plans_org ON public.organization_addon_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_addon_plans_plan ON public.organization_addon_plans(plan_id);

COMMENT ON TABLE public.organization_addon_plans IS 'Addon paket yang aktif per organisasi. Harga total = paket utama (subscriptions.plan_id) + sum(addon price_monthly).';

ALTER TABLE public.organization_addon_plans ENABLE ROW LEVEL SECURITY;

-- Hanya super admin yang boleh insert/update/delete; org members boleh baca addon org sendiri
CREATE POLICY "organization_addon_plans_select_org"
  ON public.organization_addon_plans FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    OR public.is_saas_owner()
  );

CREATE POLICY "organization_addon_plans_insert_saas_owner"
  ON public.organization_addon_plans FOR INSERT
  WITH CHECK (public.is_saas_owner());

CREATE POLICY "organization_addon_plans_delete_saas_owner"
  ON public.organization_addon_plans FOR DELETE
  USING (public.is_saas_owner());

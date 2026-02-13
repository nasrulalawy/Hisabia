-- Pastikan kolom organization_id ada sebelum buat policy (hindari error 42703)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'outlets' AND column_name = 'organization_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outlets') THEN
      ALTER TABLE public.outlets ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'organization_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
      ALTER TABLE public.subscriptions ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'organization_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
      ALTER TABLE public.organization_members ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Helper: user is member of org
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS setof uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = auth.uid();
$$;

-- subscription_plans: public read
CREATE POLICY "subscription_plans_select" ON public.subscription_plans
  FOR SELECT USING (true);

-- profiles: own row only
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- organizations: members only
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT USING (id IN (SELECT user_org_ids()));
CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "organizations_update" ON public.organizations
  FOR UPDATE USING (id IN (SELECT user_org_ids()));

-- organization_members: members of same org
CREATE POLICY "organization_members_select" ON public.organization_members
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "organization_members_insert" ON public.organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "organization_members_update" ON public.organization_members
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

-- outlets: org members only
CREATE POLICY "outlets_select" ON public.outlets
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "outlets_insert" ON public.outlets
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "outlets_update" ON public.outlets
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "outlets_delete" ON public.outlets
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- subscriptions: org members only
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "subscriptions_insert" ON public.subscriptions
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

-- Fix: allow users with valid session (auth.uid()) to create organizations (onboarding).
-- Jangan pakai TO authenticated saja: request dari client pakai anon key + JWT, role bisa anon.
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
CREATE POLICY "organizations_insert" ON public.organizations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

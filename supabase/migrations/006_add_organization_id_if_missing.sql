-- Add organization_id to tables if missing (e.g. tables existed before 001 with different schema).
-- Safe to run anytime: does nothing if public.organizations does not exist yet (run 001 first).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    -- Skip: run 001_schema.sql first to create tables
    NULL;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'outlets' AND column_name = 'organization_id'
    ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outlets') THEN
      ALTER TABLE public.outlets
        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'organization_id'
    ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
      ALTER TABLE public.subscriptions
        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'organization_id'
    ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_members') THEN
      ALTER TABLE public.organization_members
        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

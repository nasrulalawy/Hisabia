-- Subscription plans (read by all; no RLS restrict)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly decimal(12,2) NOT NULL DEFAULT 0,
  outlet_limit int NOT NULL DEFAULT 1,
  features jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Organizations (one per business)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id),
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(slug)
);

-- Organization members (user <-> org with role)
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'cashier', 'member');

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Outlets (per organization)
CREATE TABLE IF NOT EXISTS public.outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  timezone text DEFAULT 'Asia/Jakarta',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Subscriptions (org <-> plan with period and status)
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id)
);

-- Tambah kolom organization_id jika tabel sudah ada tanpa kolom ini (sebelum CREATE INDEX)
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

CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_outlets_organization ON public.outlets(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);

-- Enable RLS on all tenant tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

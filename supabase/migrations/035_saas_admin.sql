-- SaaS Owner: pemilik platform (admin dashboard)
CREATE TABLE IF NOT EXISTS public.saas_owners (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

-- Tambah email pemilik SaaS. Daftar di /register dengan email ini untuk akses /admin.
-- JANGAN simpan password di kode. Buat akun manual via /register.
INSERT INTO public.saas_owners (email) VALUES ('hisabia.com@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- RPC: cek apakah user saat ini adalah SaaS owner
CREATE OR REPLACE FUNCTION public.is_saas_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.saas_owners s ON lower(u.email) = lower(s.email)
    WHERE u.id = auth.uid()
  );
$$;

-- RPC: statistik admin (hanya untuk SaaS owner)
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_count int;
  v_user_count int;
  v_sub_active int;
  v_orders_today int;
  v_revenue_month numeric;
BEGIN
  IF NOT public.is_saas_owner() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT count(*) INTO v_org_count FROM public.organizations;
  SELECT count(DISTINCT user_id) INTO v_user_count FROM public.organization_members;
  SELECT count(*) INTO v_sub_active FROM public.subscriptions WHERE status IN ('active', 'trialing');
  SELECT count(*) INTO v_orders_today FROM public.orders
    WHERE status = 'paid' AND created_at >= date_trunc('day', now());
  SELECT coalesce(sum(total), 0) INTO v_revenue_month FROM public.orders
    WHERE status = 'paid' AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'orgCount', v_org_count,
    'userCount', v_user_count,
    'activeSubscriptions', v_sub_active,
    'ordersToday', v_orders_today,
    'revenueMonth', v_revenue_month
  );
END;
$$;

-- RPC: daftar organisasi untuk admin
CREATE OR REPLACE FUNCTION public.get_admin_organizations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_saas_owner() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC)
  INTO v_result
  FROM (
    SELECT o.id, o.name, o.slug, o.created_at,
      (SELECT count(*) FROM public.organization_members WHERE organization_id = o.id) as member_count,
      (SELECT count(*) FROM public.outlets WHERE organization_id = o.id) as outlet_count,
      s.status as sub_status,
      sp.name as plan_name
    FROM public.organizations o
    LEFT JOIN public.subscriptions s ON s.organization_id = o.id
    LEFT JOIN public.subscription_plans sp ON sp.id = COALESCE(s.plan_id, o.plan_id)
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_saas_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_organizations() TO authenticated;

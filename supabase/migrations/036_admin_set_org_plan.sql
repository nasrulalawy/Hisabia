-- Admin: set paket untuk organisasi (tanpa bayar) — hanya SaaS owner
CREATE OR REPLACE FUNCTION public.admin_set_org_plan(p_org_id uuid, p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_end timestamptz;
BEGIN
  IF NOT public.is_saas_owner() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_org_id IS NULL OR p_plan_id IS NULL THEN
    RETURN jsonb_build_object('error', 'organization_id dan plan_id wajib');
  END IF;

  -- Pastikan org dan plan ada
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RETURN jsonb_build_object('error', 'Organisasi tidak ditemukan');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id) THEN
    RETURN jsonb_build_object('error', 'Paket tidak ditemukan');
  END IF;

  v_period_end := now() + interval '1 year';

  -- Upsert subscription (aktif, 1 tahun)
  INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
  VALUES (p_org_id, p_plan_id, 'active', now(), v_period_end)
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    current_period_start = now(),
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();

  -- Update organizations.plan_id untuk konsistensi
  UPDATE public.organizations SET plan_id = p_plan_id, updated_at = now() WHERE id = p_org_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Update get_admin_organizations: tambah plan_id untuk dropdown
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
      sp.name as plan_name,
      (COALESCE(s.plan_id, o.plan_id))::text as plan_id
    FROM public.organizations o
    LEFT JOIN public.subscriptions s ON s.organization_id = o.id
    LEFT JOIN public.subscription_plans sp ON sp.id = COALESCE(s.plan_id, o.plan_id)
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_org_plan(uuid, uuid) TO authenticated;

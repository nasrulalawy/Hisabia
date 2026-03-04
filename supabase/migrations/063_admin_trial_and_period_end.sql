-- Super admin: atur status subscription (trialing/active) dan tanggal berakhir periode
CREATE OR REPLACE FUNCTION public.admin_set_subscription_trial(
  p_org_id uuid,
  p_status text,
  p_period_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  IF NOT public.is_saas_owner() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'organization_id wajib');
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('trialing', 'active', 'past_due', 'canceled') THEN
    RETURN jsonb_build_object('error', 'status harus trialing, active, past_due, atau canceled');
  END IF;

  IF p_period_end IS NULL THEN
    RETURN jsonb_build_object('error', 'period_end wajib');
  END IF;

  SELECT plan_id INTO v_plan_id FROM public.organizations WHERE id = p_org_id;
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Organisasi tidak ditemukan atau belum punya plan');
  END IF;

  INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
  VALUES (p_org_id, v_plan_id, p_status::public.subscription_status, now(), p_period_end)
  ON CONFLICT (organization_id) DO UPDATE SET
    status = p_status::public.subscription_status,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Tambah sub_period_end ke response get_admin_organizations
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
      s.current_period_end as sub_period_end,
      sp.name as plan_name,
      (COALESCE(s.plan_id, o.plan_id))::text as plan_id
    FROM public.organizations o
    LEFT JOIN public.subscriptions s ON s.organization_id = o.id
    LEFT JOIN public.subscription_plans sp ON sp.id = COALESCE(s.plan_id, o.plan_id)
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_subscription_trial(uuid, text, timestamptz) TO authenticated;

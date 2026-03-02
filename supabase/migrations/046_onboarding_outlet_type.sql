-- Pilihan kategori usaha saat daftar: outlet pertama dibuat dengan outlet_type yang dipilih
-- agar menu/fitur yang muncul sesuai (Mart, F&B, Barbershop, Gudang).

DROP FUNCTION IF EXISTS public.create_organization(text, text, text);

CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text,
  p_slug text DEFAULT NULL,
  p_outlet_name text DEFAULT NULL,
  p_outlet_type text DEFAULT 'mart'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_slug text;
  v_outlet_name text;
  v_outlet_type text;
  v_org_id uuid;
  v_plan_id uuid := '11111111-1111-1111-1111-111111111101'::uuid;
  v_period_end timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  v_slug := COALESCE(trim(p_slug), '') ;
  IF v_slug = '' THEN
    v_slug := lower(regexp_replace(trim(p_name), '\s+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
    v_slug := regexp_replace(v_slug, '-+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
  END IF;
  v_outlet_name := COALESCE(NULLIF(trim(p_outlet_name), ''), trim(p_name), 'Outlet Utama');

  -- Validasi kategori: hanya nilai yang ada di CHECK outlets.outlet_type
  v_outlet_type := COALESCE(NULLIF(trim(lower(p_outlet_type)), ''), 'mart');
  IF v_outlet_type NOT IN ('gudang', 'mart', 'fnb', 'barbershop') THEN
    v_outlet_type := 'mart';
  END IF;

  INSERT INTO public.organizations (name, slug, plan_id)
  VALUES (trim(p_name), v_slug, v_plan_id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  INSERT INTO public.outlets (organization_id, name, is_default, outlet_type)
  VALUES (v_org_id, v_outlet_name, true, v_outlet_type);

  v_period_end := now() + interval '14 days';
  INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
  VALUES (v_org_id, v_plan_id, 'trialing', now(), v_period_end);

  RETURN jsonb_build_object('organizationId', v_org_id);
END;
$$;

COMMENT ON FUNCTION public.create_organization(text, text, text, text) IS 'Buat organisasi + member + outlet pertama (dengan tipe: mart, fnb, barbershop, gudang) + subscription trial.';

-- Grant untuk signature baru (4 argumen)
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text, text) TO authenticated;

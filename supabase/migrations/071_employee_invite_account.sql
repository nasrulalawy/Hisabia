-- Undang karyawan buat akun login (link ke employees + organization_members)
-- Mirip pelanggan invite, plus enforce member_limit paket langganan.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_invite_token
  ON public.employees(invite_token) WHERE invite_token IS NOT NULL;

COMMENT ON COLUMN public.employees.invite_token IS 'Token unik untuk link undangan daftar akun karyawan.';
COMMENT ON COLUMN public.employees.invite_expires_at IS 'Batas waktu link undangan (mis. 7 hari).';

-- Info undangan karyawan (anon + authenticated)
CREATE OR REPLACE FUNCTION public.get_employee_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_org record;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT id, name, email, organization_id, invite_expires_at, user_id, is_active
  INTO v_emp
  FROM public.employees
  WHERE invite_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid atau sudah kadaluarsa');
  END IF;
  IF v_emp.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Akun untuk karyawan ini sudah terhubung');
  END IF;
  IF NOT v_emp.is_active THEN
    RETURN jsonb_build_object('error', 'Karyawan tidak aktif');
  END IF;
  IF v_emp.email IS NULL OR trim(v_emp.email) = '' THEN
    RETURN jsonb_build_object('error', 'Data karyawan tidak memiliki email');
  END IF;
  IF v_emp.invite_expires_at IS NOT NULL AND v_emp.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;

  SELECT id, name INTO v_org FROM public.organizations WHERE id = v_emp.organization_id;

  RETURN jsonb_build_object(
    'email', trim(v_emp.email),
    'employeeName', v_emp.name,
    'orgName', COALESCE(v_org.name, 'Organisasi'),
    'orgId', v_emp.organization_id
  );
END;
$$;

-- Hubungkan akun setelah daftar/login (authenticated)
CREATE OR REPLACE FUNCTION public.link_employee_invite_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_emp record;
  v_member_count int;
  v_member_limit int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT id, name, email, organization_id, invite_expires_at, user_id, is_active
  INTO v_emp
  FROM public.employees
  WHERE invite_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid');
  END IF;

  -- Sudah terhubung ke user yang sama: sukses
  IF v_emp.user_id IS NOT NULL THEN
    IF v_emp.user_id = v_user_id THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_emp.organization_id, v_user_id, 'cashier')
      ON CONFLICT (organization_id, user_id) DO NOTHING;
      RETURN jsonb_build_object('linked', true, 'orgId', v_emp.organization_id);
    END IF;
    RETURN jsonb_build_object('error', 'Akun untuk karyawan ini sudah terhubung');
  END IF;

  IF NOT v_emp.is_active THEN
    RETURN jsonb_build_object('error', 'Karyawan tidak aktif');
  END IF;
  IF v_emp.invite_expires_at IS NOT NULL AND v_emp.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;
  IF v_emp.email IS NULL OR lower(trim(v_emp.email)) <> lower(trim(COALESCE(v_user_email, ''))) THEN
    RETURN jsonb_build_object('error', 'Email akun harus sama dengan email karyawan yang diundang');
  END IF;

  -- Cek apakah user sudah member org ini
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_emp.organization_id AND user_id = v_user_id
  ) THEN
    SELECT count(*)::int INTO v_member_count
    FROM public.organization_members
    WHERE organization_id = v_emp.organization_id;

    SELECT COALESCE(sp.member_limit, 2) INTO v_member_limit
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.organization_id = v_emp.organization_id
    LIMIT 1;

    IF v_member_limit IS NULL THEN
      v_member_limit := 2;
    END IF;

    IF v_member_limit < 999 AND v_member_count >= v_member_limit THEN
      RETURN jsonb_build_object(
        'error',
        'Limit user organisasi tercapai (' || v_member_limit || '). Upgrade paket untuk menambah akun.'
      );
    END IF;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_emp.organization_id, v_user_id, 'cashier');
  END IF;

  UPDATE public.employees
  SET user_id = v_user_id,
      invite_token = NULL,
      invite_expires_at = NULL,
      updated_at = now()
  WHERE id = v_emp.id;

  RETURN jsonb_build_object('linked', true, 'orgId', v_emp.organization_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_invite_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_employee_invite_token(text) TO authenticated;

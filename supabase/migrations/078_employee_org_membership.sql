-- Karyawan dengan akun login harus dianggap member org (RLS + backfill).

CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS setof uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = auth.uid()
  UNION
  SELECT organization_id FROM public.employees
  WHERE user_id = auth.uid() AND is_active = true;
$$;

COMMENT ON FUNCTION public.user_org_ids IS
  'Org IDs yang boleh diakses user: organization_members + karyawan aktif terhubung akun.';

-- Backfill: karyawan sudah punya user_id tapi belum ada baris organization_members
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT e.organization_id, e.user_id, 'cashier'
FROM public.employees e
WHERE e.user_id IS NOT NULL
  AND e.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = e.organization_id AND om.user_id = e.user_id
  )
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Pastikan membership saat login (idempotent)
CREATE OR REPLACE FUNCTION public.ensure_employee_org_membership()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.employees
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'orgId', null);
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'cashier')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'orgId', v_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_employee_org_membership() TO authenticated;

-- Karyawan boleh baca baris employee sendiri (untuk redirect login sebelum backfill)
DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
CREATE POLICY "employees_select_own"
  ON public.employees FOR SELECT
  USING (user_id = auth.uid());

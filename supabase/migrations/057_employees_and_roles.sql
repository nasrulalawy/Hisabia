-- Karyawan & kategori karyawan (semua tipe usaha)
-- Karyawan terhubung ke organisasi (dan opsional outlet), dapat diberi akun login (auth.users),
-- dan dikaitkan ke kategori karyawan yang menentukan hak akses fitur (CRUD per feature_key).

CREATE TABLE IF NOT EXISTS public.employee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.employee_roles IS 'Kategori karyawan per organisasi (Kasir, Driver, Admin Toko, dll).';

ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_roles_all_org_member"
  ON public.employee_roles FOR ALL
  USING (organization_id IN (SELECT user_org_ids()))
  WITH CHECK (organization_id IN (SELECT user_org_ids()));

-- Hak akses per kategori karyawan per fitur (menggunakan feature_key yang sama dengan outlet_feature_permissions)
CREATE TABLE IF NOT EXISTS public.employee_role_feature_permissions (
  employee_role_id uuid NOT NULL REFERENCES public.employee_roles(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  can_create boolean NOT NULL DEFAULT true,
  can_read boolean NOT NULL DEFAULT true,
  can_update boolean NOT NULL DEFAULT true,
  can_delete boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (employee_role_id, feature_key)
);

COMMENT ON TABLE public.employee_role_feature_permissions IS 'Override hak akses fitur per kategori karyawan (CRUD). Bila tidak ada baris = semua diizinkan.';

ALTER TABLE public.employee_role_feature_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_role_feature_permissions_all_org_member"
  ON public.employee_role_feature_permissions FOR ALL
  USING (
    employee_role_id IN (
      SELECT id FROM public.employee_roles
      WHERE organization_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    employee_role_id IN (
      SELECT id FROM public.employee_roles
      WHERE organization_id IN (SELECT user_org_ids())
    )
  );

-- Data karyawan
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_role_id uuid REFERENCES public.employee_roles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.employees IS 'Karyawan organisasi (kasir, driver, admin toko, dll). Bisa dihubungkan ke akun login (auth.users).';

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_all_org_member"
  ON public.employees FOR ALL
  USING (organization_id IN (SELECT user_org_ids()))
  WITH CHECK (organization_id IN (SELECT user_org_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_role_feature_permissions TO authenticated;


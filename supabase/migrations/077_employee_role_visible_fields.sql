-- Field visibility per kategori karyawan per fitur.
-- null = semua field boleh dilihat (default).
-- array string = hanya field_key dalam daftar yang boleh dilihat karyawan.

ALTER TABLE public.employee_role_feature_permissions
  ADD COLUMN IF NOT EXISTS visible_fields jsonb;

COMMENT ON COLUMN public.employee_role_feature_permissions.visible_fields IS
  'Daftar field_key yang boleh dilihat karyawan untuk fitur ini. null = semua field.';

-- Super admin dapat mengatur fitur per outlet (tampil + CRUD) tanpa tergantung paket langganan.
-- Bila tidak ada baris untuk (outlet_id, feature_key), artinya semua aksi diizinkan (backward compat).

CREATE TABLE IF NOT EXISTS public.outlet_feature_permissions (
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  can_create boolean NOT NULL DEFAULT true,
  can_read boolean NOT NULL DEFAULT true,
  can_update boolean NOT NULL DEFAULT true,
  can_delete boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (outlet_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_outlet_feature_permissions_outlet ON public.outlet_feature_permissions(outlet_id);

COMMENT ON TABLE public.outlet_feature_permissions IS 'Override fitur per outlet oleh super admin. Tanpa baris = semua aksi diizinkan.';

ALTER TABLE public.outlet_feature_permissions ENABLE ROW LEVEL SECURITY;

-- Anggota org boleh baca permission outlet milik org mereka (untuk filter menu/aksi di app).
CREATE POLICY "outlet_feature_permissions_select_org_member"
  ON public.outlet_feature_permissions FOR SELECT
  USING (
    outlet_id IN (
      SELECT id FROM public.outlets
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- Hanya SaaS owner yang boleh insert/update/delete.
CREATE POLICY "outlet_feature_permissions_all_saas_owner"
  ON public.outlet_feature_permissions FOR ALL
  USING (public.is_saas_owner())
  WITH CHECK (public.is_saas_owner());

-- RPC: daftar outlet suatu org (untuk admin)
CREATE OR REPLACE FUNCTION public.get_admin_outlets(p_org_id uuid)
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

  SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.is_default DESC, t.created_at)
  INTO v_result
  FROM (
    SELECT id, name, outlet_type, is_default, created_at
    FROM public.outlets
    WHERE organization_id = p_org_id
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_outlets(uuid) TO authenticated;

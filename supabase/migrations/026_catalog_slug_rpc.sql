-- Update RPCs to use catalog_slug when set (untuk URL katalog custom)
-- get_invite_by_token: return catalogPath (slug or org_id)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust record;
  v_org record;
  v_catalog_path text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT id, email, organization_id, invite_expires_at, user_id
  INTO v_cust
  FROM public.customers
  WHERE invite_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid atau sudah kadaluarsa');
  END IF;
  IF v_cust.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Akun untuk pelanggan ini sudah terhubung');
  END IF;
  IF v_cust.email IS NULL OR trim(v_cust.email) = '' THEN
    RETURN jsonb_build_object('error', 'Data pelanggan tidak memiliki email');
  END IF;
  IF v_cust.invite_expires_at IS NOT NULL AND v_cust.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;

  SELECT id, name INTO v_org FROM public.organizations WHERE id = v_cust.organization_id;
  SELECT COALESCE(NULLIF(trim(catalog_slug), ''), v_cust.organization_id::text)
  INTO v_catalog_path
  FROM public.organizations
  WHERE id = v_cust.organization_id;

  RETURN jsonb_build_object(
    'email', trim(v_cust.email),
    'orgName', COALESCE(v_org.name, 'Toko'),
    'catalogPath', v_catalog_path,
    'orgId', v_cust.organization_id
  );
END;
$$;

-- link_invite_token: return catalogPath (slug or org_id) for redirect
CREATE OR REPLACE FUNCTION public.link_invite_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_cust record;
  v_org record;
  v_catalog_path text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token diperlukan');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT id, email, organization_id, invite_expires_at, user_id
  INTO v_cust
  FROM public.customers
  WHERE invite_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link undangan tidak valid');
  END IF;
  IF v_cust.user_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(catalog_slug), ''), v_cust.organization_id::text) INTO v_catalog_path
    FROM public.organizations WHERE id = v_cust.organization_id;
    RETURN jsonb_build_object('linked', true, 'catalogPath', v_catalog_path);
  END IF;
  IF v_cust.invite_expires_at IS NOT NULL AND v_cust.invite_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Link undangan sudah kadaluarsa');
  END IF;
  IF lower(trim(v_cust.email)) <> lower(trim(v_user_email)) THEN
    RETURN jsonb_build_object('error', 'Email akun harus sama dengan email pelanggan yang diundang');
  END IF;

  UPDATE public.customers
  SET user_id = v_user_id, invite_token = NULL, invite_expires_at = NULL, updated_at = now()
  WHERE id = v_cust.id;

  SELECT COALESCE(NULLIF(trim(catalog_slug), ''), v_cust.organization_id::text) INTO v_catalog_path
  FROM public.organizations WHERE id = v_cust.organization_id;
  RETURN jsonb_build_object('linked', true, 'catalogPath', v_catalog_path);
END;
$$;

-- Kredit Syariah: fitur untuk mart, hanya terbuka jika super admin memberi izin.
-- 1) Izin per organisasi (hanya super admin yang bisa set)
-- 2) Akad pembiayaan (tanpa bunga): nilai, tenor, angsuran
-- 3) Pencatatan angsuran (pembayaran cicilan)

-- Tabel izin fitur per organisasi (opt-in oleh super admin)
CREATE TABLE IF NOT EXISTS public.organization_feature_grants (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  granted_at timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_org_feature_grants_org ON public.organization_feature_grants(organization_id);

COMMENT ON TABLE public.organization_feature_grants IS 'Fitur yang diizinkan untuk organisasi oleh super admin. Contoh: kredit_syariah (hanya mart yang diizinkan).';

ALTER TABLE public.organization_feature_grants ENABLE ROW LEVEL SECURITY;

-- Anggota org boleh baca grant org mereka; super admin boleh baca semua (untuk admin UI)
CREATE POLICY "organization_feature_grants_select"
  ON public.organization_feature_grants FOR SELECT
  USING (
    organization_id IN (SELECT user_org_ids())
    OR public.is_saas_owner()
  );

-- Hanya SaaS owner yang boleh insert/delete (beri/cabut izin)
CREATE POLICY "organization_feature_grants_insert_saas_owner"
  ON public.organization_feature_grants FOR INSERT
  WITH CHECK (public.is_saas_owner());

CREATE POLICY "organization_feature_grants_delete_saas_owner"
  ON public.organization_feature_grants FOR DELETE
  USING (public.is_saas_owner());

-- Akad Kredit Syariah (kontrak pembiayaan tanpa bunga)
CREATE TABLE IF NOT EXISTS public.kredit_syariah_akad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  total_amount decimal(12,2) NOT NULL CHECK (total_amount > 0),
  tenor_bulan int NOT NULL CHECK (tenor_bulan > 0),
  angsuran_per_bulan decimal(12,2) NOT NULL CHECK (angsuran_per_bulan > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'aktif', 'lunas', 'macet')),
  tanggal_mulai date,
  tanggal_jatuh_tempo date,
  catatan text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kredit_syariah_akad_org ON public.kredit_syariah_akad(organization_id);
CREATE INDEX IF NOT EXISTS idx_kredit_syariah_akad_customer ON public.kredit_syariah_akad(customer_id);
CREATE INDEX IF NOT EXISTS idx_kredit_syariah_akad_status ON public.kredit_syariah_akad(status);

COMMENT ON TABLE public.kredit_syariah_akad IS 'Akad pembiayaan syariah (murabahah/qard): cicilan tanpa bunga.';

ALTER TABLE public.kredit_syariah_akad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kredit_syariah_akad_all_org_member"
  ON public.kredit_syariah_akad FOR ALL
  USING (organization_id IN (SELECT user_org_ids()))
  WITH CHECK (organization_id IN (SELECT user_org_ids()));

-- Angsuran (pembayaran cicilan)
CREATE TABLE IF NOT EXISTS public.kredit_syariah_angsuran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  akad_id uuid NOT NULL REFERENCES public.kredit_syariah_akad(id) ON DELETE CASCADE,
  jumlah_bayar decimal(12,2) NOT NULL CHECK (jumlah_bayar > 0),
  tanggal_bayar date NOT NULL,
  metode_bayar text DEFAULT 'tunai',
  catatan text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kredit_syariah_angsuran_akad ON public.kredit_syariah_angsuran(akad_id);

COMMENT ON TABLE public.kredit_syariah_angsuran IS 'Pencatatan pembayaran angsuran per akad.';

ALTER TABLE public.kredit_syariah_angsuran ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kredit_syariah_angsuran_via_akad"
  ON public.kredit_syariah_angsuran FOR ALL
  USING (
    akad_id IN (
      SELECT id FROM public.kredit_syariah_akad
      WHERE organization_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    akad_id IN (
      SELECT id FROM public.kredit_syariah_akad
      WHERE organization_id IN (SELECT user_org_ids())
    )
  );

-- Trigger: update akad.updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kredit_syariah_akad_updated_at ON public.kredit_syariah_akad;
CREATE TRIGGER kredit_syariah_akad_updated_at
  BEFORE UPDATE ON public.kredit_syariah_akad
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC: hitung total sudah dibayar per akad (bisa dipanggil dari app atau view)
-- App bisa pakai sum(angsuran.jumlah_bayar) saja.

GRANT SELECT ON public.organization_feature_grants TO authenticated;
GRANT INSERT, DELETE ON public.organization_feature_grants TO authenticated;
GRANT ALL ON public.kredit_syariah_akad TO authenticated;
GRANT ALL ON public.kredit_syariah_angsuran TO authenticated;

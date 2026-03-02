-- Link jurnal ke transaksi sumber (hindari double post)
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid;

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON public.journal_entries(reference_type, reference_id);

-- Tambah akun 4-2 Pendapatan Lain ke seed (untuk arus kas masuk non-penjualan)
CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE organization_id = p_org_id LIMIT 1) THEN
    RETURN;
  END IF;
  INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, is_system, sort_order) VALUES
    (p_org_id, '1', 'Aset', 'asset', true, 100),
    (p_org_id, '1-1', 'Kas', 'asset', true, 110),
    (p_org_id, '1-2', 'Piutang Usaha', 'asset', true, 120),
    (p_org_id, '1-3', 'Persediaan', 'asset', true, 130),
    (p_org_id, '2', 'Kewajiban', 'liability', true, 200),
    (p_org_id, '2-1', 'Hutang Usaha', 'liability', true, 210),
    (p_org_id, '3', 'Ekuitas', 'equity', true, 300),
    (p_org_id, '3-1', 'Modal', 'equity', true, 310),
    (p_org_id, '3-2', 'Laba Ditahan', 'equity', true, 320),
    (p_org_id, '4', 'Pendapatan', 'revenue', true, 400),
    (p_org_id, '4-1', 'Penjualan', 'revenue', true, 410),
    (p_org_id, '4-2', 'Pendapatan Lain', 'revenue', true, 420),
    (p_org_id, '5', 'Beban', 'expense', true, 500),
    (p_org_id, '5-1', 'HPP', 'expense', true, 510),
    (p_org_id, '5-2', 'Beban Operasional', 'expense', true, 520);
END;
$$;

-- Untuk org yang sudah punya COA tapi belum punya 4-2, insert 4-2 saja (idempotent)
INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, is_system, sort_order)
SELECT id, '4-2', 'Pendapatan Lain', 'revenue', true, 420
FROM public.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts c WHERE c.organization_id = organizations.id AND c.code = '4-2'
);

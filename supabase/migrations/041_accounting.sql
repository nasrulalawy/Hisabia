-- Akuntansi: Buku Besar, Neraca, Laporan Laba Rugi, Jurnal Umum
-- Chart of Accounts (COA)
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  is_system boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_org ON public.chart_of_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent ON public.chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON public.chart_of_accounts(organization_id, account_type);

-- Jurnal Umum (header)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  number text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON public.journal_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(organization_id, entry_date DESC);

-- Jurnal Umum (detail: debit/kredit per akun)
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit decimal(12,2) NOT NULL DEFAULT 0,
  credit decimal(12,2) NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz DEFAULT now(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON public.journal_entry_lines(account_id);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS: org member can access
CREATE POLICY chart_of_accounts_org ON public.chart_of_accounts
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );
CREATE POLICY journal_entries_org ON public.journal_entries
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );
CREATE POLICY journal_entry_lines_via_entry ON public.journal_entry_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      JOIN public.organization_members om ON om.organization_id = je.organization_id AND om.user_id = auth.uid()
      WHERE je.id = journal_entry_lines.journal_entry_id
    )
  );

-- Seed default COA (dipakai saat org pertama kali punya akses accounting)
-- Dipanggil dari app saat COA kosong, atau kita bisa trigger. Di sini hanya struktur.
-- Seed dilakukan lewat RPC atau app; untuk kemudahan kita buat fungsi seed per org.
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
    (p_org_id, '5', 'Beban', 'expense', true, 500),
    (p_org_id, '5-1', 'HPP', 'expense', true, 510),
    (p_org_id, '5-2', 'Beban Operasional', 'expense', true, 520);
END;
$$;

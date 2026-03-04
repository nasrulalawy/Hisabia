-- ========== FITUR 1: ASET TETAP + PENYUSUTAN ==========
-- Tambah akun COA untuk aset tetap (untuk org yang sudah punya COA)
INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, is_system, sort_order)
SELECT o.id, '1-4', 'Aset Tetap', 'asset', true, 140
FROM public.organizations o
WHERE EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.organization_id = o.id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.organization_id = o.id AND c.code = '1-4');
INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, is_system, sort_order)
SELECT o.id, '1-5', 'Akumulasi Penyusutan', 'asset', true, 150
FROM public.organizations o
WHERE EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.organization_id = o.id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.organization_id = o.id AND c.code = '1-5');
INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, is_system, sort_order)
SELECT o.id, '5-3', 'Beban Penyusutan', 'expense', true, 530
FROM public.organizations o
WHERE EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.organization_id = o.id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.chart_of_accounts c WHERE c.organization_id = o.id AND c.code = '5-3');

-- Update seed_chart_of_accounts agar org baru dapat ketiga akun ini
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
    (p_org_id, '1-4', 'Aset Tetap', 'asset', true, 140),
    (p_org_id, '1-5', 'Akumulasi Penyusutan', 'asset', true, 150),
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
    (p_org_id, '5-2', 'Beban Operasional', 'expense', true, 520),
    (p_org_id, '5-3', 'Beban Penyusutan', 'expense', true, 530);
END;
$$;

-- Tabel aset tetap
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  purchase_date date NOT NULL,
  purchase_value decimal(12,2) NOT NULL CHECK (purchase_value >= 0),
  residual_value decimal(12,2) NOT NULL DEFAULT 0 CHECK (residual_value >= 0),
  useful_life_months int NOT NULL CHECK (useful_life_months > 0),
  depreciation_method text NOT NULL DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line')),
  account_asset_code text NOT NULL DEFAULT '1-4',
  account_accumulated_code text NOT NULL DEFAULT '1-5',
  account_expense_code text NOT NULL DEFAULT '5-3',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'disposed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_org ON public.fixed_assets(organization_id);

-- Riwayat penyusutan per bulan (satu baris per aset per bulan)
CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_date date NOT NULL,
  amount decimal(12,2) NOT NULL CHECK (amount >= 0),
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(fixed_asset_id, period_date)
);

CREATE INDEX IF NOT EXISTS idx_fixed_asset_depreciations_asset ON public.fixed_asset_depreciations(fixed_asset_id);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_asset_depreciations ENABLE ROW LEVEL SECURITY;

CREATE POLICY fixed_assets_org ON public.fixed_assets
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY fixed_asset_depreciations_via_asset ON public.fixed_asset_depreciations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.fixed_assets fa
      JOIN public.organization_members om ON om.organization_id = fa.organization_id AND om.user_id = auth.uid()
      WHERE fa.id = fixed_asset_depreciations.fixed_asset_id
    )
  );

-- Hitung penyusutan bulanan (garis lurus): (nilai_perolehan - nilai_sisa) / umur_bulan
-- Jalankan per periode (bulan). Buat jurnal: Beban Penyusutan (D) / Akumulasi Penyusutan (K)
CREATE OR REPLACE FUNCTION public.run_fixed_asset_depreciation(p_org_id uuid, p_period_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset record;
  v_monthly_amount decimal(12,2);
  v_period_first date;
  v_dep_count int := 0;
  v_journal_id uuid;
  v_entry_number text;
  v_expense_account_id uuid;
  v_accumulated_account_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_period_first := date_trunc('month', p_period_date)::date;

  FOR v_asset IN
    SELECT fa.id, fa.code, fa.name, fa.purchase_date, fa.purchase_value, fa.residual_value, fa.useful_life_months,
           fa.account_asset_code, fa.account_accumulated_code, fa.account_expense_code
    FROM public.fixed_assets fa
    WHERE fa.organization_id = p_org_id AND fa.status = 'active'
      AND fa.purchase_date <= v_period_first
      AND (fa.purchase_date + (fa.useful_life_months || ' months')::interval)::date > v_period_first
      AND NOT EXISTS (SELECT 1 FROM public.fixed_asset_depreciations fad WHERE fad.fixed_asset_id = fa.id AND fad.period_date = v_period_first)
  LOOP
    v_monthly_amount := round(((v_asset.purchase_value - v_asset.residual_value) / v_asset.useful_life_months)::numeric, 2);
    IF v_monthly_amount <= 0 THEN
      CONTINUE;
    END IF;

    SELECT (SELECT id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND code = v_asset.account_expense_code LIMIT 1),
           (SELECT id FROM public.chart_of_accounts WHERE organization_id = p_org_id AND code = v_asset.account_accumulated_code LIMIT 1)
    INTO v_expense_account_id, v_accumulated_account_id;

    IF v_expense_account_id IS NULL OR v_accumulated_account_id IS NULL THEN
      CONTINUE;
    END IF;

    v_entry_number := (SELECT public.get_next_journal_number(p_org_id, v_period_first));

    INSERT INTO public.journal_entries (organization_id, entry_date, number, description, reference_type, reference_id)
    VALUES (p_org_id, v_period_first, v_entry_number, 'Penyusutan: ' || v_asset.name, 'fixed_asset_depreciation', v_asset.id)
    RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    VALUES
      (v_journal_id, v_expense_account_id, v_monthly_amount, 0, v_asset.code),
      (v_journal_id, v_accumulated_account_id, 0, v_monthly_amount, v_asset.code);

    INSERT INTO public.fixed_asset_depreciations (fixed_asset_id, period_date, amount, journal_entry_id)
    VALUES (v_asset.id, v_period_first, v_monthly_amount, v_journal_id);

    v_dep_count := v_dep_count + 1;
  END LOOP;

  RETURN jsonb_build_object('depreciations_created', v_dep_count, 'period', v_period_first);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_fixed_asset_depreciation(uuid, date) TO authenticated;

-- Shift kasir: wajib buka shift sebelum transaksi POS
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  initial_cash decimal(12,2) NOT NULL DEFAULT 0,
  end_cash decimal(12,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_outlet ON public.shifts(outlet_id);
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at ON public.shifts(opened_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_outlet_active ON public.shifts(outlet_id) WHERE closed_at IS NULL;

COMMENT ON TABLE public.shifts IS 'Shift kasir per outlet. Satu shift aktif per outlet (closed_at IS NULL).';
COMMENT ON COLUMN public.shifts.initial_cash IS 'Modal awal kasir saat buka shift.';
COMMENT ON COLUMN public.shifts.end_cash IS 'Saldo kas saat tutup shift.';

-- Orders: link ke shift
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shift ON public.orders(shift_id);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- shifts: org members
CREATE POLICY "shifts_select" ON public.shifts
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "shifts_insert" ON public.shifts
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "shifts_update" ON public.shifts
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "shifts_delete" ON public.shifts
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

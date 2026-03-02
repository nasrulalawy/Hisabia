-- Nomor jurnal otomatis per periode (YYYY-MM). Tidak mengubah atau menghapus data lama.
CREATE TABLE IF NOT EXISTS public.journal_entry_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  next_value int NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, period)
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_sequences_org ON public.journal_entry_sequences(organization_id);

ALTER TABLE public.journal_entry_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entry_sequences_select"
  ON public.journal_entry_sequences FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "journal_entry_sequences_insert"
  ON public.journal_entry_sequences FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "journal_entry_sequences_update"
  ON public.journal_entry_sequences FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Alokasi nomor berikutnya (thread-safe). Return format: JU-YYYY-MM-00001
CREATE OR REPLACE FUNCTION public.get_next_journal_number(p_org_id uuid, p_entry_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text;
  v_next int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  v_period := to_char(p_entry_date, 'YYYY-MM');
  INSERT INTO public.journal_entry_sequences (organization_id, period, next_value, updated_at)
  VALUES (p_org_id, v_period, 1, now())
  ON CONFLICT (organization_id, period) DO UPDATE
  SET next_value = public.journal_entry_sequences.next_value + 1,
      updated_at = now()
  RETURNING next_value INTO v_next;
  RETURN 'JU-' || v_period || '-' || lpad(v_next::text, 5, '0');
END;
$$;

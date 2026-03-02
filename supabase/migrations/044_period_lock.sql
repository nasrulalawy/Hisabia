-- Tutup buku: kunci periode agar jurnal tidak bisa diubah/dihapus. Tidak menghapus data.
CREATE TABLE IF NOT EXISTS public.period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  locked_at timestamptz DEFAULT now(),
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(organization_id, period)
);

CREATE INDEX IF NOT EXISTS idx_period_locks_org ON public.period_locks(organization_id);

ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "period_locks_select" ON public.period_locks FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "period_locks_insert" ON public.period_locks FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "period_locks_delete" ON public.period_locks FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Cek apakah periode terkunci (untuk dipanggil dari app)
CREATE OR REPLACE FUNCTION public.is_period_locked(p_org_id uuid, p_period text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.period_locks
    WHERE organization_id = p_org_id AND period = p_period
  );
$$;

-- Trigger: tolak insert/update/delete jurnal jika periodenya terkunci
CREATE OR REPLACE FUNCTION public.check_journal_period_not_locked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text;
  v_org_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
    v_period := to_char(OLD.entry_date, 'YYYY-MM');
  ELSIF TG_OP = 'INSERT' THEN
    v_org_id := NEW.organization_id;
    v_period := to_char(NEW.entry_date, 'YYYY-MM');
  ELSE
    v_org_id := NEW.organization_id;
    v_period := to_char(NEW.entry_date, 'YYYY-MM');
  END IF;
  IF EXISTS (SELECT 1 FROM public.period_locks WHERE organization_id = v_org_id AND period = v_period) THEN
    RAISE EXCEPTION 'Periode % sudah ditutup. Jurnal tidak dapat ditambah atau diubah.', v_period;
  END IF;
  IF TG_OP = 'UPDATE' AND to_char(OLD.entry_date, 'YYYY-MM') <> v_period THEN
    IF EXISTS (SELECT 1 FROM public.period_locks WHERE organization_id = v_org_id AND period = to_char(OLD.entry_date, 'YYYY-MM')) THEN
      RAISE EXCEPTION 'Periode lama sudah ditutup. Jurnal tidak dapat diubah.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS journal_entries_period_lock ON public.journal_entries;
CREATE TRIGGER journal_entries_period_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_journal_period_not_locked();

-- RPC untuk kunci/buka periode (dari app)
CREATE OR REPLACE FUNCTION public.lock_period(p_org_id uuid, p_period text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.period_locks (organization_id, period, locked_by)
  VALUES (p_org_id, p_period, auth.uid())
  ON CONFLICT (organization_id, period) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_period(p_org_id uuid, p_period text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.period_locks WHERE organization_id = p_org_id AND period = p_period;
END;
$$;

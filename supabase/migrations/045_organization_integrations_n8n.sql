-- Integrasi n8n: API key (untuk n8n memanggil Hisabia) dan webhook URL (untuk Hisabia mengirim event ke n8n)
CREATE TABLE IF NOT EXISTS public.organization_integrations (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key text,
  n8n_webhook_url text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_integrations_api_key ON public.organization_integrations(api_key) WHERE api_key IS NOT NULL;

ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_integrations_select"
  ON public.organization_integrations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organization_integrations_update"
  ON public.organization_integrations FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "organization_integrations_insert"
  ON public.organization_integrations FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

COMMENT ON TABLE public.organization_integrations IS 'API key dan webhook n8n per organisasi. API key dipakai n8n untuk memanggil API Hisabia; webhook URL dipakai Hisabia untuk mengirim event ke n8n.';

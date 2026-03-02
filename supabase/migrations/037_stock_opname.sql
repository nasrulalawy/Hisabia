-- Stock Opname: session + lines. Tidak ada DELETE; hanya INSERT dan UPDATE (status draft → finalized).

CREATE TABLE IF NOT EXISTS public.stock_opname_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  finalized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_stock_opname_sessions_org ON public.stock_opname_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_sessions_status ON public.stock_opname_sessions(status);

COMMENT ON TABLE public.stock_opname_sessions IS 'Sesi stock opname. warehouse_id NULL = stok toko. Tidak ada data yang dihapus.';

CREATE TABLE IF NOT EXISTS public.stock_opname_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_session_id uuid NOT NULL REFERENCES public.stock_opname_sessions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  system_qty decimal(12,2) NOT NULL,
  physical_qty decimal(12,2),
  adjustment_qty decimal(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(opname_session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_opname_lines_session ON public.stock_opname_lines(opname_session_id);

ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_lines ENABLE ROW LEVEL SECURITY;

-- RLS: hanya SELECT, INSERT, UPDATE. Tidak ada policy DELETE agar data tidak terhapus.
CREATE POLICY "stock_opname_sessions_select" ON public.stock_opname_sessions
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "stock_opname_sessions_insert" ON public.stock_opname_sessions
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "stock_opname_sessions_update" ON public.stock_opname_sessions
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "stock_opname_lines_select" ON public.stock_opname_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stock_opname_sessions s
      WHERE s.id = opname_session_id AND s.organization_id IN (SELECT user_org_ids())
    )
  );
CREATE POLICY "stock_opname_lines_insert" ON public.stock_opname_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_opname_sessions s
      WHERE s.id = opname_session_id AND s.organization_id IN (SELECT user_org_ids())
    )
  );
CREATE POLICY "stock_opname_lines_update" ON public.stock_opname_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.stock_opname_sessions s
      WHERE s.id = opname_session_id AND s.organization_id IN (SELECT user_org_ids())
    )
  );

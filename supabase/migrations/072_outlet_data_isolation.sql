-- Isolasi data per outlet: tambah outlet_id pada hutang/piutang & dokumen penjualan
-- Agar cabang tidak melihat transaksi outlet pusat / cabang lain.

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_outlet ON public.receivables(outlet_id);
CREATE INDEX IF NOT EXISTS idx_payables_outlet ON public.payables(outlet_id);

COMMENT ON COLUMN public.receivables.outlet_id IS 'Outlet pemilik piutang (isolasi antar cabang).';
COMMENT ON COLUMN public.payables.outlet_id IS 'Outlet pemilik hutang (isolasi antar cabang).';

-- Backfill piutang dari order terkait
UPDATE public.receivables r
SET outlet_id = o.outlet_id
FROM public.orders o
WHERE r.order_id = o.id
  AND r.outlet_id IS NULL
  AND o.outlet_id IS NOT NULL;

-- Dokumen penjualan
ALTER TABLE public.sales_quotes
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

ALTER TABLE public.sales_deliveries
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_quotes_outlet ON public.sales_quotes(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_outlet ON public.sales_invoices(outlet_id);
CREATE INDEX IF NOT EXISTS idx_sales_deliveries_outlet ON public.sales_deliveries(outlet_id);

-- Backfill dokumen penjualan ke outlet default org (jika belum ada)
UPDATE public.sales_quotes sq
SET outlet_id = o.id
FROM public.outlets o
WHERE sq.organization_id = o.organization_id
  AND o.is_default = true
  AND sq.outlet_id IS NULL;

UPDATE public.sales_invoices si
SET outlet_id = o.id
FROM public.outlets o
WHERE si.organization_id = o.organization_id
  AND o.is_default = true
  AND si.outlet_id IS NULL;

UPDATE public.sales_deliveries sd
SET outlet_id = o.id
FROM public.outlets o
WHERE sd.organization_id = o.organization_id
  AND o.is_default = true
  AND sd.outlet_id IS NULL;

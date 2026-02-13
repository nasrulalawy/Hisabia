-- Jenis outlet: gudang (hanya fitur gudang), mart (POS, dll), fnb, barbershop, dll
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS outlet_type text NOT NULL DEFAULT 'mart'
  CHECK (outlet_type IN ('gudang', 'mart', 'fnb', 'barbershop'));

COMMENT ON COLUMN public.outlets.outlet_type IS 'gudang: hanya fitur gudang. mart/fnb/barbershop: POS, penjualan, dll';

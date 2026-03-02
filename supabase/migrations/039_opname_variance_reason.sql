-- Penyebab selisih opname per baris: hilang, rusak, kadaluarsa, lebih, lainnya (tidak ada data dihapus).
ALTER TABLE public.stock_opname_lines
  ADD COLUMN IF NOT EXISTS variance_reason text;

COMMENT ON COLUMN public.stock_opname_lines.variance_reason IS 'Penyebab selisih: hilang, rusak, kadaluarsa, lebih, lainnya';

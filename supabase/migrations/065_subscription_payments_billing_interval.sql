-- Simpan periode yang dibayar (bulanan/tahunan) agar webhook bisa set current_period_end benar
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'monthly';

COMMENT ON COLUMN public.subscription_payments.billing_interval IS 'monthly = +1 bulan periode; yearly = +1 tahun periode.';

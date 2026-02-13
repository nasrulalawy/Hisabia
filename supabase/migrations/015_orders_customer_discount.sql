-- orders: customer (opsional) dan diskon
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount decimal(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);

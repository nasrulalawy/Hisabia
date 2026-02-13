-- Pembayaran subscription via Midtrans
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  order_id text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  midtrans_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_org ON public.subscription_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_order ON public.subscription_payments(order_id);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Server (service role) bypass RLS untuk insert/update. Member hanya bisa select.
CREATE POLICY "subscription_payments_select" ON public.subscription_payments
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

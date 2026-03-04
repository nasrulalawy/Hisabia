-- ========== FITUR 2: PENAWARAN → INVOICE → PENGIRIMAN ==========

-- Sequence numbers untuk penawaran, invoice, surat jalan (per org per bulan)
CREATE TABLE IF NOT EXISTS public.sales_doc_sequences (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('quote', 'invoice', 'delivery')),
  period text NOT NULL,
  next_value int NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, doc_type, period)
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_sequences_org ON public.sales_doc_sequences(organization_id);

-- Penawaran (Sales Quote)
CREATE TABLE IF NOT EXISTS public.sales_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_date date NOT NULL,
  valid_until date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  subtotal decimal(12,2) NOT NULL DEFAULT 0,
  tax decimal(12,2) NOT NULL DEFAULT 0,
  total decimal(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_quotes_org ON public.sales_quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_customer ON public.sales_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_date ON public.sales_quotes(quote_date DESC);

-- Baris penawaran (produk atau deskripsi bebas)
CREATE TABLE IF NOT EXISTS public.sales_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_quote_id uuid NOT NULL REFERENCES public.sales_quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity decimal(12,2) NOT NULL DEFAULT 1,
  unit_price decimal(12,2) NOT NULL DEFAULT 0,
  amount decimal(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_quote_lines_quote ON public.sales_quote_lines(sales_quote_id);

-- Invoice (Faktur)
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number text NOT NULL,
  sales_quote_id uuid REFERENCES public.sales_quotes(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_date date NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'canceled')),
  subtotal decimal(12,2) NOT NULL DEFAULT 0,
  tax decimal(12,2) NOT NULL DEFAULT 0,
  total decimal(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_org ON public.sales_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON public.sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_quote ON public.sales_invoices(sales_quote_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON public.sales_invoices(invoice_date DESC);

-- Baris invoice
CREATE TABLE IF NOT EXISTS public.sales_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity decimal(12,2) NOT NULL DEFAULT 1,
  unit_price decimal(12,2) NOT NULL DEFAULT 0,
  amount decimal(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_invoice ON public.sales_invoice_lines(sales_invoice_id);

-- Pengiriman (Surat Jalan / Delivery)
CREATE TABLE IF NOT EXISTS public.sales_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number text NOT NULL,
  sales_invoice_id uuid NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'delivered')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_deliveries_org ON public.sales_deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_deliveries_invoice ON public.sales_deliveries(sales_invoice_id);

-- Baris pengiriman: per baris invoice, qty yang dikirim di surat jalan ini
CREATE TABLE IF NOT EXISTS public.sales_delivery_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_delivery_id uuid NOT NULL REFERENCES public.sales_deliveries(id) ON DELETE CASCADE,
  sales_invoice_line_id uuid NOT NULL REFERENCES public.sales_invoice_lines(id) ON DELETE CASCADE,
  quantity_delivered decimal(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_delivery_lines_delivery ON public.sales_delivery_lines(sales_delivery_id);

-- RLS
ALTER TABLE public.sales_doc_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_delivery_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_doc_sequences_org ON public.sales_doc_sequences
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY sales_quotes_org ON public.sales_quotes
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY sales_quote_lines_via_quote ON public.sales_quote_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sales_quotes sq
      JOIN public.organization_members om ON om.organization_id = sq.organization_id AND om.user_id = auth.uid()
      WHERE sq.id = sales_quote_lines.sales_quote_id
    )
  );

CREATE POLICY sales_invoices_org ON public.sales_invoices
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY sales_invoice_lines_via_invoice ON public.sales_invoice_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sales_invoices si
      JOIN public.organization_members om ON om.organization_id = si.organization_id AND om.user_id = auth.uid()
      WHERE si.id = sales_invoice_lines.sales_invoice_id
    )
  );

CREATE POLICY sales_deliveries_org ON public.sales_deliveries
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY sales_delivery_lines_via_delivery ON public.sales_delivery_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sales_deliveries sd
      JOIN public.organization_members om ON om.organization_id = sd.organization_id AND om.user_id = auth.uid()
      WHERE sd.id = sales_delivery_lines.sales_delivery_id
    )
  );

-- Fungsi nomor urut (format: PQ-YYYY-MM-00001, INV-YYYY-MM-00001, DO-YYYY-MM-00001)
CREATE OR REPLACE FUNCTION public.get_next_sales_doc_number(p_org_id uuid, p_doc_type text, p_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text;
  v_next int;
  v_prefix text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_doc_type NOT IN ('quote', 'invoice', 'delivery') THEN
    RAISE EXCEPTION 'Invalid doc_type';
  END IF;
  v_period := to_char(p_date, 'YYYY-MM');
  v_prefix := CASE p_doc_type WHEN 'quote' THEN 'PQ' WHEN 'invoice' THEN 'INV' WHEN 'delivery' THEN 'DO' END;
  INSERT INTO public.sales_doc_sequences (organization_id, doc_type, period, next_value, updated_at)
  VALUES (p_org_id, p_doc_type, v_period, 1, now())
  ON CONFLICT (organization_id, doc_type, period) DO UPDATE
  SET next_value = public.sales_doc_sequences.next_value + 1,
      updated_at = now()
  RETURNING next_value INTO v_next;
  RETURN v_prefix || '-' || v_period || '-' || lpad(v_next::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_sales_doc_number(uuid, text, date) TO authenticated;

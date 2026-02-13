-- Satuan (unit): pcs, kg, liter, box, dll
CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  symbol text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_org ON public.units(organization_id);

-- Supplier
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(organization_id);

-- Pelanggan (customers)
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(organization_id);

-- Produk: extend concept - link to category, default unit, supplier, stok
-- menu_items stays for POS; we add products as master with multi unit/price
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  default_unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  stock decimal(12,2) NOT NULL DEFAULT 0,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);

-- Multi satuan: konversi per produk (e.g. 1 box = 12 pcs)
CREATE TABLE IF NOT EXISTS public.product_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  conversion_to_base decimal(12,4) NOT NULL DEFAULT 1,
  is_base boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product ON public.product_units(product_id);

-- Multi harga: harga per satuan (retail, grosir, dll)
CREATE TABLE IF NOT EXISTS public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  price decimal(12,2) NOT NULL,
  price_type text DEFAULT 'retail',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_prices_product ON public.product_prices(product_id);

-- Arus kas: transaksi kas masuk/keluar
CREATE TABLE IF NOT EXISTS public.cash_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('in', 'out')),
  amount decimal(12,2) NOT NULL,
  description text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_flows_org ON public.cash_flows(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_created ON public.cash_flows(created_at DESC);

-- Hutang Piutang: piutang (receivable) = kita tagih; hutang (payable) = kita bayar
CREATE TABLE IF NOT EXISTS public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount decimal(12,2) NOT NULL,
  paid decimal(12,2) NOT NULL DEFAULT 0,
  due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receivables_org ON public.receivables(organization_id);

CREATE TABLE IF NOT EXISTS public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  amount decimal(12,2) NOT NULL,
  paid decimal(12,2) NOT NULL DEFAULT 0,
  due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payables_org ON public.payables(organization_id);

-- Gudang: warehouse & stock movement
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  name text NOT NULL,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_org ON public.warehouses(organization_id);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in', 'out', 'adjust')),
  quantity decimal(12,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_org ON public.stock_movements(organization_id);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

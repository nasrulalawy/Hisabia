-- POS: Kategori menu (per outlet atau org-wide jika outlet_id null)
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_org ON public.menu_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_outlet ON public.menu_categories(outlet_id);

-- POS: Item menu
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price decimal(12,2) NOT NULL DEFAULT 0,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_org ON public.menu_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_outlet ON public.menu_items(outlet_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);

-- POS: Order
CREATE TYPE public.order_status AS ENUM ('draft', 'pending', 'paid', 'canceled');

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal decimal(12,2) NOT NULL DEFAULT 0,
  tax decimal(12,2) NOT NULL DEFAULT 0,
  total decimal(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_org ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet ON public.orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- POS: Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  price decimal(12,2) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

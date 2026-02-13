-- Katalog untuk pelanggan (perlu login)
-- catalog_public: org mengizinkan pelanggan login untuk akses katalog
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS catalog_public boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organizations.catalog_public IS 'Jika true, pelanggan yang login dapat akses katalog via /katalog/:orgId';

-- user_id: link customer ke auth user (untuk login pelanggan)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user ON public.customers(user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.customers.user_id IS 'Auth user jika pelanggan sudah login/daftar. Untuk harga dan pesanan per pelanggan.';

-- RLS: pelanggan login bisa baca org yang catalog_public
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT user_org_ids())
    OR (catalog_public = true AND auth.uid() IS NOT NULL)
  );

-- RLS: pelanggan login bisa baca products org catalog_public
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR (
      organization_id IN (SELECT id FROM public.organizations WHERE catalog_public = true)
      AND auth.uid() IS NOT NULL
      AND is_available = true
    )
  );

-- RLS: pelanggan login bisa baca menu_categories
DROP POLICY IF EXISTS "menu_categories_select" ON public.menu_categories;
CREATE POLICY "menu_categories_select" ON public.menu_categories
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR (
      organization_id IN (SELECT id FROM public.organizations WHERE catalog_public = true)
      AND auth.uid() IS NOT NULL
    )
  );

-- RLS: pelanggan login bisa baca units (untuk product_units)
DROP POLICY IF EXISTS "units_select" ON public.units;
CREATE POLICY "units_select" ON public.units
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR (
      organization_id IN (SELECT id FROM public.organizations WHERE catalog_public = true)
      AND auth.uid() IS NOT NULL
    )
  );

-- RLS: pelanggan login bisa baca product_units (via product)
DROP POLICY IF EXISTS "product_units_select" ON public.product_units;
CREATE POLICY "product_units_select" ON public.product_units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_units.product_id
        AND (
          p.organization_id IN (SELECT user_org_ids())
          OR (
            p.organization_id IN (SELECT id FROM public.organizations WHERE catalog_public = true)
            AND auth.uid() IS NOT NULL
          )
        )
    )
  );

-- RLS: pelanggan login bisa baca product_prices
DROP POLICY IF EXISTS "product_prices_select" ON public.product_prices;
CREATE POLICY "product_prices_select" ON public.product_prices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_prices.product_id
        AND (
          p.organization_id IN (SELECT user_org_ids())
          OR (
            p.organization_id IN (SELECT id FROM public.organizations WHERE catalog_public = true)
            AND auth.uid() IS NOT NULL
          )
        )
    )
  );

-- RLS: pelanggan login bisa baca customers (sendiri saja - untuk cocokkan user)
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING (
    organization_id IN (SELECT user_org_ids())
    OR user_id = auth.uid()
  );

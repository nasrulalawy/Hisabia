-- units
CREATE POLICY "units_select" ON public.units FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "units_insert" ON public.units FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "units_update" ON public.units FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "units_delete" ON public.units FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- suppliers
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- customers
CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- products
CREATE POLICY "products_select" ON public.products FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- product_units
CREATE POLICY "product_units_select" ON public.product_units FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_units.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_units_insert" ON public.product_units FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_units.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_units_update" ON public.product_units FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_units.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_units_delete" ON public.product_units FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_units.product_id AND p.organization_id IN (SELECT user_org_ids()))
);

-- product_prices
CREATE POLICY "product_prices_select" ON public.product_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_prices.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_prices_insert" ON public.product_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_prices.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_prices_update" ON public.product_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_prices.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_prices_delete" ON public.product_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_prices.product_id AND p.organization_id IN (SELECT user_org_ids()))
);

-- cash_flows
CREATE POLICY "cash_flows_select" ON public.cash_flows FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "cash_flows_insert" ON public.cash_flows FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "cash_flows_update" ON public.cash_flows FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "cash_flows_delete" ON public.cash_flows FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- receivables
CREATE POLICY "receivables_select" ON public.receivables FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "receivables_insert" ON public.receivables FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "receivables_update" ON public.receivables FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "receivables_delete" ON public.receivables FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- payables
CREATE POLICY "payables_select" ON public.payables FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "payables_insert" ON public.payables FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "payables_update" ON public.payables FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "payables_delete" ON public.payables FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- warehouses
CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "warehouses_delete" ON public.warehouses FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- stock_movements
CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));

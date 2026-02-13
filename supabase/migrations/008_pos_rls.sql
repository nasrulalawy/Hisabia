-- menu_categories: org members
CREATE POLICY "menu_categories_select" ON public.menu_categories
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "menu_categories_insert" ON public.menu_categories
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "menu_categories_update" ON public.menu_categories
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "menu_categories_delete" ON public.menu_categories
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- menu_items: org members
CREATE POLICY "menu_items_select" ON public.menu_items
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "menu_items_insert" ON public.menu_items
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "menu_items_update" ON public.menu_items
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "menu_items_delete" ON public.menu_items
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- orders: org members
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

-- order_items: via order (org members)
CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.organization_id IN (SELECT user_org_ids())
    )
  );
CREATE POLICY "order_items_insert" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.organization_id IN (SELECT user_org_ids())
    )
  );
CREATE POLICY "order_items_update" ON public.order_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.organization_id IN (SELECT user_org_ids())
    )
  );
CREATE POLICY "order_items_delete" ON public.order_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.organization_id IN (SELECT user_org_ids())
    )
  );

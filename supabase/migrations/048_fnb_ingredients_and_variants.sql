-- F&B: Ingredients (bahan baku), produk pakai ingredients untuk HPP, dan variant produk dengan harga per variant.
-- Fitur ini terutama untuk outlet_type = 'fnb', bisa dipakai juga oleh org lain jika perlu.

-- 1) Master Ingredients (per organisasi)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  cost_per_unit decimal(12,4) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_org ON public.ingredients(organization_id);

COMMENT ON TABLE public.ingredients IS 'Bahan baku untuk F&B. Dipakai di product_ingredients untuk hitung HPP.';
COMMENT ON COLUMN public.ingredients.cost_per_unit IS 'Harga per satuan (unit_id) untuk hitung HPP.';

-- 2) Produk bisa pakai ingredients sebagai sumber HPP (recipe/BOM)
CREATE TABLE IF NOT EXISTS public.product_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity decimal(12,4) NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON public.product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient ON public.product_ingredients(ingredient_id);

COMMENT ON TABLE public.product_ingredients IS 'Resep/BOM: jumlah bahan per produk. Quantity dalam satuan ingredient. HPP = sum(ingredient.cost_per_unit * quantity).';

-- 3) Flag di products: pakai HPP dari ingredients (true) atau manual cost_price (false)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS use_ingredients_for_cost boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.use_ingredients_for_cost IS 'True: cost_price dihitung dari product_ingredients. False: pakai cost_price manual.';

-- 4) Variant produk (contoh: Butterscotch Latte, Reguler, Normal Sugar) dengan harga per variant
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  selling_price decimal(12,2),
  cost_price decimal(12,2),
  sort_order int NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

COMMENT ON TABLE public.product_variants IS 'Variant produk F&B (size, rasa, level gula, dll). selling_price/cost_price NULL = pakai dari product.';

-- 5) order_items: bisa mengacu ke variant
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_product_variant ON public.order_items(product_variant_id);

COMMENT ON COLUMN public.order_items.product_variant_id IS 'Variant produk yang dipilih (jika ada). Harga item bisa dari variant.selling_price.';

-- 6) RLS
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredients_select" ON public.ingredients FOR SELECT USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "ingredients_insert" ON public.ingredients FOR INSERT WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "ingredients_update" ON public.ingredients FOR UPDATE USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "ingredients_delete" ON public.ingredients FOR DELETE USING (organization_id IN (SELECT user_org_ids()));

CREATE POLICY "product_ingredients_select" ON public.product_ingredients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_ingredients.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_ingredients_insert" ON public.product_ingredients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_ingredients.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_ingredients_update" ON public.product_ingredients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_ingredients.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_ingredients_delete" ON public.product_ingredients FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_ingredients.product_id AND p.organization_id IN (SELECT user_org_ids()))
);

CREATE POLICY "product_variants_select" ON public.product_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_variants_insert" ON public.product_variants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_variants_update" ON public.product_variants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.organization_id IN (SELECT user_org_ids()))
);
CREATE POLICY "product_variants_delete" ON public.product_variants FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.organization_id IN (SELECT user_org_ids()))
);

-- 7) Hitung HPP produk dari ingredients
CREATE OR REPLACE FUNCTION public.compute_product_hpp_from_ingredients(p_product_id uuid)
RETURNS decimal(12,4)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(i.cost_per_unit * pi.quantity), 0)::decimal(12,4)
  FROM public.product_ingredients pi
  JOIN public.ingredients i ON i.id = pi.ingredient_id
  WHERE pi.product_id = p_product_id;
$$;

COMMENT ON FUNCTION public.compute_product_hpp_from_ingredients(uuid) IS 'HPP produk dari jumlah (ingredient.cost_per_unit * quantity) untuk semua bahan.';

-- 8) Trigger: saat ingredients/product_ingredients berubah, update product.cost_price jika use_ingredients_for_cost = true
CREATE OR REPLACE FUNCTION public.sync_product_cost_from_ingredients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_affected uuid[];
BEGIN
  IF TG_TABLE_NAME = 'product_ingredients' THEN
    IF TG_OP = 'DELETE' THEN
      v_product_id := OLD.product_id;
    ELSE
      v_product_id := NEW.product_id;
    END IF;
    v_affected := array[v_product_id];
  ELSIF TG_TABLE_NAME = 'ingredients' THEN
    SELECT array_agg(DISTINCT product_id) INTO v_affected
    FROM public.product_ingredients WHERE ingredient_id = COALESCE(NEW.id, OLD.id);
    v_affected := COALESCE(v_affected, array[]::uuid[]);
  END IF;

  IF v_affected IS NOT NULL AND array_length(v_affected, 1) > 0 THEN
    UPDATE public.products
    SET cost_price = public.compute_product_hpp_from_ingredients(id),
        updated_at = now()
    WHERE id = ANY(v_affected) AND use_ingredients_for_cost = true;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_cost_after_product_ingredients ON public.product_ingredients;
CREATE TRIGGER trg_sync_product_cost_after_product_ingredients
  AFTER INSERT OR UPDATE OF quantity OR DELETE ON public.product_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_cost_from_ingredients();

DROP TRIGGER IF EXISTS trg_sync_product_cost_after_ingredients ON public.ingredients;
CREATE TRIGGER trg_sync_product_cost_after_ingredients
  AFTER UPDATE OF cost_per_unit ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_cost_from_ingredients();

-- 9) Helper: harga jual efektif (variant atau produk)
CREATE OR REPLACE FUNCTION public.get_product_selling_price(
  p_product_id uuid,
  p_product_variant_id uuid DEFAULT NULL
)
RETURNS decimal(12,2)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pv.selling_price FROM public.product_variants pv
     WHERE pv.id = p_product_variant_id AND pv.product_id = p_product_id AND pv.selling_price IS NOT NULL
     LIMIT 1),
    (SELECT selling_price FROM public.products WHERE id = p_product_id LIMIT 1),
    0
  )::decimal(12,2);
$$;

COMMENT ON FUNCTION public.get_product_selling_price(uuid, uuid) IS 'Harga jual: dari variant jika ada dan tidak null, else dari product.';

-- 10) Helper: HPP efektif (variant atau produk)
CREATE OR REPLACE FUNCTION public.get_product_cost_price(
  p_product_id uuid,
  p_product_variant_id uuid DEFAULT NULL
)
RETURNS decimal(12,2)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pv.cost_price FROM public.product_variants pv
     WHERE pv.id = p_product_variant_id AND pv.product_id = p_product_id AND pv.cost_price IS NOT NULL
     LIMIT 1),
    (SELECT cost_price FROM public.products WHERE id = p_product_id LIMIT 1),
    0
  )::decimal(12,2);
$$;

COMMENT ON FUNCTION public.get_product_cost_price(uuid, uuid) IS 'HPP: dari variant jika ada dan tidak null, else dari product (bisa dari ingredients).';

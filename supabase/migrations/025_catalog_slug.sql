-- URL katalog outlet bisa diset (slug custom), bukan hanya UUID
-- Contoh: /katalog/toko-saya instead of /katalog/550e8400-e29b-41d4-a716-446655440000
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS catalog_slug text UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_catalog_slug
  ON public.organizations (catalog_slug) WHERE catalog_slug IS NOT NULL;

COMMENT ON COLUMN public.organizations.catalog_slug IS 'Slug custom untuk URL katalog. Contoh: toko-saya → /katalog/toko-saya. Kosong = pakai org id.';

-- Variant bisa diatur tampil di label (NiiMBot dll). Yang show_on_label = true bisa dicetak sebagai label terpisah.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS show_on_label boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.product_variants.show_on_label IS 'Jika true, variant muncul sebagai opsi saat cetak label (nama + harga variant).';

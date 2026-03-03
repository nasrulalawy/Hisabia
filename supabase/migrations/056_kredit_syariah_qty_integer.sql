-- Ubah qty produk yang dikredit menjadi bilangan bulat (integer)
-- Sebelumnya decimal(12,2); untuk kredit produk seharusnya jumlah unit utuh.

ALTER TABLE public.kredit_syariah_akad_items
  ALTER COLUMN quantity TYPE integer
  USING CEIL(quantity)::integer,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN quantity SET DEFAULT 1;

ALTER TABLE public.kredit_syariah_akad_items
  DROP CONSTRAINT IF EXISTS kredit_syariah_akad_items_quantity_check;

ALTER TABLE public.kredit_syariah_akad_items
  ADD CONSTRAINT kredit_syariah_akad_items_quantity_check CHECK (quantity > 0);


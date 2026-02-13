-- Stok toko: mart/fnb/barbershop update stok produk langsung tanpa gudang
ALTER TABLE public.stock_movements
  ALTER COLUMN warehouse_id DROP NOT NULL;

COMMENT ON COLUMN public.stock_movements.warehouse_id IS 'Null = stok toko langsung (mart). Terisi = mutasi gudang.';

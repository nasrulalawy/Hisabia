# Supabase setup

1. Buat project di [Supabase Dashboard](https://supabase.com/dashboard).
2. Di **Project Settings > API** copy **Project URL** dan **anon public** key ke `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Jalankan migrasi di **SQL Editor**, **harus berurutan** (001 dulu agar tabel ada):
   - `001_schema.sql` — buat tabel + pastikan kolom organization_id ada
   - `002_rls.sql` — kebijakan RLS
   - `003_trigger_profile.sql` — trigger profil saat signup
   - `004_seed_plans.sql` — data paket subscription
   - `005_fix_organizations_insert_rls.sql` — perbaikan policy buat usaha
   - `007_pos_schema.sql` — tabel POS (menu_categories, menu_items, orders, order_items)
   - `008_pos_rls.sql` — RLS untuk tabel POS
   - `009_master_keuangan_gudang.sql` — units, suppliers, customers, products, cash_flows, receivables, payables, warehouses, stock_movements
   - `010_master_rls.sql` — RLS untuk master
   - `011_products_cost_selling_price.sql` — kolom HPP & harga jual
   - `012_outlet_type.sql` — kolom outlet_type (gudang, mart, fnb, barbershop)
   - `013_stock_movements_warehouse_nullable.sql` — warehouse_id nullable untuk stok toko (mart)
   - `015_orders_customer_discount.sql` — customer_id & discount di orders (untuk POS)
   - `016_order_items_product_unit.sql` — product_id & unit_id di order_items
   - `017_subscription_member_limit.sql` — member_limit di subscription_plans
   - `018_subscription_plans_update.sql` — update paket Basic, Pro, Business, Enterprise
4. (Opsional) Di **Authentication > Providers** pastikan Email enabled; matikan **Confirm email** untuk development.

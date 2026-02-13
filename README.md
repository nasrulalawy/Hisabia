# Hisabia

Accounting & POS untuk segala jenis usaha. PWA dengan **Vite**, React, dan Supabase.

## Fitur

- **Auth**: Daftar, masuk, keluar
- **Onboarding**: Buat usaha + outlet default (via Supabase RPC, tanpa server)
- **Multi-outlet**: Outlet switcher di header
- **Dashboard**: Ringkasan (outlets, subscription, POS)
- **Sidebar**: Navigasi dengan expand/collapse
- **Halaman**: Kategori, Produk, Satuan, Supplier, Pelanggan, POS, Arus Kas, Hutang Piutang, Gudang, Outlets, Subscription (placeholder siap dilengkapi)

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Env**
   - Copy `.env.example` ke `.env.local`
   - Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (dari Supabase Dashboard → Settings → API)

3. **Supabase**
   - Jalankan migrasi SQL di **SQL Editor** (urut): lihat [supabase/README.md](supabase/README.md)

4. **Jalankan**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000). Tidak ada server API; semua fitur (buat usaha, undangan pelanggan, katalog, shop link, order) memakai Supabase RPC.

## Struktur

- `src/pages/` — Home, Login, Register, Onboarding, Logout, OrgLayout, Dashboard, PlaceholderPage
- `src/components/` — layout (Sidebar, Header, OutletSwitcher), ui (Button, Card, Input, Badge)
- `src/lib/` — supabase.ts (client), database.types.ts
- `supabase/migrations/` — Schema, RLS, seed, RPC (pengganti server API)

## Build

```bash
npm run build
npm run preview
```

Production: deploy folder `dist` (static) saja. **Tidak ada server API** — semua logik via Supabase (client + RPC).

## Deploy ke Vercel

Proyek ini **tidak memakai server API**. Cocok untuk deploy frontend-only di Vercel.

1. **Connect** repo ke Vercel (Import Git Repository).
2. **Environment Variables** di Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. Build menjalankan `npm run build` (Vite). Output: static site di `dist/`.

Fitur yang berjalan: buat usaha, undangan pelanggan (daftar & link akun), katalog, shop by link, order. **Fitur WhatsApp** (kirim notifikasi/peringat hutang) tidak tersedia karena membutuhkan server Node.js; tombol/keterangan di app akan menampilkan pesan "tidak tersedia".

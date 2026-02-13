# Hisabia

Accounting & POS untuk segala jenis usaha. PWA dengan **Vite**, React, dan Supabase.

## Fitur

- **Auth**: Daftar, masuk, keluar
- **Onboarding**: Buat usaha + outlet default (via API server)
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
   - Untuk fitur "Buat usaha", isi `SUPABASE_SERVICE_ROLE_KEY` (Service role, secret)

3. **Supabase**
   - Jalankan migrasi SQL di **SQL Editor** (urut): lihat [supabase/README.md](supabase/README.md)

4. **Jalankan**
   - **Client (Vite):**
     ```bash
     npm run dev
     ```
     Buka [http://localhost:3000](http://localhost:3000).
   - **Server (untuk Buat usaha):** Di terminal lain:
     ```bash
     npm run server
     ```
     Server berjalan di http://localhost:3001; Vite proxy mengarahkan `/api` ke sini.

## Struktur

- `src/pages/` — Home, Login, Register, Onboarding, Logout, OrgLayout, Dashboard, PlaceholderPage
- `src/components/` — layout (Sidebar, Header, OutletSwitcher), ui (Button, Card, Input, Badge)
- `src/lib/` — supabase.ts (client), database.types.ts
- `server/index.js` — API create-organization (Supabase service role)
- `supabase/migrations/` — Schema, RLS, seed

## Build

```bash
npm run build
npm run preview
```

Production: deploy folder `dist` (static) dan jalankan `server/` untuk API jika dibutuhkan.

## Deploy ke Vercel (semua di satu project)

**Frontend + API** bisa di-deploy ke Vercel sekaligus (tanpa server terpisah).

1. **Connect** repo ke Vercel (Import Git Repository).
2. **Environment Variables** di Vercel (wajib):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. **Environment Variables** (opsional):
   - `VITE_APP_ORIGIN` atau `APP_ORIGIN` = URL deploy Anda (mis. `https://hisabia.vercel.app`) — untuk link di email/WA.
4. **Jangan** set `VITE_API_URL` — di Vercel, API dan frontend satu domain sehingga request pakai path `/api` saja.
5. Deploy. Build akan jalankan `npm run build` (Vite), dan route `/api/*` ditangani oleh serverless function (Express di `api/[[...path]].js`).

**Catatan:** Modul WhatsApp (`wa-clients.js`) memakai Puppeteer dan **tidak jalan** di Vercel serverless. Fitur kirim WA dari app akan mengembalikan "tidak tersedia"; sisanya (buat usaha, undangan pelanggan, order katalog, shop link) tetap berfungsi.

### Tetap pakai server terpisah (opsional)

Kalau ingin backend di Railway/Render dan frontend di Vercel: set `VITE_API_URL` = URL backend, lalu deploy. Lihat `getApiBase()` di `src/lib/utils.ts`.

# Deploy Edge Function dari Supabase Dashboard (tanpa CLI)

Kalau `supabase functions deploy` tidak bisa di terminal, Anda bisa deploy lewat **Supabase Web Dashboard**.

---

## Langkah 1: Buka Edge Functions

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda (mis. **tmuiumuxxhdjxfssqpmi**)
3. Di sidebar kiri: **Edge Functions**

---

## Langkah 2: Buat / Edit Function

- **Kalau belum ada function `create-subscription-order`:**  
  Klik **"Deploy a new function"** → pilih **"Via Editor"** → nama function: **`create-subscription-order`**

- **Kalau sudah ada:**  
  Klik function **create-subscription-order** → **Edit** / **Update**

---

## Langkah 3: Paste kode

Hapus isi editor, lalu paste **seluruh** isi file:

`supabase/functions/create-subscription-order/index.ts`

(Salin dari file itu di project Anda, atau dari bawah ini.)

---

## Langkah 4: Set environment (Secret)

Function butuh variabel lingkungan. Di halaman function atau di **Project Settings → Edge Functions → Secrets**, tambahkan:

| Name | Value |
|------|--------|
| `MIDTRANS_SERVER_KEY` | Server key Midtrans Anda (dari .env) |
| `MIDTRANS_IS_PRODUCTION` | `false` (sandbox) atau `true` (production) |

**Catatan:** `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` biasanya sudah diset otomatis oleh Supabase. Kalau tidak, tambahkan juga (dari Dashboard → Project Settings → API).

---

## Langkah 5: Deploy

Klik **"Deploy"** / **"Deploy function"**. Tunggu sampai selesai (biasanya 10–30 detik).

---

## Penting: 401 Invalid JWT setelah rotasi JWT key (ECC P-256)

Jika project pakai **JWT Signing Key** baru (ECC P-256) dan Anda dapat **401 Invalid JWT** saat panggil function dari frontend, gateway Edge Functions kadang belum mendukung verifikasi JWT dengan key baru. **Nonaktifkan verifikasi JWT** untuk function ini (aman karena di dalam function kita tetap validasi token dengan `admin.auth.getUser(token)`).

### Tanpa CLI (hanya Dashboard)

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → pilih project Anda.
2. Sidebar kiri: **Edge Functions** → klik function **create-subscription-order**.
3. Buka tab **Details** (atau **Settings** / **Configuration** — tergantung tampilan Dashboard).
4. Cari opsi **"Enforce JWT Verification"** atau **"Verify JWT"**.
5. **Matikan** toggle tersebut (OFF / false).
6. Klik **Save** (jika ada). Tidak perlu deploy ulang hanya untuk pengaturan ini; perubahan berlaku untuk function yang sudah ada.

Setelah itu coba lagi panggil function dari aplikasi (tombol Bayar). Jika toggle tidak muncul di Dashboard, coba refresh halaman atau cek di **Project Settings → Edge Functions** apakah ada pengaturan per-function.

---

## Selesai

Function akan jalan di:

`https://tmuiumuxxhdjxfssqpmi.supabase.co/functions/v1/create-subscription-order`

Aplikasi Anda (yang pakai `VITE_SUPABASE_URL` ke project yang sama) otomatis memanggil URL ini lewat `supabase.functions.invoke('create-subscription-order', ...)`.

---

## Jika function sudah ada dan hanya mau update kode

1. Edge Functions → klik **create-subscription-order**
2. Buka tab **Code** / **Editor**
3. Ganti isi dengan kode terbaru dari `supabase/functions/create-subscription-order/index.ts`
4. Klik **Deploy** / **Save and deploy**

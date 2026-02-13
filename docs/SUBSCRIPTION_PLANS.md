# Paket Subscription Hisabia

## Trial Akun Baru

- **Registrasi baru**: **14 hari trial** (gratis)
- Setelah 14 hari: **wajib berlangganan** paket Basic (Rp 99.000/bulan) untuk melanjutkan
- Aplikasi sepenuhnya berbayar; gratis hanya selama trial
- Banner upgrade akan muncul saat trial berakhir

## Rencana Paket

| Paket | Outlet | User | Harga/bulan | Fitur |
|-------|--------|------|-------------|-------|
| **Basic** | 1 | 2 (Owner + Kasir) | Rp 99.000 | POS Dasar, Laporan Sederhana |
| **Pro** | 3 | 5 | Rp 99.000 | POS Lengkap, Multi-outlet, Laporan Lanjutan |
| **Business** | 10 | 15 | Rp 249.000 | Semua fitur Pro, Accounting, Prioritas Support |
| **Enterprise** | Unlimited | Unlimited | Rp 499.000 | Semua fitur Business, Dedicated Support |

## Aturan

### Basic
- **Rp 99.000/bulan** — paket berbayar setelah trial
- Hanya **1 outlet** — tidak bisa multi-outlet
- Maksimal **2 user** — biasanya Owner (super admin) + Kasir
- Cocok untuk usaha kecil, warung, toko tunggal

### Pro
- Hingga **3 outlet**
- Maksimal **5 user**
- Cocok untuk usaha dengan beberapa cabang

### Business
- Hingga **10 outlet**
- Maksimal **15 user**
- Cocok untuk usaha yang berkembang

### Enterprise
- **Unlimited** outlet & user
- Untuk usaha besar

## Implementasi

- **outlet_limit**: Dibatasi saat tambah outlet di OutletsPage
- **member_limit**: Dibatasi saat invité/daftar member (perlu halaman kelola member)
- Migrasi: `017_subscription_member_limit.sql`, `018_subscription_plans_update.sql`

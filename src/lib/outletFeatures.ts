/**
 * Fitur per outlet: super admin bisa set tampil + CRUD per outlet.
 * Route/href sidebar dipetakan ke feature_key. Bila tidak ada baris permission = semua diizinkan.
 */

export interface OutletFeaturePermission {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export type OutletFeatureKey =
  | "dashboard"
  | "kategori"
  | "produk"
  | "satuan"
  | "supplier"
  | "pelanggan"
  | "pos"
  | "stok_toko"
  | "opname"
  | "dashboard_keuangan"
  | "arus_kas"
  | "hutang_piutang"
  | "jurnal"
  | "neraca_saldo"
  | "buku_besar"
  | "neraca"
  | "laba_rugi"
  | "tutup_buku"
  | "umur_piutang_hutang"
  | "accounting"
  | "pembelian"
  | "stok"
  | "gudang"
  | "outlets"
  | "toko"
  | "integrasi"
  | "subscription"
  | "laporan_harian";

/** Mapping dari href (path sidebar) ke feature_key */
export const ROUTE_TO_FEATURE_KEY: Record<string, OutletFeatureKey> = {
  dashboard: "dashboard",
  kategori: "kategori",
  produk: "produk",
  satuan: "satuan",
  supplier: "supplier",
  pelanggan: "pelanggan",
  pos: "pos",
  "stok-toko": "stok_toko",
  opname: "opname",
  "dashboard-keuangan": "dashboard_keuangan",
  "arus-kas": "arus_kas",
  "hutang-piutang": "hutang_piutang",
  jurnal: "jurnal",
  "neraca-saldo": "neraca_saldo",
  "buku-besar": "buku_besar",
  neraca: "neraca",
  "laba-rugi": "laba_rugi",
  "tutup-buku": "tutup_buku",
  "umur-piutang-hutang": "umur_piutang_hutang",
  accounting: "accounting",
  pembelian: "pembelian",
  stok: "stok",
  gudang: "gudang",
  outlets: "outlets",
  toko: "toko",
  integrasi: "integrasi",
  subscription: "subscription",
  "laporan-harian": "laporan_harian",
};

/** Daftar semua fitur untuk admin UI (key, label) */
export const OUTLET_FEATURE_LIST: { key: OutletFeatureKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "kategori", label: "Kategori" },
  { key: "produk", label: "Produk" },
  { key: "satuan", label: "Satuan" },
  { key: "supplier", label: "Supplier" },
  { key: "pelanggan", label: "Pelanggan" },
  { key: "pos", label: "POS" },
  { key: "stok_toko", label: "Stok Toko" },
  { key: "opname", label: "Stock Opname" },
  { key: "dashboard_keuangan", label: "Dashboard Keuangan" },
  { key: "arus_kas", label: "Arus Kas" },
  { key: "hutang_piutang", label: "Hutang Piutang" },
  { key: "jurnal", label: "Jurnal Umum" },
  { key: "neraca_saldo", label: "Neraca Saldo" },
  { key: "buku_besar", label: "Buku Besar" },
  { key: "neraca", label: "Neraca" },
  { key: "laba_rugi", label: "Laporan Laba Rugi" },
  { key: "tutup_buku", label: "Tutup Buku" },
  { key: "umur_piutang_hutang", label: "Umur Piutang & Hutang" },
  { key: "accounting", label: "Laporan Ringkasan" },
  { key: "pembelian", label: "Pembelian" },
  { key: "stok", label: "Stok" },
  { key: "gudang", label: "Pergudangan" },
  { key: "outlets", label: "Outlets" },
  { key: "toko", label: "Info Toko" },
  { key: "integrasi", label: "Integrasi n8n" },
  { key: "subscription", label: "Subscription" },
  { key: "laporan_harian", label: "Laporan Harian" },
];

const DEFAULT_PERMISSION: OutletFeaturePermission = {
  can_create: true,
  can_read: true,
  can_update: true,
  can_delete: true,
};

/**
 * Normalize raw rows dari DB jadi map feature_key -> permission.
 * Bila tidak ada baris untuk suatu fitur = default semua true.
 */
export function normalizeOutletPermissions(
  rows: { feature_key: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }[]
): Record<string, OutletFeaturePermission> {
  const map: Record<string, OutletFeaturePermission> = {};
  for (const row of rows) {
    map[row.feature_key] = {
      can_create: row.can_create,
      can_read: row.can_read,
      can_update: row.can_update,
      can_delete: row.can_delete,
    };
  }
  return map;
}

/**
 * Cek apakah user boleh akses (read) fitur untuk href. Bila ada override dan can_read false = tidak boleh.
 */
export function canReadFeature(
  href: string,
  permissions: Record<string, OutletFeaturePermission> | null
): boolean {
  const key = ROUTE_TO_FEATURE_KEY[href];
  if (!key) return true;
  if (!permissions || !permissions[key]) return true;
  return permissions[key].can_read;
}

export function getFeaturePermission(
  featureKey: OutletFeatureKey,
  permissions: Record<string, OutletFeaturePermission> | null
): OutletFeaturePermission {
  if (!permissions || !permissions[featureKey]) return DEFAULT_PERMISSION;
  return permissions[featureKey];
}

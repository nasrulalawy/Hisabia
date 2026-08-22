import type { OutletFeatureKey } from "@/lib/outletFeatures";

export interface FeatureFieldDef {
  key: string;
  label: string;
}

/** Field yang bisa diatur visibilitasnya per fitur (form & tabel). */
export const FEATURE_FIELD_DEFINITIONS: Partial<Record<OutletFeatureKey, FeatureFieldDef[]>> = {
  kategori: [{ key: "name", label: "Nama" }],
  produk: [
    { key: "name", label: "Nama" },
    { key: "description", label: "Deskripsi" },
    { key: "image", label: "Gambar" },
    { key: "category", label: "Kategori" },
    { key: "supplier", label: "Supplier" },
    { key: "unit", label: "Satuan" },
    { key: "cost_price", label: "HPP / Harga Modal" },
    { key: "selling_price", label: "Harga Jual" },
    { key: "stock", label: "Stok" },
    { key: "total_modal", label: "Total Harga Modal" },
    { key: "barcode", label: "Barcode / SKU" },
    { key: "is_available", label: "Status Aktif" },
  ],
  bahan: [
    { key: "name", label: "Nama" },
    { key: "stock", label: "Stok" },
    { key: "unit", label: "Satuan" },
    { key: "cost_price", label: "Harga Modal" },
  ],
  satuan: [
    { key: "name", label: "Nama" },
    { key: "symbol", label: "Simbol" },
  ],
  supplier: [
    { key: "name", label: "Nama" },
    { key: "contact", label: "Kontak" },
    { key: "phone", label: "Telepon" },
    { key: "email", label: "Email" },
    { key: "address", label: "Alamat" },
    { key: "notes", label: "Catatan" },
  ],
  pelanggan: [
    { key: "name", label: "Nama" },
    { key: "phone", label: "Telepon" },
    { key: "email", label: "Email" },
    { key: "address", label: "Alamat" },
    { key: "credit_limit", label: "Limit Kredit" },
    { key: "notes", label: "Catatan" },
    { key: "kredit_syariah", label: "Kredit Syariah (Cicilan)" },
    { key: "account", label: "Akun Login" },
  ],
  karyawan: [
    { key: "name", label: "Nama" },
    { key: "phone", label: "Telepon" },
    { key: "email", label: "Email" },
    { key: "address", label: "Alamat" },
    { key: "outlet", label: "Outlet" },
    { key: "role", label: "Kategori Karyawan" },
    { key: "notes", label: "Catatan" },
    { key: "is_active", label: "Status Aktif" },
    { key: "account", label: "Akun Login" },
  ],
  arus_kas: [
    { key: "date", label: "Tanggal" },
    { key: "type", label: "Jenis" },
    { key: "amount", label: "Jumlah" },
    { key: "description", label: "Keterangan" },
  ],
  hutang_piutang: [
    { key: "party", label: "Pihak (Pelanggan/Supplier)" },
    { key: "amount", label: "Jumlah" },
    { key: "due_date", label: "Jatuh Tempo" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Catatan" },
    { key: "type", label: "Jenis (Piutang/Hutang)" },
  ],
  gudang: [
    { key: "name", label: "Nama" },
    { key: "address", label: "Alamat" },
    { key: "notes", label: "Catatan" },
  ],
  outlets: [
    { key: "name", label: "Nama" },
    { key: "address", label: "Alamat" },
    { key: "phone", label: "Telepon" },
    { key: "outlet_type", label: "Tipe Outlet" },
  ],
  stok_toko: [
    { key: "stock", label: "Stok Produk" },
    { key: "cost_price", label: "Harga Modal" },
    { key: "movements", label: "Riwayat Stok" },
  ],
  stok: [
    { key: "stock", label: "Stok Produk" },
    { key: "warehouse", label: "Gudang" },
    { key: "movements", label: "Riwayat Mutasi" },
  ],
  aset_tetap: [
    { key: "name", label: "Nama Aset" },
    { key: "purchase_date", label: "Tanggal Beli" },
    { key: "purchase_price", label: "Harga Perolehan" },
    { key: "useful_life", label: "Masa Manfaat" },
    { key: "salvage_value", label: "Nilai Sisa" },
    { key: "notes", label: "Catatan" },
  ],
  penawaran: [
    { key: "document_no", label: "No. Penawaran" },
    { key: "customer", label: "Pelanggan" },
    { key: "date", label: "Tanggal" },
    { key: "total", label: "Total" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Catatan" },
  ],
  invoice_penjualan: [
    { key: "document_no", label: "No. Invoice" },
    { key: "customer", label: "Pelanggan" },
    { key: "date", label: "Tanggal" },
    { key: "total", label: "Total" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Catatan" },
  ],
  pengiriman: [
    { key: "document_no", label: "No. Pengiriman" },
    { key: "customer", label: "Pelanggan" },
    { key: "date", label: "Tanggal" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Catatan" },
  ],
  pembelian: [
    { key: "supplier", label: "Supplier" },
    { key: "date", label: "Tanggal" },
    { key: "total", label: "Total" },
    { key: "items", label: "Item Pembelian" },
  ],
  dashboard_keuangan: [
    { key: "cash", label: "Saldo Kas" },
    { key: "receivables", label: "Piutang" },
    { key: "payables", label: "Hutang" },
    { key: "inventory", label: "Nilai Persediaan" },
    { key: "daily_sales", label: "Penjualan Harian" },
  ],
};

export function getFeatureFieldDefinitions(featureKey: OutletFeatureKey): FeatureFieldDef[] {
  return FEATURE_FIELD_DEFINITIONS[featureKey] ?? [];
}

export function allFieldKeysForFeature(featureKey: OutletFeatureKey): string[] {
  return getFeatureFieldDefinitions(featureKey).map((f) => f.key);
}

/** null/undefined visible_fields = semua field boleh dilihat. */
export function canViewFeatureField(
  visibleFields: string[] | null | undefined,
  fieldKey: string
): boolean {
  if (!visibleFields || visibleFields.length === 0) return true;
  return visibleFields.includes(fieldKey);
}

/** Normalisasi dari DB: null = semua field tercentang. */
export function normalizeVisibleFieldsFromDb(
  featureKey: OutletFeatureKey,
  visibleFields: string[] | null | undefined
): string[] {
  const all = allFieldKeysForFeature(featureKey);
  if (all.length === 0) return [];
  if (!visibleFields || visibleFields.length === 0) return [...all];
  return visibleFields.filter((k) => all.includes(k));
}

/** Untuk simpan ke DB: jika semua tercentang → null. */
export function visibleFieldsForDb(
  featureKey: OutletFeatureKey,
  selected: string[]
): string[] | null {
  const all = allFieldKeysForFeature(featureKey);
  if (all.length === 0) return null;
  const valid = selected.filter((k) => all.includes(k));
  if (valid.length >= all.length) return null;
  return valid;
}

/**
 * Helper untuk query yang harus terbatas ke outlet aktif.
 * Transaksi antar cabang/pusat tidak boleh tercampur.
 */

/** Filter ketat: hanya baris dengan outlet_id = current. */
export function eqOutletId<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  outletId: string | null | undefined
): T {
  if (!outletId) return query;
  return query.eq("outlet_id", outletId);
}

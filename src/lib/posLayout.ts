/** Tampilan POS: default (grid produk + keranjang) atau klasik (tabel + total besar). */
export type PosLayoutType = "default" | "classic";

const KEY_PREFIX = "hisabia_pos_layout";

export function getPosLayoutKey(orgId: string): string {
  return `${KEY_PREFIX}_${orgId}`;
}

export function getPosLayout(orgId: string | undefined): PosLayoutType {
  if (!orgId) return "default";
  try {
    const v = localStorage.getItem(getPosLayoutKey(orgId));
    if (v === "classic" || v === "default") return v;
  } catch {
    // ignore
  }
  return "default";
}

export function setPosLayout(orgId: string | undefined, layout: PosLayoutType): void {
  if (!orgId) return;
  try {
    localStorage.setItem(getPosLayoutKey(orgId), layout);
  } catch {
    // ignore
  }
}

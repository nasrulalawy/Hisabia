import { supabase } from "@/lib/supabase";

/**
 * Ambil map product_id → stok untuk satu outlet.
 * Produk tanpa baris di outlet_product_stock dianggap stok 0.
 */
export async function fetchOutletStockMap(
  outletId: string | null | undefined,
  productIds?: string[]
): Promise<Record<string, number>> {
  if (!outletId) return {};
  let q = supabase
    .from("outlet_product_stock")
    .select("product_id, stock")
    .eq("outlet_id", outletId);
  if (productIds && productIds.length > 0) {
    q = q.in("product_id", productIds);
  }
  const { data, error } = await q;
  if (error) {
    console.error("fetchOutletStockMap:", error);
    return {};
  }
  const map: Record<string, number> = {};
  (data ?? []).forEach((r: { product_id: string; stock: number }) => {
    map[r.product_id] = Number(r.stock ?? 0);
  });
  return map;
}

/** Merge stok outlet ke daftar produk (field `stock`). */
export function applyOutletStockToProducts<T extends { id: string; stock?: number }>(
  products: T[],
  stockMap: Record<string, number>
): T[] {
  return products.map((p) => ({
    ...p,
    stock: stockMap[p.id] ?? 0,
  }));
}

/** Set stok absolut untuk produk di outlet (RPC + mirror products.stock). */
export async function setOutletProductStock(
  orgId: string,
  outletId: string,
  productId: string,
  stock: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_outlet_product_stock", {
    p_org_id: orgId,
    p_outlet_id: outletId,
    p_product_id: productId,
    p_stock: Math.max(0, stock),
  });
  return { error: error?.message ?? null };
}

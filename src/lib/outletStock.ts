import { supabase } from "@/lib/supabase";

export type OutletProductRow = {
  stock: number;
  selling_price: number | null;
  cost_price: number | null;
};

/**
 * Ambil map product_id → { stock, selling_price, cost_price } untuk satu outlet.
 * Field harga null = pakai harga default di products.
 */
export async function fetchOutletProductMap(
  outletId: string | null | undefined,
  productIds?: string[]
): Promise<Record<string, OutletProductRow>> {
  if (!outletId) return {};
  let q = supabase
    .from("outlet_product_stock")
    .select("product_id, stock, selling_price, cost_price")
    .eq("outlet_id", outletId);
  if (productIds && productIds.length > 0) {
    q = q.in("product_id", productIds);
  }
  const { data, error } = await q;
  if (error) {
    console.error("fetchOutletProductMap:", error);
    return {};
  }
  const map: Record<string, OutletProductRow> = {};
  (data ?? []).forEach(
    (r: {
      product_id: string;
      stock: number;
      selling_price: number | null;
      cost_price: number | null;
    }) => {
      map[r.product_id] = {
        stock: Number(r.stock ?? 0),
        selling_price:
          r.selling_price == null ? null : Number(r.selling_price),
        cost_price: r.cost_price == null ? null : Number(r.cost_price),
      };
    }
  );
  return map;
}

/** @deprecated pakai fetchOutletProductMap */
export async function fetchOutletStockMap(
  outletId: string | null | undefined,
  productIds?: string[]
): Promise<Record<string, number>> {
  const map = await fetchOutletProductMap(outletId, productIds);
  const out: Record<string, number> = {};
  Object.entries(map).forEach(([id, row]) => {
    out[id] = row.stock;
  });
  return out;
}

/** Merge stok saja. */
export function applyOutletStockToProducts<
  T extends { id: string; stock?: number; selling_price?: number },
>(products: T[], stockMap: Record<string, number>): T[] {
  return products.map((p) => ({
    ...p,
    stock: stockMap[p.id] ?? 0,
  }));
}

/** Merge stok + harga jual + HPP outlet ke daftar produk. */
export function applyOutletProductToProducts<
  T extends { id: string; stock?: number; selling_price?: number; cost_price?: number },
>(products: T[], outletMap: Record<string, OutletProductRow>): T[] {
  return products.map((p) => {
    const row = outletMap[p.id];
    return {
      ...p,
      stock: row?.stock ?? 0,
      selling_price:
        row?.selling_price != null ? row.selling_price : p.selling_price,
      cost_price: row?.cost_price != null ? row.cost_price : p.cost_price,
    };
  });
}

/** Set stok absolut untuk produk di outlet. */
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

/**
 * Potong stok secara atomik di database untuk sekumpulan produk terjual.
 * Mengelompokkan item per product_id, mencegah race condition dan stale state.
 */
export async function deductOutletProductStockBatch(
  orgId: string,
  outletId: string | null,
  items: { product_id: string; quantity: number }[]
): Promise<{ error: string | null }> {
  if (items.length === 0) return { error: null };

  // 1. Coba jalankan RPC atomik di database
  const { data, error } = await supabase.rpc("deduct_outlet_product_stock_batch", {
    p_org_id: orgId,
    p_outlet_id: outletId,
    p_items: items,
  });

  if (!error) {
    const res = data as { error?: string; ok?: boolean } | null;
    if (res?.error) return { error: res.error };
    return { error: null };
  }

  // 2. Fallback jika migration RPC belum diaplikasikan di instance remote
  console.warn("deduct_outlet_product_stock_batch RPC not available, using fallback:", error.message);

  const totals = new Map<string, number>();
  for (const it of items) {
    totals.set(it.product_id, (totals.get(it.product_id) ?? 0) + it.quantity);
  }

  const pIds = Array.from(totals.keys());
  if (outletId) {
    const currentMap = await fetchOutletProductMap(outletId, pIds);
    for (const [pId, qtyToDeduct] of totals) {
      const current = currentMap[pId]?.stock ?? 0;
      const nextStock = Math.max(0, current - qtyToDeduct);
      const res = await setOutletProductStock(orgId, outletId, pId, nextStock);
      if (res.error) return { error: res.error };
    }
  } else {
    for (const [pId, qtyToDeduct] of totals) {
      const { data: p } = await supabase.from("products").select("stock").eq("id", pId).single();
      const current = Number(p?.stock ?? 0);
      const nextStock = Math.max(0, current - qtyToDeduct);
      const { error: updErr } = await supabase
        .from("products")
        .update({ stock: nextStock, updated_at: new Date().toISOString() })
        .eq("id", pId);
      if (updErr) return { error: updErr.message };
    }
  }

  return { error: null };
}

/** Set harga jual untuk produk di outlet. */
export async function setOutletProductSellingPrice(
  orgId: string,
  outletId: string,
  productId: string,
  sellingPrice: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_outlet_product_selling_price", {
    p_org_id: orgId,
    p_outlet_id: outletId,
    p_product_id: productId,
    p_selling_price: Math.max(0, sellingPrice),
  });
  return { error: error?.message ?? null };
}

/** Set HPP / harga modal untuk produk di outlet. */
export async function setOutletProductCostPrice(
  orgId: string,
  outletId: string,
  productId: string,
  costPrice: number
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_outlet_product_cost_price", {
    p_org_id: orgId,
    p_outlet_id: outletId,
    p_product_id: productId,
    p_cost_price: Math.max(0, costPrice),
  });
  return { error: error?.message ?? null };
}

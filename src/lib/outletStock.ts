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

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface ShopInfo {
  customer: { id: string; name: string };
  organization: { id: string; name: string; phone: string | null } | null;
  outlet: { id: string; name: string } | null;
}

interface CatalogUnit {
  id: string;
  unit_id: string | null;
  conversion_to_base: number;
  is_base: boolean;
  symbol: string;
  name: string;
  price: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  stock: number;
  image_url: string | null;
  category_id: string | null;
  default_unit_id: string | null;
  units: CatalogUnit[];
  default_price: number;
  default_unit: CatalogUnit;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface CartItem {
  productId: string;
  productName: string;
  unitId: string | null;
  unitSymbol: string;
  conversionToBase: number;
  price: number;
  qty: number;
}

function buildCatalogFromRpc(
  products: { id: string; name: string; stock: number; selling_price: number; default_unit_id: string | null; category_id: string | null; image_url: string | null }[],
  productUnits: { product_id: string; unit_id: string; conversion_to_base: number; is_base: boolean; symbol: string; name: string }[],
  productPrices: { product_id: string; unit_id: string; customer_id: string | null; price: number }[],
  customerId: string
): CatalogProduct[] {
  const puByProduct = new Map<string, typeof productUnits>();
  productUnits.forEach((pu) => {
    if (!puByProduct.has(pu.product_id)) puByProduct.set(pu.product_id, []);
    puByProduct.get(pu.product_id)!.push(pu);
  });
  function resolvePrice(productId: string, unitId: string): number {
    const cust = productPrices.find((p) => p.product_id === productId && p.unit_id === unitId && p.customer_id === customerId);
    if (cust) return cust.price;
    const general = productPrices.find((p) => p.product_id === productId && p.unit_id === unitId && !p.customer_id);
    if (general) return general.price;
    const prod = products.find((p) => p.id === productId);
    const pu = productUnits.find((u) => u.product_id === productId && u.unit_id === unitId);
    if (!prod || !pu) return 0;
    return pu.is_base ? prod.selling_price : prod.selling_price * pu.conversion_to_base;
  }
  return products.map((p) => {
    const units = puByProduct.get(p.id) || [];
    const unitsWithPrice: CatalogUnit[] = units.length
      ? units.map((u) => ({
          id: u.unit_id,
          unit_id: u.unit_id,
          conversion_to_base: u.conversion_to_base,
          is_base: u.is_base,
          symbol: u.symbol,
          name: u.name,
          price: resolvePrice(p.id, u.unit_id),
        }))
      : [{ id: p.default_unit_id || "", unit_id: p.default_unit_id, conversion_to_base: 1, is_base: true, symbol: "pcs", name: "Pcs", price: p.selling_price }];
    const first = unitsWithPrice[0];
    return {
      id: p.id,
      name: p.name,
      stock: p.stock,
      image_url: p.image_url,
      category_id: p.category_id,
      default_unit_id: p.default_unit_id,
      units: unitsWithPrice,
      default_price: first?.price ?? p.selling_price,
      default_unit: first ?? { id: "", unit_id: null, conversion_to_base: 1, is_base: true, symbol: "pcs", name: "Pcs", price: p.selling_price },
    };
  });
}

export function ShopPage() {
  const { token } = useParams<{ token: string }>();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addModal, setAddModal] = useState<{
    product: CatalogProduct;
    selectedUnit: CatalogUnit;
    qty: number;
  } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ id: string; token?: string; total?: number } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Link tidak valid");
      setLoading(false);
      return;
    }
    Promise.all([
      supabase.rpc("get_shop_by_token", { p_token: token }).then((r) => r.data as { error?: string; customer?: { id: string; name: string }; organization?: { id: string; name: string; phone: string | null }; outlet?: { id: string; name: string } } | null),
      supabase.rpc("get_shop_catalog", { p_token: token }).then((r) => r.data as { error?: string; products?: unknown[]; categories?: { id: string; name: string; sort_order: number }[]; product_units?: unknown[]; product_prices?: unknown[]; customer_id?: string } | null),
    ])
      .then(([infoRes, catalogRes]) => {
        if (infoRes?.error || !infoRes?.customer) {
          setError(infoRes?.error || "Link tidak valid");
          return;
        }
        if (catalogRes?.error) {
          setError(catalogRes.error);
          return;
        }
        setShopInfo({
          customer: infoRes.customer,
          organization: infoRes.organization ?? null,
          outlet: infoRes.outlet ?? null,
        });
        const prods = (catalogRes?.products || []) as { id: string; name: string; stock: number; selling_price: number; default_unit_id: string | null; category_id: string | null; image_url: string | null }[];
        const pus = (catalogRes?.product_units || []) as { product_id: string; unit_id: string; conversion_to_base: number; is_base: boolean; symbol: string; name: string }[];
        const pps = (catalogRes?.product_prices || []) as { product_id: string; unit_id: string; customer_id: string | null; price: number }[];
        const custId = catalogRes?.customer_id ?? "";
        setCategories((catalogRes?.categories || []) as Category[]);
        setProducts(buildCatalogFromRpc(prods, pus, pps, custId));
      })
      .catch((err) => setError(err?.message || "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [token]);

  const filteredProducts = products.filter((p) => {
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    const matchSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const total = subtotal;

  function addToCart(product: CatalogProduct, unit?: CatalogUnit, qty = 1) {
    const u = unit || product.default_unit;
    if (!u || qty < 1) return;
    const stockQty = product.stock / (u.conversion_to_base || 1);
    if (qty > stockQty) return;

    const price = u.price ?? product.default_price;

    const existing = cart.find(
      (c) => c.productId === product.id && c.unitId === (u.unit_id ?? null)
    );
    if (existing) {
      const newQty = Math.min(existing.qty + qty, stockQty);
      setCart(
        cart.map((c) =>
          c.productId === product.id && c.unitId === (u.unit_id ?? null)
            ? { ...c, qty: newQty }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          unitId: u.unit_id ?? null,
          unitSymbol: u.symbol,
          conversionToBase: u.conversion_to_base || 1,
          price,
          qty,
        },
      ]);
    }
    setAddModal(null);
  }

  function openAddModal(product: CatalogProduct) {
    const units = product.units.length ? product.units : [product.default_unit];
    setAddModal({
      product,
      selectedUnit: units[0],
      qty: 1,
    });
  }

  function updateQty(productId: string, unitId: string | null, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.productId !== productId || c.unitId !== unitId) return c;
          const product = products.find((p) => p.id === productId);
          if (!product) return c;
          const stockQty = product.stock / c.conversionToBase;
          return { ...c, qty: Math.max(0, Math.min(c.qty + delta, stockQty)) };
        })
        .filter((c) => c.qty > 0)
    );
  }

  async function checkout() {
    if (!token || cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const items = cart.map((c) => ({
        product_id: c.productId,
        unit_id: c.unitId,
        quantity: c.qty,
      }));
      const { data, error: rpcError } = await supabase.rpc("create_shop_order", {
        p_token: token,
        p_items: items,
        p_notes: notes.trim() || null,
        p_discount: 0,
      });
      const res = data as { orderId?: string; orderToken?: string; total?: number; error?: string } | null;
      if (rpcError) {
        setError(rpcError.message || "Gagal memesan");
        setCheckoutLoading(false);
        return;
      }
      if (res?.error) {
        setError(res.error);
        setCheckoutLoading(false);
        return;
      }
      setSuccessOrder(
        res?.orderId
          ? { id: res.orderId, token: res.orderToken, total: res.total }
          : null
      );
      setCart([]);
      setNotes("");
      setCheckoutOpen(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message || "Gagal memesan");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error && !shopInfo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--muted)] p-6">
        <p className="text-center text-lg text-red-600">{error}</p>
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          Pastikan link yang Anda gunakan benar atau hubungi toko untuk link terbaru.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              {shopInfo?.organization?.name || "Toko"}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Belanja untuk {shopInfo?.customer?.name}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {successOrder && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p className="font-medium">Pesanan berhasil! Nomor: #{successOrder.id.slice(0, 8)}</p>
            {shopInfo?.organization?.phone && (
              <a
                href={`https://wa.me/${shopInfo.organization.phone.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
                  `Halo, saya konfirmasi pesanan #${successOrder.id.slice(0, 8)}${successOrder.total ? `. Total: Rp ${successOrder.total.toLocaleString("id-ID")}` : ""}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 font-medium text-white hover:bg-[#20bd5a]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Konfirmasi via WhatsApp
              </a>
            )}
          </div>
        )}

        <div className="mb-4">
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                !selectedCategory
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]"
              }`}
            >
              Semua
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === c.id
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => {
            const canAdd = p.stock > 0;
            const displayPrice = p.default_price;
            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden ${
                  canAdd ? "hover:border-[var(--primary)]" : "opacity-75"
                }`}
              >
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-[var(--muted)] text-[var(--muted-foreground)]">
                    {p.name.slice(0, 1)}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="font-medium text-[var(--foreground)] line-clamp-2">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--primary)]">
                    {formatIdr(displayPrice)}
                    <span className="ml-1 text-xs font-normal text-[var(--muted-foreground)]">
                      / {p.default_unit?.symbol ?? "pcs"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Stok: {p.stock} (satuan dasar)
                  </p>
                  <div className="mt-auto pt-3">
                    {canAdd ? (
                      p.units.length > 1 ? (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => openAddModal(p)}
                        >
                          Pilih & Tambah
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => addToCart(p, p.default_unit, 1)}
                        >
                          Tambah ke Keranjang
                        </Button>
                      )
                    ) : (
                      <span className="block text-center text-sm text-[var(--muted-foreground)]">
                        Habis
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <p className="py-12 text-center text-[var(--muted-foreground)]">
            Tidak ada produk yang cocok.
          </p>
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[var(--background)] p-4 shadow-lg">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {cart.length} item · {formatIdr(total)}
              </p>
            </div>
            <Button onClick={() => setCheckoutOpen(true)}>Checkout</Button>
          </div>
        </div>
      )}

      <Modal
        open={!!addModal}
        onClose={() => setAddModal(null)}
        title={addModal?.product.name ?? ""}
        size="sm"
      >
        {addModal && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Satuan</label>
              <div className="flex flex-wrap gap-2">
                {addModal.product.units.map((u) => {
                  const price = u.price ?? addModal.product.default_price;
                  const maxQty = Math.floor(addModal.product.stock / (u.conversion_to_base || 1));
                  return (
                    <button
                      key={u.unit_id ?? u.id}
                      type="button"
                      onClick={() => setAddModal({ ...addModal, selectedUnit: u })}
                      disabled={maxQty < 1}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        (addModal.selectedUnit?.unit_id ?? null) === (u.unit_id ?? null)
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "border-[var(--border)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {u.symbol} · {formatIdr(price)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Jumlah</label>
              <Input
                type="number"
                min={1}
                max={Math.floor(
                  addModal.product.stock / (addModal.selectedUnit.conversion_to_base || 1)
                )}
                value={addModal.qty}
                onChange={(e) =>
                  setAddModal({
                    ...addModal,
                    qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() =>
                  addToCart(
                    addModal.product,
                    addModal.selectedUnit,
                    addModal.qty
                  )
                }
              >
                Tambah ke Keranjang
              </Button>
              <Button variant="outline" onClick={() => setAddModal(null)}>
                Batal
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Checkout"
        size="sm"
      >
        <div className="space-y-4">
          <div className="max-h-48 overflow-y-auto space-y-2">
            {cart.map((item) => (
              <div
                key={`${item.productId}-${item.unitId}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] p-2"
              >
                <div>
                  <p className="text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatIdr(item.price)} × {item.qty} {item.unitSymbol}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQty(item.productId, item.unitId, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded bg-[var(--muted)] text-sm font-bold hover:bg-[var(--border)]"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.productId, item.unitId, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded bg-[var(--muted)] text-sm font-bold hover:bg-[var(--border)]"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Catatan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan pesanan (opsional)"
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-lg bg-[var(--muted)]/50 p-3">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-[var(--primary)]">{formatIdr(total)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={checkout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Memproses..." : "Konfirmasi Pesanan"}
            </Button>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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

const API = "/api";

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
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Link tidak valid");
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API}/shop/${token}`).then((r) => r.json()),
      fetch(`${API}/shop/${token}/catalog`).then((r) => r.json()),
    ])
      .then(([infoRes, catalogRes]) => {
        if (infoRes.error || !infoRes.customer) {
          setError(infoRes.error || "Link tidak valid");
          return;
        }
        if (catalogRes.error) {
          setError(catalogRes.error);
          return;
        }
        setShopInfo(infoRes);
        setProducts(catalogRes.products || []);
        setCategories(catalogRes.categories || []);
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
      })
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
      const res = await fetch(`${API}/shop/${token}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, notes: notes.trim() || null }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setCheckoutLoading(false);
        return;
      }
      setSuccessOrderId(data.orderId);
      setCart([]);
      setNotes("");
      setCheckoutOpen(false);

      if (data.sentViaWa) {
        setError(null);
      } else if (data.whatsappPhone && data.orderDetailUrl) {
        const msg = encodeURIComponent(
          `Halo, saya sudah memesan. Detail pesanan: ${data.orderDetailUrl}`
        );
        const waUrl = `https://wa.me/${data.whatsappPhone}?text=${msg}`;
        window.open(waUrl, "_blank");
      }
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
        {successOrderId && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Pesanan berhasil! Nomor: #{successOrderId.slice(0, 8)}. Notifikasi telah dikirim ke WA Anda.
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

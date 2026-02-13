import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CatalogPage() {
  const { orgId: param } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgPhone, setOrgPhone] = useState<string | null>(null);
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
    if (!param) {
      setError("Link tidak valid");
      setLoading(false);
      return;
    }
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login", { state: { from: `/katalog/${param}` } });
        return;
      }
      try {
        // Resolve param: UUID = org id, else = catalog_slug
        const isUuid = UUID_REGEX.test(param);
        const { data: org, error: orgErr } = isUuid
          ? await supabase.from("organizations").select("id, name, catalog_public, phone").eq("id", param).single()
          : await supabase.from("organizations").select("id, name, catalog_public, phone").eq("catalog_slug", param).single();
        if (orgErr || !org) {
          setError("Toko tidak ditemukan");
          setLoading(false);
          return;
        }
        setResolvedOrgId(org.id);
        setOrgPhone((org as { phone?: string | null }).phone ?? null);
        if (!org.catalog_public) {
          setError("Katalog toko ini tidak tersedia");
          setLoading(false);
          return;
        }
        setOrgName(org.name);

        const { data: productsData, error: prodErr } = await supabase
          .from("products")
          .select("id, name, stock, selling_price, is_available, default_unit_id, category_id, image_url")
          .eq("organization_id", org.id)
          .eq("is_available", true)
          .order("name");
        if (prodErr) throw prodErr;
        if (!productsData || productsData.length === 0) {
          setProducts([]);
          setCategories([]);
          setLoading(false);
          return;
        }

        const productIds = productsData.map((p) => p.id);
        const [puRes, ppRes, catRes] = await Promise.all([
          supabase
            .from("product_units")
            .select("id, product_id, unit_id, conversion_to_base, is_base, units(name, symbol)")
            .in("product_id", productIds),
          supabase
            .from("product_prices")
            .select("id, product_id, unit_id, customer_id, price, price_type")
            .in("product_id", productIds),
          supabase
            .from("menu_categories")
            .select("id, name, sort_order")
            .eq("organization_id", org.id)
            .order("sort_order")
            .order("name"),
        ]);

        const productUnits = puRes.data || [];
        const productPrices = ppRes.data || [];
        const categoriesData = catRes.data || [];

        const { data: custData } = await supabase
          .from("customers")
          .select("id")
          .eq("organization_id", org.id)
          .eq("user_id", user.id)
          .maybeSingle();
        const customerId = custData?.id ?? null;

        function resolvePrice(
          product: { id: string; selling_price: number },
          unitId: string | null,
          meta: { units: { product_id: string; unit_id: string | null; conversion_to_base: number; is_base: boolean }[]; prices: { product_id: string; unit_id: string | null; customer_id: string | null; price: number; price_type: string }[] }
        ): number {
          const prices = meta.prices.filter((p) => p.product_id === product.id);
          const units = meta.units.filter((u) => u.product_id === product.id);
          const unitRow = units.find((u) => u.unit_id === unitId);
          if (!unitRow) return Number(product.selling_price);
          const custPrice = customerId
            ? prices.find((p) => p.unit_id === unitId && p.customer_id === customerId)
            : null;
          if (custPrice) return Number(custPrice.price);
          const retailPrice = prices.find((p) => p.unit_id === unitId && !p.customer_id && p.price_type === "retail");
          if (retailPrice) return Number(retailPrice.price);
          const anyPrice = prices.find((p) => p.unit_id === unitId && !p.customer_id);
          if (anyPrice) return Number(anyPrice.price);
          if (unitRow.is_base) return Number(product.selling_price);
          return Number(product.selling_price) * (unitRow.conversion_to_base || 1);
        }

        const meta = { units: productUnits, prices: productPrices };
        const catalog: CatalogProduct[] = productsData.map((p) => {
          const units = productUnits.filter((u) => u.product_id === p.id);
          const unitsWithSymbol = units.map((u) => ({
            id: u.id,
            unit_id: u.unit_id,
            conversion_to_base: u.conversion_to_base || 1,
            is_base: u.is_base ?? false,
            symbol: (u.units as { symbol?: string })?.symbol || "pcs",
            name: (u.units as { name?: string })?.name || "Pcs",
            price: resolvePrice(p, u.unit_id, meta),
          }));
          let defUnit: CatalogUnit;
          if (unitsWithSymbol.length === 0) {
            defUnit = {
              id: "default",
              unit_id: p.default_unit_id,
              conversion_to_base: 1,
              is_base: true,
              symbol: "pcs",
              name: "Pcs",
              price: resolvePrice(p, p.default_unit_id, meta),
            };
            unitsWithSymbol.push(defUnit);
          } else {
            defUnit = unitsWithSymbol[0];
          }
          return {
            id: p.id,
            name: p.name,
            stock: Number(p.stock),
            image_url: p.image_url,
            category_id: p.category_id,
            default_unit_id: p.default_unit_id,
            units: unitsWithSymbol,
            default_price: defUnit.price,
            default_unit: defUnit,
          };
        });

        setProducts(catalog);
        setCategories(categoriesData);
      } catch (err) {
        setError((err as Error).message || "Gagal memuat katalog");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [param, navigate]);

  const filteredProducts = products.filter((p) => {
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    const matchSearch =
      !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
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
    if (!resolvedOrgId || cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const items = cart.map((c) => ({
        product_id: c.productId,
        unit_id: c.unitId,
        quantity: c.qty,
      }));
      const { data, error: rpcError } = await supabase.rpc("create_katalog_order", {
        p_org_id: resolvedOrgId,
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

  if (error && !orgName) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--muted)] p-6">
        <p className="text-center text-lg text-red-600">{error}</p>
        <Button variant="outline" onClick={() => navigate("/login")}>
          Masuk ke Akun
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              {orgName || "Katalog"}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Belanja online · Masuk sebagai pelanggan
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            Keluar
          </Button>
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
            {orgPhone && (
              <a
                href={`https://wa.me/${orgPhone.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
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

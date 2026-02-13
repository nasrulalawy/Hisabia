import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface ProductUnitRow {
  id: string;
  unit_id: string;
  conversion_to_base: number;
  is_base: boolean;
  units?: { name: string; symbol: string } | null;
}

interface ProductPriceRow {
  id: string;
  unit_id: string | null;
  customer_id: string | null;
  price: number;
  price_type: string;
  units?: { name: string; symbol: string } | null;
}

interface ProductWithCategory {
  id: string;
  name: string;
  stock: number;
  selling_price: number;
  cost_price: number;
  is_available: boolean;
  default_unit_id: string | null;
  category_id?: string | null;
}

interface ProductMeta {
  units: ProductUnitRow[];
  prices: ProductPriceRow[];
}

interface CartItem {
  productId: string;
  unitId: string;
  unitSymbol: string;
  conversionToBase: number;
  name: string;
  price: number;
  qty: number;
}

const PRICE_TYPES = [
  { value: "retail", label: "Retail" },
  { value: "grosir", label: "Grosir" },
  { value: "grosir_besar", label: "Grosir Besar" },
];

const STANDARD_DENOMINATIONS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

function getCashDenominationOptions(total: number): number[] {
  if (total <= 0) return [0];
  const rounded1k = Math.ceil(total / 1000) * 1000;
  const rounded5k = Math.ceil(total / 5000) * 5000;
  const options = new Set<number>([total]); // Uang pas
  if (rounded1k >= total) options.add(rounded1k);
  if (rounded5k >= total) options.add(rounded5k);
  STANDARD_DENOMINATIONS.forEach((d) => {
    if (d >= total) options.add(d);
  });
  return [...options].sort((a, b) => a - b);
}

export function PosPage() {
  const { orgId, currentOutletId, currentOutletType } = useOrg();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [productMeta, setProductMeta] = useState<Record<string, ProductMeta>>({});
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [priceType] = useState<"retail" | "grosir" | "grosir_besar">("retail");
  const [addModal, setAddModal] = useState<{
    product: ProductWithCategory;
    qty: number;
    selectedUnit: ProductUnitRow | null;
    priceType: "retail" | "grosir" | "grosir_besar";
  } | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [debtMode, setDebtMode] = useState<"full" | "partial" | null>(null);
  const [payNow, setPayNow] = useState<number>(0);

  async function fetchProducts() {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: prods, error: prodsErr } = await supabase
        .from("products")
        .select("id, name, stock, selling_price, cost_price, is_available, default_unit_id, category_id")
        .eq("organization_id", orgId)
        .order("name");

      if (prodsErr) {
        console.error("POS fetch products:", prodsErr);
        setProducts([]);
        setProductMeta({});
      } else {
        const prodsList = (prods as unknown as ProductWithCategory[]) ?? [];
        setProducts(prodsList);

        const ids = prodsList.map((p) => p.id);
        let meta: Record<string, ProductMeta> = {};
        if (ids.length > 0) {
          try {
            const [puRes, ppRes] = await Promise.all([
              supabase
                .from("product_units")
                .select("id, product_id, unit_id, conversion_to_base, is_base, units(name, symbol)")
                .in("product_id", ids),
              supabase
                .from("product_prices")
                .select("id, product_id, unit_id, customer_id, price, price_type, units(name, symbol)")
                .in("product_id", ids),
            ]);
            const puData = (puRes.data as unknown as (ProductUnitRow & { product_id: string })[]) ?? [];
            const ppData = (ppRes.data as unknown as (ProductPriceRow & { product_id: string })[]) ?? [];
            for (const id of ids) {
              meta[id] = {
                units: puData.filter((r) => r.product_id === id),
                prices: ppData.filter((r) => r.product_id === id),
              };
            }
          } catch {
            meta = {};
          }
        }
        setProductMeta(meta);
      }

      const { data: cats } = await supabase
        .from("menu_categories")
        .select("id, name")
        .eq("organization_id", orgId)
        .or(currentOutletId ? `outlet_id.is.null,outlet_id.eq.${currentOutletId}` : "outlet_id.is.null")
        .order("sort_order")
        .order("name");
      setCategories(cats ?? []);

      const { data: custs } = await supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");
      setCustomers(custs ?? []);
    } catch (err) {
      console.error("POS fetch error:", err);
      setProducts([]);
      setProductMeta({});
      setCategories([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, [orgId, currentOutletId]);

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = 0;
  const discountAmount = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = Math.max(0, subtotal - discountAmount + tax);

  // Reset nominal tunai saat total berubah atau debt mode berubah
  useEffect(() => {
    if (checkoutModalOpen && paymentMethod === "cash" && debtMode !== "full") {
      const target = debtMode === "partial" ? Math.min(payNow, total) : total;
      setCashReceived(target);
    }
  }, [checkoutModalOpen, total, paymentMethod, debtMode, payNow]);

  const filteredProducts = products.filter((p) => {
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    const matchSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.is_available;
  });

  function resolvePrice(
    product: ProductWithCategory,
    unitId: string,
    usePriceType?: "retail" | "grosir" | "grosir_besar"
  ): number | null {
    const meta = productMeta[product.id];
    const prices = meta?.prices ?? [];
    const pt = usePriceType ?? priceType;
    // 1. Harga khusus pelanggan
    if (selectedCustomerId) {
      const custPrice = prices.find(
        (pr) => pr.unit_id === unitId && pr.customer_id === selectedCustomerId
      );
      if (custPrice) return custPrice.price;
    }
    // 2. Harga umum per satuan
    const unitPrice = prices.find(
      (pr) => pr.unit_id === unitId && !pr.customer_id && pr.price_type === pt
    );
    if (unitPrice) return unitPrice.price;
    // 3. Fallback: harga retail umum
    const retailPrice = prices.find(
      (pr) => pr.unit_id === unitId && !pr.customer_id && pr.price_type === "retail"
    );
    if (retailPrice) return retailPrice.price;
    // 4. Fallback: selling_price (untuk satuan dasar)
    const metaUnits = meta?.units ?? [];
    const unitRow = metaUnits.find((u) => u.unit_id === unitId);
    if (unitRow?.is_base) return Number(product.selling_price);
    // 5. selling_price * conversion (jika satuan turunan)
    if (unitRow) {
      return Number(product.selling_price) * unitRow.conversion_to_base;
    }
    return Number(product.selling_price);
  }

  function getUnitsForProduct(product: ProductWithCategory): ProductUnitRow[] {
    const meta = productMeta[product.id];
    if (meta?.units?.length) return meta.units;
    // Produk tanpa product_units: virtual unit dari default_unit
    return [
      {
        id: "virtual",
        unit_id: product.default_unit_id ?? "",
        conversion_to_base: 1,
        is_base: true,
        units: { name: "Pcs", symbol: "pcs" },
      },
    ] as ProductUnitRow[];
  }

  function openAddModal(product: ProductWithCategory) {
    const units = getUnitsForProduct(product);
    const first = units[0];
    if (!first) return;
    const unitId = first.unit_id || product.default_unit_id;
    if (!unitId && !first.units) return;
    const price = resolvePrice(product, first.unit_id || unitId || "", "retail");
    if (price == null) return;
    setAddModal({
      product,
      qty: 1,
      selectedUnit: first,
      priceType: "retail",
    });
  }

  function confirmAddToCart() {
    if (!addModal) return;
    const { product, qty, selectedUnit, priceType: pt } = addModal;
    if (!selectedUnit || qty < 1) return;
    const unitId = selectedUnit.unit_id;
    const price = resolvePrice(product, unitId, pt);
    if (price == null) return;
    const unitSymbol = selectedUnit.units?.symbol ?? "pcs";
    const conversionToBase = selectedUnit.conversion_to_base ?? 1;

    const existing = cart.find((c) => c.productId === product.id && c.unitId === unitId);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.productId === product.id && c.unitId === unitId
            ? { ...c, qty: c.qty + qty }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          unitId,
          unitSymbol,
          conversionToBase,
          name: product.name,
          price,
          qty,
        },
      ]);
    }
    setAddModal(null);
  }

  function addToCart(product: ProductWithCategory) {
    const units = getUnitsForProduct(product);
    if (units.length === 1) {
      setAddModal({ product, qty: 1, selectedUnit: units[0], priceType: "retail" });
      return;
    }
    openAddModal(product);
  }

  function updateQty(productId: string, unitId: string, delta: number) {
    setCart(
      cart
        .map((c) =>
          c.productId === productId && c.unitId === unitId
            ? { ...c, qty: Math.max(0, c.qty + delta) }
            : c
        )
        .filter((c) => c.qty > 0)
    );
  }

  function openCheckoutModal() {
    if (cart.length === 0) return;
    setCheckoutModalOpen(true);
    setCashReceived(total);
    setDebtMode(null);
    setPayNow(0);
  }

  function closeCheckoutModal() {
    setCheckoutModalOpen(false);
  }

  async function checkout() {
    if (!orgId || !currentOutletId || cart.length === 0) return;
    setCheckoutLoading(true);
    setSuccessMsg(null);

    const { data: { user } } = await supabase.auth.getUser();

    const discountAmount = Math.min(Math.max(0, Number(discount) || 0), subtotal);
    const finalTotal = Math.max(0, subtotal - discountAmount + tax);

    const orderPaymentMethod = debtMode === "full" ? "credit" : paymentMethod;
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        organization_id: orgId,
        outlet_id: currentOutletId,
        created_by: user?.id,
        customer_id: selectedCustomerId || null,
        status: "paid",
        subtotal,
        tax,
        discount: discountAmount,
        total: finalTotal,
        payment_method: orderPaymentMethod,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      setCheckoutLoading(false);
      return;
    }

    const items = cart.map((c) => ({
      order_id: order.id,
      menu_item_id: null,
      product_id: c.productId,
      unit_id: c.unitId || null,
      name: `${c.name} (${c.unitSymbol})`,
      price: c.price,
      quantity: c.qty,
      notes: null,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(items);

    if (itemsErr) {
      await supabase.from("orders").delete().eq("id", order.id);
      setCheckoutLoading(false);
      return;
    }

    for (const c of cart) {
      const product = products.find((p) => p.id === c.productId);
      if (!product) continue;
      const qtyBase = c.qty * c.conversionToBase;
      const newStock = Math.max(0, Number(product.stock ?? 0) - qtyBase);
      await supabase
        .from("products")
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", c.productId);
      await supabase.from("stock_movements").insert({
        organization_id: orgId,
        warehouse_id: null,
        product_id: c.productId,
        type: "out",
        quantity: qtyBase,
        notes: `Penjualan POS #${order.id.slice(0, 8)} (${c.qty} ${c.unitSymbol})`,
      });
    }

    const amountPaidNow = debtMode === "full" ? 0 : (debtMode === "partial" ? Math.min(Math.max(0, payNow), finalTotal) : finalTotal);

    let cashErr: { message: string } | null = null;
    if (amountPaidNow > 0) {
      const res = await supabase.from("cash_flows").insert({
        organization_id: orgId,
        outlet_id: currentOutletId,
        type: "in",
        amount: amountPaidNow,
        description: `Penjualan POS #${order.id.slice(0, 8)}`,
        reference_type: "order",
        reference_id: order.id,
      });
      cashErr = res.error;
      if (cashErr) console.error("POS cash_flows insert error:", cashErr);
    }

    if (selectedCustomerId && (finalTotal - amountPaidNow) > 0) {
      await supabase.from("receivables").insert({
        organization_id: orgId,
        customer_id: selectedCustomerId,
        order_id: order.id,
        amount: finalTotal,
        paid: amountPaidNow,
        notes: notes.trim() || `Order #${order.id.slice(0, 8)}`,
      });
    }

    setCart([]);
    setNotes("");
    setSelectedCustomerId(null);
    setDiscount(0);
    setDebtMode(null);
    setPayNow(0);
    setCheckoutModalOpen(false);
    setSuccessMsg(
      cashErr
        ? `Order #${order.id.slice(0, 8)} berhasil, tapi arus kas gagal: ${cashErr.message}`
        : `Order #${order.id.slice(0, 8)} berhasil!`
    );
    setCheckoutLoading(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  if (!currentOutletId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">Pilih outlet terlebih dahulu di header.</p>
      </div>
    );
  }

  if (currentOutletType === "gudang") {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-8">
        <p className="text-center text-[var(--muted-foreground)]">
          POS hanya tersedia untuk outlet Mart, F&B, atau Barbershop.
        </p>
        <p className="text-center text-sm text-[var(--muted-foreground)]">
          Ganti outlet di header ke toko/outlet penjualan untuk menggunakan POS.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 gap-4">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <div className="border-b border-[var(--border)] p-4">
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
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="py-8 text-center text-[var(--muted-foreground)]">
              Tidak ada produk. Tambah produk di menu Master → Produk.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredProducts.map((p) => {
                const units = getUnitsForProduct(p);
                const first = units[0];
                const displayPrice =
                  first && resolvePrice(p, first.unit_id) != null
                    ? formatIdr(resolvePrice(p, first.unit_id)!)
                    : "—";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="flex flex-col items-center rounded-lg border border-[var(--border)] p-3 text-left transition-colors hover:bg-[var(--muted)] hover:border-[var(--primary)]"
                  >
                    <span className="line-clamp-2 w-full font-medium text-[var(--foreground)]">
                      {p.name}
                    </span>
                    <span className="mt-1 text-sm font-semibold text-[var(--primary)]">
                      {displayPrice}
                      {units.length > 1 && (
                        <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                          /{first?.units?.symbol ?? "satuan"}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-96 min-w-0 flex-shrink-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <h3 className="font-semibold text-[var(--foreground)]">Keranjang</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted-foreground)] py-8">Keranjang kosong</p>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={`${item.productId}-${item.unitId}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatIdr(item.price)} × {item.qty} {item.unitSymbol}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
          )}
        </div>
        <div className="shrink-0 border-t border-[var(--border)] p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Subtotal</span>
              <span>{formatIdr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="text-[var(--primary)]">{formatIdr(total)}</span>
            </div>
          </div>
          {successMsg && (
            <p className="text-center text-sm font-medium text-emerald-600">{successMsg}</p>
          )}
          <Button
            className="w-full"
            onClick={openCheckoutModal}
            disabled={cart.length === 0}
          >
            Bayar
          </Button>
        </div>
      </div>

      <Modal
        open={!!addModal}
        onClose={() => setAddModal(null)}
        title={addModal ? addModal.product.name : ""}
        size="sm"
      >
        {addModal && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Tipe Harga</label>
              <div className="flex flex-wrap gap-2">
                {PRICE_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setAddModal({ ...addModal, priceType: pt.value as "retail" | "grosir" | "grosir_besar" })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      addModal.priceType === pt.value
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Satuan</label>
              <div className="flex flex-wrap gap-2">
                {getUnitsForProduct(addModal.product).map((u) => {
                  const price = resolvePrice(addModal.product, u.unit_id, addModal.priceType);
                  const sym = u.units?.symbol ?? "pcs";
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setAddModal({ ...addModal, selectedUnit: u })}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        addModal.selectedUnit?.unit_id === u.unit_id
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "border-[var(--border)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {sym}
                      {price != null && (
                        <span className="ml-1 font-medium">{formatIdr(price)}</span>
                      )}
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
                value={addModal.qty}
                onChange={(e) =>
                  setAddModal({ ...addModal, qty: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmAddToCart}>
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
        open={checkoutModalOpen}
        onClose={closeCheckoutModal}
        title="Bayar"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Pelanggan (opsional)</label>
            <select
              value={selectedCustomerId ?? ""}
              onChange={(e) => {
                const val = e.target.value || null;
                setSelectedCustomerId(val);
                if (!val) setDebtMode(null);
              }}
              className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              <option value="">— Tanpa pelanggan —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedCustomerId && (
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Pembayaran</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setDebtMode(null); setPayNow(0); setCashReceived(total); }}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    !debtMode ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  Bayar penuh
                </button>
                <button
                  type="button"
                  onClick={() => { setDebtMode("full"); setPayNow(0); setCashReceived(0); }}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    debtMode === "full" ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  Hutang semua
                </button>
                <button
                  type="button"
                  onClick={() => { setDebtMode("partial"); setPayNow(Math.floor(total / 2)); setCashReceived(Math.floor(total / 2)); }}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    debtMode === "partial" ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  Hutang sebagian
                </button>
              </div>
              {debtMode === "partial" && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Bayar sekarang (Rp)</label>
                  <Input
                    type="number"
                    min={0}
                    max={total}
                    step={1000}
                    value={payNow || ""}
                    onChange={(e) => {
                      const v = Math.min(total, Math.max(0, Number(e.target.value) || 0));
                      setPayNow(v);
                      if (paymentMethod === "cash") setCashReceived(v);
                    }}
                    className="text-sm"
                  />
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Sisa hutang: {formatIdr(total - Math.min(payNow, total))}
                  </p>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Diskon (Rp)</label>
            <Input
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="text-sm"
            />
          </div>
          {debtMode !== "full" && (
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Metode Pembayaran</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  if (e.target.value !== "cash") setCashReceived(0);
                  else setCashReceived(debtMode === "partial" ? Math.min(payNow, total) : total);
                }}
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
              >
                <option value="cash">Tunai</option>
                <option value="transfer">Transfer</option>
                <option value="qris">QRIS</option>
                <option value="card">Kartu</option>
              </select>
            </div>
          )}
          {paymentMethod === "cash" && debtMode !== "full" && (
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Nominal Uang</label>
              <div className="flex flex-wrap gap-2">
                {getCashDenominationOptions(debtMode === "partial" ? Math.min(payNow, total) : total).map((amount) => {
                  const target = debtMode === "partial" ? Math.min(payNow, total) : total;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        setCashReceived(amount);
                        if (debtMode === "partial") setPayNow(amount);
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        cashReceived === amount
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-[var(--border)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {amount === target ? "Uang pas" : formatIdr(amount)}
                    </button>
                  );
                })}
              </div>
              {(debtMode === "partial" ? cashReceived > Math.min(payNow, total) : cashReceived > total) && (
                <p className="mt-2 text-sm font-semibold text-emerald-600">
                  Kembalian: {formatIdr(cashReceived - (debtMode === "partial" ? Math.min(payNow, total) : total))}
                </p>
              )}
            </div>
          )}
          <div>
            <Input
              placeholder="Catatan (opsional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="rounded-lg bg-[var(--muted)]/50 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Subtotal</span>
              <span>{formatIdr(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Diskon</span>
                <span>−{formatIdr(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-[var(--primary)]">{formatIdr(total)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={checkout}
              disabled={
                checkoutLoading ||
                (paymentMethod === "cash" &&
                  debtMode !== "full" &&
                  cashReceived < (debtMode === "partial" ? Math.min(payNow, total) : total))
              }
            >
              {checkoutLoading ? "Memproses..." : debtMode === "full" ? "Konfirmasi Hutang" : "Konfirmasi Bayar"}
            </Button>
            <Button variant="outline" onClick={closeCheckoutModal}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

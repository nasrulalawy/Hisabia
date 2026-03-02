import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, getStockStatus, getStockStatusLabel } from "@/lib/utils";
import { postJournalEntry } from "@/lib/accounting";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import {
  type ReceiptData,
  printReceiptInWindow,
  printReceiptBluetooth,
  printReceiptLocal,
  getReceiptPrinterType,
  getReceiptLocalUrl,
} from "@/lib/receipt";

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
  barcode?: string | null;
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
  const { orgId, currentOutletId, currentOutlet, currentOutletType } = useOrg();
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
    editCartKey?: string;
  } | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [debtMode, setDebtMode] = useState<"full" | "partial" | null>(null);
  const [payNow, setPayNow] = useState<number>(0);
  const [activeShift, setActiveShift] = useState<{ id: string; initial_cash: number; opened_at: string } | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [openShiftForm, setOpenShiftForm] = useState({ initial_cash: "", notes: "" });
  const [openShiftSubmitting, setOpenShiftSubmitting] = useState(false);
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [closeShiftForm, setCloseShiftForm] = useState({ end_cash: "" });
  const [closeShiftSubmitting, setCloseShiftSubmitting] = useState(false);
  const [exceedStockConfirm, setExceedStockConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [bluetoothPrinting, setBluetoothPrinting] = useState(false);
  const [bluetoothPrintError, setBluetoothPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (cart.length === 0) setSelectedCartIndex(null);
    else if (selectedCartIndex !== null && selectedCartIndex >= cart.length) {
      setSelectedCartIndex(Math.max(0, cart.length - 1));
    }
  }, [cart.length, selectedCartIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "");
      if (addModal || scanModalOpen || exceedStockConfirm.open) return;

      if (checkoutModalOpen) {
        if (e.key === "Enter" && !inInput) {
          e.preventDefault();
          if (e.shiftKey) checkout({ printAfter: false });
          else checkout({ printAfter: true });
          return;
        }
        return;
      }

      if (inInput) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (cart.length > 0) openCheckoutModal();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (cart.length === 0) return;
        setSelectedCartIndex((i) => (i === null ? 0 : Math.min((i ?? 0) + 1, cart.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cart.length === 0) return;
        setSelectedCartIndex((i) => (i === null ? cart.length - 1 : Math.max((i ?? 0) - 1, 0)));
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
          openEditCartItem(cart[selectedCartIndex]);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedCartIndex !== null && cart[selectedCartIndex]) {
          removeCartItem(cart[selectedCartIndex].productId, cart[selectedCartIndex].unitId);
          const newLen = cart.length - 1;
          setSelectedCartIndex(newLen === 0 ? null : Math.min(selectedCartIndex, newLen - 1));
        }
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, selectedCartIndex, addModal, checkoutModalOpen, scanModalOpen, exceedStockConfirm.open]);

  async function fetchActiveShift() {
    if (!currentOutletId) return;
    setShiftLoading(true);
    const { data } = await supabase
      .from("shifts")
      .select("id, initial_cash, opened_at")
      .eq("outlet_id", currentOutletId)
      .is("closed_at", null)
      .maybeSingle();
    setActiveShift(data);
    setShiftLoading(false);
  }

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !currentOutletId) return;
    const initialCash = parseFloat(openShiftForm.initial_cash) || 0;
    if (initialCash < 0) return;
    setOpenShiftSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: shift, error } = await supabase
      .from("shifts")
      .insert({
        organization_id: orgId,
        outlet_id: currentOutletId,
        opened_by: user?.id,
        initial_cash: initialCash,
        notes: openShiftForm.notes.trim() || null,
      })
      .select("id, initial_cash, opened_at")
      .single();
    setOpenShiftSubmitting(false);
    if (error) {
      console.error("Open shift error:", error);
      return;
    }
    setActiveShift(shift);
    setOpenShiftModal(false);
    setOpenShiftForm({ initial_cash: "", notes: "" });
  }

  async function handleCloseShift(e: React.FormEvent) {
    e.preventDefault();
    if (!activeShift) return;
    const endCash = parseFloat(closeShiftForm.end_cash) || 0;
    setCloseShiftSubmitting(true);
    const { error } = await supabase
      .from("shifts")
      .update({
        closed_at: new Date().toISOString(),
        end_cash: endCash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeShift.id);
    setCloseShiftSubmitting(false);
    if (error) {
      console.error("Close shift error:", error);
      return;
    }
    setActiveShift(null);
    setCloseShiftModal(false);
    setCloseShiftForm({ end_cash: "" });
  }

  async function fetchProducts() {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: prods, error: prodsErr } = await supabase
        .from("products")
        .select("id, name, stock, selling_price, cost_price, is_available, default_unit_id, category_id, barcode")
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

  useEffect(() => {
    fetchActiveShift();
  }, [currentOutletId]);

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

  function doAddToCart() {
    if (!addModal) return;
    const { product, qty, selectedUnit, priceType: pt, editCartKey } = addModal;
    if (!selectedUnit || qty < 1) return;
    const unitId = selectedUnit.unit_id;
    const price = resolvePrice(product, unitId, pt);
    if (price == null) return;
    const unitSymbol = selectedUnit.units?.symbol ?? "pcs";
    const conversionToBase = selectedUnit.conversion_to_base ?? 1;

    let nextCart = cart;
    if (editCartKey) {
      nextCart = cart.filter((c) => `${c.productId}-${c.unitId}` !== editCartKey);
    }
    const existing = nextCart.find((c) => c.productId === product.id && c.unitId === unitId);
    if (existing) {
      setCart(
        nextCart.map((c) =>
          c.productId === product.id && c.unitId === unitId
            ? { ...c, qty: c.qty + qty }
            : c
        )
      );
    } else {
      setCart([
        ...nextCart,
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

  function confirmAddToCart() {
    if (!addModal) return;
    const { product, qty, selectedUnit, priceType: pt, editCartKey } = addModal;
    if (!selectedUnit || qty < 1) return;
    const unitId = selectedUnit.unit_id;
    const price = resolvePrice(product, unitId, pt);
    if (price == null) return;
    const conversionToBase = selectedUnit.conversion_to_base ?? 1;

    const cartWithoutEdit = editCartKey
      ? cart.filter((c) => `${c.productId}-${c.unitId}` !== editCartKey)
      : cart;
    const existing = cartWithoutEdit.find((c) => c.productId === product.id && c.unitId === unitId);
    const existingQtyBase = (existing ? existing.qty * existing.conversionToBase : 0);
    const newQtyBase = qty * conversionToBase;
    const totalQtyBase = existingQtyBase + newQtyBase;
    const stock = Number(product.stock ?? 0);

    if (totalQtyBase > stock) {
      setExceedStockConfirm({
        open: true,
        title: "Stok tidak cukup",
        message: `Stok "${product.name}" hanya ${stock}. Jumlah yang diminta setara ${totalQtyBase} (dasar). Lanjutkan? Stok dapat menjadi minus.`,
        onConfirm: () => {
          doAddToCart();
          setExceedStockConfirm((s) => ({ ...s, open: false }));
        },
      });
      return;
    }
    doAddToCart();
  }

  function addToCart(product: ProductWithCategory) {
    const units = getUnitsForProduct(product);
    if (units.length === 1) {
      setAddModal({ product, qty: 1, selectedUnit: units[0], priceType: "retail" });
      return;
    }
    openAddModal(product);
  }

  function openEditCartItem(item: CartItem) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return;
    const units = getUnitsForProduct(product);
    const selectedUnit = units.find((u) => u.unit_id === item.unitId) ?? units[0];
    if (!selectedUnit) return;
    setAddModal({
      product,
      qty: item.qty,
      selectedUnit,
      priceType: "retail",
      editCartKey: `${item.productId}-${item.unitId}`,
    });
  }

  /** Menambah produk ke keranjang berdasarkan barcode/kode. Returns true jika berhasil. */
  function addToCartByBarcode(barcode: string): boolean {
    const code = barcode.trim();
    if (!code) return false;
    const product = products.find(
      (p) => p.barcode != null && String(p.barcode).trim() !== "" && String(p.barcode).trim().toLowerCase() === code.toLowerCase()
    );
    if (!product) return false;
    if (!product.is_available) return false;
    const units = getUnitsForProduct(product);
    const first = units[0];
    if (!first) return false;
    const price = resolvePrice(product, first.unit_id, "retail");
    if (price == null) return false;
    const existing = cart.find((c) => c.productId === product.id && c.unitId === first.unit_id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.productId === product.id && c.unitId === first.unit_id
            ? { ...c, qty: c.qty + 1 }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          unitId: first.unit_id,
          unitSymbol: first.units?.symbol ?? "pcs",
          conversionToBase: first.conversion_to_base ?? 1,
          name: product.name,
          price,
          qty: 1,
        },
      ]);
    }
    return true;
  }

  function handleBarcodeScan(barcode: string) {
    setScanError(null);
    const code = barcode.trim();
    if (!code) return;
    const product = products.find(
      (p) => p.barcode != null && String(p.barcode).trim() !== "" && String(p.barcode).trim().toLowerCase() === code.toLowerCase()
    );
    if (!product) {
      setScanError(`Produk dengan barcode "${code}" tidak ditemukan. Isi barcode di data produk.`);
      return;
    }
    if (!product.is_available) {
      setScanError("Produk tidak aktif.");
      return;
    }
    addToCartByBarcode(code);
    setScanModalOpen(false);
    setScanError(null);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = search.trim();
    if (!code) return;
    e.preventDefault();
    if (addToCartByBarcode(code)) {
      setSearch("");
    }
  }

  function doUpdateQty(productId: string, unitId: string, delta: number) {
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

  function removeCartItem(productId: string, unitId: string) {
    setCart(cart.filter((c) => !(c.productId === productId && c.unitId === unitId)));
  }

  function updateQty(productId: string, unitId: string, delta: number) {
    if (delta <= 0) {
      doUpdateQty(productId, unitId, delta);
      return;
    }
    const item = cart.find((c) => c.productId === productId && c.unitId === unitId);
    if (!item) return;
    const product = products.find((p) => p.id === productId);
    if (!product) {
      doUpdateQty(productId, unitId, delta);
      return;
    }
    const newQtyBase = (item.qty + delta) * item.conversionToBase;
    const stock = Number(product.stock ?? 0);
    if (newQtyBase > stock) {
      setExceedStockConfirm({
        open: true,
        title: "Stok tidak cukup",
        message: `Stok "${product.name}" hanya ${stock}. Jumlah yang diminta setara ${newQtyBase}. Lanjutkan? Stok dapat menjadi minus.`,
        onConfirm: () => {
          doUpdateQty(productId, unitId, delta);
          setExceedStockConfirm((s) => ({ ...s, open: false }));
        },
      });
      return;
    }
    doUpdateQty(productId, unitId, delta);
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

  async function checkout(options?: { printAfter?: boolean }) {
    if (!orgId || !currentOutletId || !activeShift || cart.length === 0) return;
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
        shift_id: activeShift.id,
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

    const cogsTotal = cart.reduce((sum, c) => {
      const product = products.find((p) => p.id === c.productId);
      const cost = Number(product?.cost_price ?? 0) * c.qty * c.conversionToBase;
      return sum + cost;
    }, 0);
    const entryDate = new Date().toISOString().slice(0, 10);
    const lines: { code: string; debit: number; credit: number }[] = [];
    if (amountPaidNow > 0) lines.push({ code: "1-1", debit: amountPaidNow, credit: 0 });
    if (finalTotal - amountPaidNow > 0) lines.push({ code: "1-2", debit: finalTotal - amountPaidNow, credit: 0 });
    lines.push({ code: "4-1", debit: 0, credit: finalTotal });
    if (cogsTotal > 0) {
      lines.push({ code: "5-1", debit: cogsTotal, credit: 0 });
      lines.push({ code: "1-3", debit: 0, credit: cogsTotal });
    }
    if (lines.length > 0) {
      await postJournalEntry({
        organization_id: orgId,
        entry_date: entryDate,
        description: `Penjualan POS #${order.id.slice(0, 8)}`,
        reference_type: "order",
        reference_id: order.id,
        lines,
        created_by: user?.id ?? undefined,
      });
    }

    const receiptData: ReceiptData = {
      orderId: order.id.slice(0, 8),
      outletName: currentOutlet?.name ?? "Toko",
      date: new Date(),
      items: cart.map((c) => ({
        name: c.name,
        qty: c.qty,
        unit: c.unitSymbol,
        price: c.price,
        lineTotal: c.price * c.qty,
      })),
      subtotal,
      discount: discountAmount,
      total: finalTotal,
      paymentMethod: orderPaymentMethod,
      notes: notes.trim() || undefined,
    };
    setLastReceipt(receiptData);

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

    if (options?.printAfter) {
      const printerType = getReceiptPrinterType();
      try {
        if (printerType === "bluetooth" && navigator.bluetooth) {
          await printReceiptBluetooth(receiptData);
        } else if (printerType === "local") {
          await printReceiptLocal(receiptData, getReceiptLocalUrl());
        } else {
          printReceiptInWindow(receiptData);
        }
      } catch (err) {
        console.error("Auto-print struk gagal:", err);
      }
    }
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

  if (shiftLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-xl border border-[var(--border)] bg-[var(--background)] p-8">
        <p className="text-center text-[var(--muted-foreground)]">
          Buka shift terlebih dahulu untuk memulai transaksi.
        </p>
        <Button onClick={() => setOpenShiftModal(true)} size="lg">
          Buka Shift
        </Button>
        <Modal
          open={openShiftModal}
          onClose={() => setOpenShiftModal(false)}
          title="Buka Shift"
          size="sm"
        >
          <form onSubmit={handleOpenShift} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Modal Awal Kasir (Rp) *
              </label>
              <Input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={openShiftForm.initial_cash}
                onChange={(e) => setOpenShiftForm((f) => ({ ...f, initial_cash: e.target.value }))}
                required
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Jumlah uang di kasir saat memulai shift.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
              <textarea
                value={openShiftForm.notes}
                onChange={(e) => setOpenShiftForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Opsional"
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={openShiftSubmitting} className="flex-1">
                {openShiftSubmitting ? "Membuka..." : "Buka Shift"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpenShiftModal(false)}>
                Batal
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-0 flex-col gap-3 sm:h-[calc(100vh-8rem)] sm:gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            Shift aktif
          </span>
          <span className="text-xs text-[var(--muted-foreground)] sm:text-sm">
            Modal: {formatIdr(activeShift.initial_cash)} · Buka: {new Date(activeShift.opened_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCloseShiftModal(true)} className="min-h-10 touch-manipulation sm:min-h-0">
          Tutup Shift
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <div className="shrink-0 border-b border-[var(--border)] p-3 sm:p-4">
          <div className="mb-3 flex gap-2">
            <Input
              placeholder="Cari produk atau scan barcode (ketik kode + Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setScanError(null); setScanModalOpen(true); }}
              className="shrink-0 touch-manipulation"
              title="Scan barcode/QR"
            >
              <svg className="h-5 w-5 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`min-h-10 min-w-[4rem] touch-manipulation rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
                className={`min-h-10 touch-manipulation rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
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
                const stockStatus = getStockStatus(Number(p.stock ?? 0));
                const stockLabel = getStockStatusLabel(stockStatus);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="flex min-h-[4.5rem] touch-manipulation flex-col items-center justify-center rounded-lg border border-[var(--border)] p-3 text-left transition-colors active:bg-[var(--muted)] hover:border-[var(--primary)] hover:bg-[var(--muted)]"
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
                    {stockLabel && (
                      <Badge
                        variant={
                          stockStatus === "minus"
                            ? "destructive"
                            : stockStatus === "empty"
                              ? "destructive"
                              : "warning"
                        }
                        className="mt-1.5 w-full justify-center"
                      >
                        {stockLabel} ({Number(p.stock)})
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] md:max-h-full md:w-96">
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-2 sm:px-4 sm:py-3">
          <h3 className="font-semibold text-[var(--foreground)]">Keranjang {cart.length > 0 && `(${cart.length})`}</h3>
          {cart.length > 0 && (
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">↑↓ pilih · F2 ubah · Del hapus</p>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:max-h-[40vh]">
          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted-foreground)] sm:py-8">Keranjang kosong</p>
          ) : (
            <div className="space-y-2">
              {cart.map((item, index) => {
                const isSelected = selectedCartIndex === index;
                return (
                  <div
                    key={`${item.productId}-${item.unitId}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCartIndex(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCartIndex(index);
                        if (e.key === "Enter") openEditCartItem(item);
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-2 transition-colors ${
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)]/30"
                        : "border-[var(--border)] hover:bg-[var(--muted)]/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEditCartItem(item); }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {formatIdr(item.price)} × {item.qty} {item.unitSymbol}
                      </p>
                      <span className="mt-0.5 block text-xs text-[var(--primary)]">Klik / F2 ubah harga · Del hapus</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.unitId, -1)}
                        className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg bg-[var(--muted)] text-sm font-bold hover:bg-[var(--border)] active:opacity-80"
                        aria-label="Kurangi"
                      >
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm font-medium">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.unitId, 1)}
                        className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg bg-[var(--muted)] text-sm font-bold hover:bg-[var(--border)] active:opacity-80"
                        aria-label="Tambah"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="shrink-0 space-y-3 border-t border-[var(--border)] p-3 sm:p-4">
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
          {lastReceipt && (
            <div className="space-y-2">
              <p className="text-center text-xs text-[var(--muted-foreground)]">Cetak struk</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-0"
                  onClick={() => {
                    printReceiptInWindow(lastReceipt);
                  }}
                >
                  Print (USB/Bluetooth)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-0"
                  disabled={bluetoothPrinting || !navigator.bluetooth}
                  onClick={async () => {
                    if (!lastReceipt) return;
                    setBluetoothPrintError(null);
                    setBluetoothPrinting(true);
                    try {
                      await printReceiptBluetooth(lastReceipt);
                    } catch (err) {
                      setBluetoothPrintError(err instanceof Error ? err.message : "Gagal cetak Bluetooth");
                    } finally {
                      setBluetoothPrinting(false);
                    }
                  }}
                >
                  {bluetoothPrinting ? "Mencetak..." : "Thermal BLE"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-0"
                  onClick={async () => {
                    if (!lastReceipt) return;
                    try {
                      await printReceiptLocal(lastReceipt, getReceiptLocalUrl());
                    } catch (err) {
                      console.error("Cetak app lokal gagal:", err);
                      alert(err instanceof Error ? err.message : "Gagal cetak. Pastikan Print Agent berjalan.");
                    }
                  }}
                >
                  App lokal
                </Button>
              </div>
              {bluetoothPrintError && (
                <p className="text-center text-xs text-red-600">{bluetoothPrintError}</p>
              )}
            </div>
          )}
          <Button
            className="h-12 w-full touch-manipulation text-base sm:h-10 sm:text-sm"
            onClick={openCheckoutModal}
            disabled={cart.length === 0}
            title="Enter buka bayar · Di modal: Enter = bayar+cetak, Shift+Enter = bayar saja"
          >
            Bayar
          </Button>
          <p className="text-center text-xs text-[var(--muted-foreground)]">Enter = Bayar</p>
        </div>
      </div>
      </div>

      <Modal
        open={scanModalOpen}
        onClose={() => { setScanModalOpen(false); setScanError(null); }}
        title="Scan Barcode / QR"
        size="lg"
      >
        <BarcodeScanner
          open={scanModalOpen}
          onScan={handleBarcodeScan}
          onClose={() => { setScanModalOpen(false); setScanError(null); }}
          lastError={scanError}
        />
      </Modal>

      <Modal
        open={!!addModal}
        onClose={() => setAddModal(null)}
        title={addModal ? (addModal.editCartKey ? "Ubah harga/satuan" : addModal.product.name) : ""}
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
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Stok saat ini</label>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {Number(addModal.product.stock ?? 0)} (dasar)
                {(() => {
                  const status = getStockStatus(Number(addModal.product.stock ?? 0));
                  const label = getStockStatusLabel(status);
                  return label ? (
                    <Badge variant={status === "minus" || status === "empty" ? "destructive" : "warning"} className="ml-2">
                      {label}
                    </Badge>
                  ) : null;
                })()}
              </p>
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
              {addModal.selectedUnit &&
                (addModal.qty * (addModal.selectedUnit.conversion_to_base ?? 1)) > Number(addModal.product.stock ?? 0) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Jumlah melebihi stok. Konfirmasi akan diminta saat menambah ke keranjang.
                  </p>
                )}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmAddToCart}>
                {addModal.editCartKey ? "Simpan" : "Tambah ke Keranjang"}
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
          <p className="text-center text-xs text-[var(--muted-foreground)]">
            Enter = bayar + cetak struk · Shift+Enter = bayar saja
          </p>
        </div>
      </Modal>

      <Modal
        open={closeShiftModal}
        onClose={() => setCloseShiftModal(false)}
        title="Tutup Shift"
        size="sm"
      >
        <form onSubmit={handleCloseShift} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Saldo Kas Akhir (Rp) *
            </label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={closeShiftForm.end_cash}
              onChange={(e) => setCloseShiftForm((f) => ({ ...f, end_cash: e.target.value }))}
              required
            />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Jumlah uang di kasir saat menutup shift.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={closeShiftSubmitting} className="flex-1">
              {closeShiftSubmitting ? "Menutup..." : "Tutup Shift"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCloseShiftModal(false)}>
              Batal
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={exceedStockConfirm.open}
        onClose={() => setExceedStockConfirm((s) => ({ ...s, open: false }))}
        onConfirm={exceedStockConfirm.onConfirm}
        title={exceedStockConfirm.title}
        message={exceedStockConfirm.message}
        confirmLabel="Lanjutkan"
        variant="default"
      />
    </div>
  );
}

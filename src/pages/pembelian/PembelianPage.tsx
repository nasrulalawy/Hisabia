import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Product } from "@/lib/database.types";
import type { Warehouse } from "@/lib/database.types";
import type { Supplier } from "@/lib/database.types";

interface LineItem {
  product_id: string;
  product_name: string;
  qty: string;
  price: string;
}

export function PembelianPage() {
  const { orgId } = useOrg();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_id: "",
    warehouse_id: "",
    payment: "cash" as "cash" | "credit",
    due_date: "",
    notes: "",
  });
  const [items, setItems] = useState<LineItem[]>([]);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const [supRes, whRes, prodRes] = await Promise.all([
      supabase.from("suppliers").select("*").eq("organization_id", orgId).order("name"),
      supabase.from("warehouses").select("*").eq("organization_id", orgId).order("name"),
      supabase.from("products").select("*").eq("organization_id", orgId).order("name"),
    ]);
    setSuppliers(supRes.data ?? []);
    setWarehouses(whRes.data ?? []);
    setProducts(prodRes.data ?? []);
    setForm((f) => ({ ...f, warehouse_id: whRes.data?.[0]?.id ?? f.warehouse_id }));
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  function addItem() {
    setItems([...items, { product_id: "", product_name: "", qty: "1", price: "0" }]);
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    const newItems = [...items];
    if (field === "product_id") {
      const p = products.find((x) => x.id === value);
      newItems[index] = {
        ...newItems[index],
        product_id: value,
        product_name: p?.name ?? "",
        price: p ? String(p.cost_price ?? 0) : newItems[index].price,
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const totalAmount = items.reduce((s, i) => {
    const q = parseFloat(i.qty) || 0;
    const p = parseFloat(i.price) || 0;
    return s + q * p;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;

    const validItems = items.filter((i) => i.product_id && parseFloat(i.qty) > 0);
    if (validItems.length === 0) {
      setError("Tambahkan minimal 1 produk dengan jumlah > 0");
      return;
    }
    if (!form.warehouse_id) {
      setError("Pilih gudang tujuan");
      return;
    }
    if (form.payment === "credit" && !form.supplier_id) {
      setError("Pilih supplier untuk pembelian kredit");
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      for (const item of validItems) {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) continue;

        const qty = parseFloat(item.qty);
        const price = parseFloat(item.price);
        const currentStock = Number(product.stock ?? 0);
        const currentCost = Number(product.cost_price ?? 0);
        const newStock = currentStock + qty;
        const newCostPrice =
          newStock > 0 ? (currentStock * currentCost + qty * price) / newStock : price;

        const { error: movErr } = await supabase.from("stock_movements").insert({
          organization_id: orgId,
          warehouse_id: form.warehouse_id,
          product_id: item.product_id,
          type: "in",
          quantity: qty,
          notes: `Pembelian dari ${suppliers.find((s) => s.id === form.supplier_id)?.name ?? "supplier"}`,
        });

        if (movErr) throw movErr;

        await supabase
          .from("products")
          .update({
            stock: newStock,
            cost_price: newCostPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.product_id);
      }

      if (form.payment === "cash" && totalAmount > 0) {
        await supabase.from("cash_flows").insert({
          organization_id: orgId,
          type: "out",
          amount: totalAmount,
          description: `Pembelian dari ${suppliers.find((s) => s.id === form.supplier_id)?.name ?? "supplier"}`,
          reference_type: "purchase",
          notes: form.notes.trim() || null,
        });
      } else if (form.payment === "credit" && form.supplier_id && totalAmount > 0) {
        await supabase.from("payables").insert({
          organization_id: orgId,
          supplier_id: form.supplier_id,
          amount: totalAmount,
          paid: 0,
          due_date: form.due_date || null,
          notes: form.notes.trim() || null,
        });
      }

      setItems([]);
      setSuccessMsg("Pembelian berhasil! Stok telah ditambahkan.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Terjadi kesalahan");
    }
    setSubmitLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Pembelian</h2>
        <p className="text-[var(--muted-foreground)]">
          Catat pembelian dari supplier. Stok akan otomatis bertambah.
        </p>
      </div>

      {warehouses.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Buat gudang terlebih dahulu di menu <strong>Pergudangan</strong> sebelum melakukan pembelian.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Data Pembelian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Supplier</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Gudang Tujuan *</label>
                <select
                  value={form.warehouse_id}
                  onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  required
                >
                  <option value="">-- Pilih Gudang --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Pembayaran</label>
                <select
                  value={form.payment}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, payment: e.target.value as "cash" | "credit" }))
                  }
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="cash">Tunai (bayar sekarang)</option>
                  <option value="credit">Kredit (bayar nanti)</option>
                </select>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Tunai: catat ke Arus Kas. Kredit: catat ke Hutang.
                </p>
              </div>
              {form.payment === "credit" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Jatuh Tempo
                  </label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="No. faktur, referensi, dll."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Item Pembelian</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              + Tambah Item
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-6 text-center text-[var(--muted-foreground)]">
                Klik &quot;Tambah Item&quot; untuk menambah produk
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-nowrap"
                  >
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Produk</label>
                      <select
                        value={item.product_id}
                        onChange={(e) => updateItem(idx, "product_id", e.target.value)}
                        className="h-9 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
                      >
                        <option value="">-- Pilih --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Qty</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="w-28">
                      <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Harga Beli</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItem(idx, "price", e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="rounded p-2 text-red-600 hover:bg-red-50"
                      title="Hapus"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="flex justify-end border-t border-[var(--border)] pt-4">
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    Total: {formatIdr(totalAmount)}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={items.length === 0 || submitLoading}>
                {submitLoading ? "Menyimpan..." : "Simpan Pembelian"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

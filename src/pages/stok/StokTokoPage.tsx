import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatDate, parsePriceIdr } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface ProductWithUnit {
  id: string;
  name: string;
  stock: number;
  cost_price: number;
  selling_price: number;
  is_available: boolean;
  units?: { symbol: string } | null;
}

interface StockMovementRow {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  products?: { name: string } | null;
}

export function StokTokoPage() {
  const { orgId } = useOrg();
  const [products, setProducts] = useState<ProductWithUnit[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<"masuk" | "adjust" | null>(null);
  const [form, setForm] = useState({ product_id: "", quantity: "", price: "", notes: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const [prodsRes, movRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, stock, cost_price, selling_price, is_available, units(symbol)")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("stock_movements")
        .select("id, type, quantity, notes, created_at, products(name)")
        .eq("organization_id", orgId)
        .is("warehouse_id", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setProducts((prodsRes.data as unknown as ProductWithUnit[]) ?? []);
    setMovements((movRes.data as unknown as StockMovementRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  function openModal(type: "masuk" | "adjust") {
    setModalType(type);
    setForm({ product_id: "", quantity: type === "masuk" ? "1" : "", price: "", notes: "" });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !form.product_id) return;
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || (modalType === "masuk" && qty <= 0)) {
      setError("Jumlah tidak valid");
      return;
    }
    if (modalType === "adjust" && qty === 0) {
      setError("Jumlah penyesuaian tidak boleh 0");
      return;
    }

    setSubmitLoading(true);
    setError(null);

    const product = products.find((p) => p.id === form.product_id);
    const currentStock = Number(product?.stock ?? 0);
    const price = parsePriceIdr(form.price) || Number(product?.cost_price ?? 0);

    if (modalType === "adjust" && qty < 0 && Math.abs(qty) > currentStock) {
      setError(`Stok tidak cukup. Stok saat ini: ${currentStock}`);
      setSubmitLoading(false);
      return;
    }

    let newStock = currentStock;
    const type = modalType === "masuk" ? "in" : "adjust";
    if (modalType === "masuk") {
      newStock = currentStock + Math.abs(qty);
    } else {
      newStock = currentStock + qty; // qty can be negative for adjust
    }
    newStock = Math.max(0, newStock);

    const { error: movErr } = await supabase.from("stock_movements").insert({
      organization_id: orgId,
      warehouse_id: null,
      product_id: form.product_id,
      type,
      quantity: modalType === "masuk" ? Math.abs(qty) : qty,
      notes: form.notes.trim() || null,
    });

    if (movErr) {
      setError(movErr.message);
      setSubmitLoading(false);
      return;
    }

    const updatePayload: { stock: number; cost_price?: number } = { stock: newStock };
    if (modalType === "masuk" && price > 0) {
      const currentCost = Number(product?.cost_price ?? 0);
      const addQty = Math.abs(qty);
      const totalQty = currentStock + addQty;
      updatePayload.cost_price =
        totalQty > 0 ? (currentStock * currentCost + addQty * price) / totalQty : price;
    }

    const { error: updErr } = await supabase
      .from("products")
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq("id", form.product_id);

    if (updErr) {
      setError(updErr.message);
      setSubmitLoading(false);
      return;
    }

    setModalType(null);
    fetchData();
    setSubmitLoading(false);
  }

  const productColumns: Column<ProductWithUnit>[] = [
    { key: "name", header: "Produk" },
    {
      key: "stock",
      header: "Stok",
      render: (r) => `${Number(r.stock)} ${r.units?.symbol ?? ""}`,
    },
    {
      key: "is_available",
      header: "Status",
      render: (r) =>
        r.is_available ? (
          <Badge variant="success">Aktif</Badge>
        ) : (
          <Badge variant="default">Nonaktif</Badge>
        ),
    },
  ];

  const movementColumns: Column<StockMovementRow>[] = [
    { key: "created_at", header: "Tanggal", render: (r) => formatDate(r.created_at) },
    { key: "products", header: "Produk", render: (r) => r.products?.name ?? "-" },
    {
      key: "type",
      header: "Jenis",
      render: (r) =>
        r.type === "in" ? (
          <Badge variant="success">Masuk</Badge>
        ) : r.type === "adjust" ? (
          <Badge variant="warning">Penyesuaian</Badge>
        ) : (
          <Badge variant="destructive">Keluar</Badge>
        ),
    },
    {
      key: "quantity",
      header: "Qty",
      render: (r) => (r.type === "out" ? `-${Number(r.quantity)}` : r.type === "adjust" && Number(r.quantity) < 0 ? `${r.quantity}` : `+${Number(r.quantity)}`),
    },
    { key: "notes", header: "Catatan", render: (r) => r.notes ?? "-" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Stok Toko</h2>
          <p className="text-[var(--muted-foreground)]">
            Kelola stok produk toko langsung (stok masuk, penyesuaian).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openModal("masuk")}>
            Stok Masuk
          </Button>
          <Button variant="outline" onClick={() => openModal("adjust")}>
            Penyesuaian
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <h3 className="mb-3 text-lg font-medium text-[var(--foreground)]">Stok Produk</h3>
        <DataTable
          columns={productColumns}
          data={products}
          loading={loading}
          emptyMessage="Belum ada produk. Tambah produk di menu Produk."
        />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-[var(--foreground)]">Riwayat Stok Toko</h3>
        <DataTable
          columns={movementColumns}
          data={movements}
          loading={loading}
          emptyMessage="Belum ada riwayat."
        />
      </div>

      <Modal
        open={!!modalType}
        onClose={() => setModalType(null)}
        title={modalType === "masuk" ? "Stok Masuk" : "Penyesuaian Stok"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Produk *</label>
            <select
              value={form.product_id}
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  product_id: e.target.value,
                  price: p ? String(p.cost_price ?? 0) : "",
                });
              }}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              required
            >
              <option value="">-- Pilih Produk --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stok: {Number(p.stock)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              Jumlah * {modalType === "adjust" && "(negatif = kurangi)"}
            </label>
            <Input
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder={modalType === "adjust" ? "0 (bisa negatif)" : "0"}
              required
            />
          </div>
          {modalType === "masuk" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Harga beli (opsional, untuk update HPP)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0"
              />
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Pembelian, koreksi, dll."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalType(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitLoading}>
              {submitLoading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

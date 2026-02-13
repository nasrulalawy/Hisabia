import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { Product } from "@/lib/database.types";
import type { Warehouse } from "@/lib/database.types";
import type { StockMovement } from "@/lib/database.types";

interface ProductWithUnit extends Product {
  units?: { symbol: string } | null;
}

interface MovementWithRelations extends StockMovement {
  products?: { name: string } | null;
  warehouses?: { name: string } | null;
}

export function StokPage() {
  const { orgId } = useOrg();
  const [products, setProducts] = useState<ProductWithUnit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movements, setMovements] = useState<MovementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: "",
    product_id: "",
    type: "in" as "in" | "out" | "adjust",
    quantity: "",
    notes: "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function fetchData() {
    if (!orgId) return;
    setLoading(true);

    const [prodsRes, whRes, movRes] = await Promise.all([
      supabase
        .from("products")
        .select("*, units(symbol)")
        .eq("organization_id", orgId)
        .order("name"),
      supabase.from("warehouses").select("*").eq("organization_id", orgId).order("name"),
      supabase
        .from("stock_movements")
        .select("*, products(name), warehouses(name)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setProducts((prodsRes.data as ProductWithUnit[]) ?? []);
    setWarehouses(whRes.data ?? []);
    setMovements((movRes.data as MovementWithRelations[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  function openAdd() {
    setForm({
      warehouse_id: warehouses[0]?.id ?? "",
      product_id: "",
      type: "in",
      quantity: "",
      notes: "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !form.warehouse_id || !form.product_id || !form.quantity) return;
    const qty = parseFloat(form.quantity);
    if (isNaN(qty)) {
      setError("Jumlah tidak valid");
      return;
    }
    if ((form.type === "in" || form.type === "out") && qty <= 0) {
      setError("Jumlah harus lebih dari 0 untuk stok masuk/keluar");
      return;
    }

    setSubmitLoading(true);
    setError(null);

    const product = products.find((p) => p.id === form.product_id);
    const currentStock = Number(product?.stock ?? 0);

    if (form.type === "out" && qty > currentStock) {
      setError(`Stok tidak cukup. Stok saat ini: ${currentStock}`);
      setSubmitLoading(false);
      return;
    }

    const { data: movement, error: insertErr } = await supabase
      .from("stock_movements")
      .insert({
        organization_id: orgId,
        warehouse_id: form.warehouse_id,
        product_id: form.product_id,
        type: form.type,
        quantity: form.type === "adjust" ? qty : qty,
        notes: form.notes.trim() || null,
      })
      .select("id")
      .single();

    if (insertErr) {
      setError(insertErr.message);
      setSubmitLoading(false);
      return;
    }

    let newStock = currentStock;
    if (form.type === "in") {
      newStock = currentStock + qty;
    } else if (form.type === "out") {
      newStock = currentStock - qty;
    } else {
      newStock = currentStock + qty;
    }
    newStock = Math.max(0, newStock);

    const { error: updateErr } = await supabase
      .from("products")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", form.product_id);

    if (updateErr) {
      await supabase.from("stock_movements").delete().eq("id", movement.id);
      setError(updateErr.message);
      setSubmitLoading(false);
      return;
    }

    setModalOpen(false);
    fetchData();
    setSubmitLoading(false);
  }

  const displayProducts = products;

  const productColumns: Column<ProductWithUnit>[] = [
    { key: "name", header: "Produk" },
    {
      key: "stock",
      header: "Stok",
      render: (r) => (
        <span>
          {Number(r.stock)} {r.units?.symbol ?? ""}
        </span>
      ),
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

  const movementColumns: Column<MovementWithRelations>[] = [
    {
      key: "created_at",
      header: "Tanggal",
      render: (r) => formatDate(r.created_at),
    },
    {
      key: "products",
      header: "Produk",
      render: (r) => r.products?.name ?? "-",
    },
    {
      key: "warehouses",
      header: "Gudang",
      render: (r) => r.warehouses?.name ?? "-",
    },
    {
      key: "type",
      header: "Jenis",
      render: (r) =>
        r.type === "in" ? (
          <Badge variant="success">Masuk</Badge>
        ) : r.type === "out" ? (
          <Badge variant="destructive">Keluar</Badge>
        ) : (
          <Badge variant="warning">Adjust</Badge>
        ),
    },
    {
      key: "quantity",
      header: "Qty",
      render: (r) => (r.type === "out" ? `-${Number(r.quantity)}` : `+${Number(r.quantity)}`),
    },
    { key: "notes", header: "Catatan", render: (r) => r.notes ?? "-" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Stok</h2>
          <p className="text-[var(--muted-foreground)]">
            Kelola stok produk dan mutasi stok (masuk/keluar/adjust).
          </p>
        </div>
        <Button onClick={openAdd} disabled={warehouses.length === 0}>
          Mutasi Stok
        </Button>
      </div>

      {warehouses.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Buat gudang terlebih dahulu di menu <strong>Pergudangan</strong> sebelum melakukan mutasi stok.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <h3 className="mb-3 text-lg font-medium text-[var(--foreground)]">Stok Produk</h3>
        <DataTable
          columns={productColumns}
          data={displayProducts}
          loading={loading}
          emptyMessage="Belum ada produk. Tambah produk di menu Produk."
        />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-medium text-[var(--foreground)]">Riwayat Mutasi Stok</h3>
        <DataTable
          columns={movementColumns}
          data={movements}
          loading={loading}
          emptyMessage="Belum ada mutasi stok."
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Mutasi Stok"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Gudang *</label>
            <select
              value={form.warehouse_id}
              onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Produk *</label>
            <select
              value={form.product_id}
              onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jenis *</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "in" | "out" | "adjust" }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="in">Stok Masuk</option>
              <option value="out">Stok Keluar</option>
              <option value="adjust">Penyesuaian (adjust)</option>
            </select>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Masuk: tambah stok. Keluar: kurangi stok. Adjust: koreksi (qty bisa negatif).
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jumlah *</label>
            <Input
              type="number"
              min={form.type === "out" || form.type === "in" ? "0.01" : undefined}
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Contoh: Pembelian, Retur, Koreksi fisik"
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
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

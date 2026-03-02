import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Ingredient } from "@/lib/database.types";
import type { Unit } from "@/lib/database.types";

interface IngredientWithUnit extends Ingredient {
  units?: { name: string; symbol: string } | null;
}

export function BahanPage() {
  const { orgId } = useOrg();
  const [data, setData] = useState<IngredientWithUnit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientWithUnit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IngredientWithUnit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ name: "", unit_id: "", cost_per_unit: "", stock: "", notes: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchUnits() {
    if (!orgId) return;
    const { data: rows } = await supabase
      .from("units")
      .select("*")
      .eq("organization_id", orgId)
      .order("name");
    setUnits(rows ?? []);
  }

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("ingredients")
      .select(
        `
        *,
        units(name, symbol)
      `
      )
      .eq("organization_id", orgId)
      .order("name");
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setData(rows ?? []);
    setError(null);
  }

  useEffect(() => {
    fetchUnits();
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [orgId]);

  function openAdd() {
    setEditing(null);
    setForm({
      name: "",
      unit_id: units[0]?.id ?? "",
      cost_per_unit: "",
      stock: "0",
      notes: "",
    });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: IngredientWithUnit) {
    setEditing(row);
    setForm({
      name: row.name,
      unit_id: row.unit_id,
      cost_per_unit: String(row.cost_per_unit),
      stock: String(row.stock ?? 0),
      notes: row.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !orgId || !form.unit_id) return;
    const cost = parseFloat(form.cost_per_unit.replace(",", "."));
    if (Number.isNaN(cost) || cost < 0) {
      setError("Harga per satuan harus angka ≥ 0");
      return;
    }
    const stockVal = parseFloat(form.stock.replace(",", "."));
    if (Number.isNaN(stockVal) || stockVal < 0) {
      setError("Stok harus angka ≥ 0");
      return;
    }
    setSubmitLoading(true);
    setError(null);
    const payload = {
      organization_id: orgId,
      name: form.name.trim(),
      unit_id: form.unit_id,
      cost_per_unit: cost,
      stock: stockVal,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error: err } = await supabase
        .from("ingredients")
        .update({ name: payload.name, unit_id: payload.unit_id, cost_per_unit: payload.cost_per_unit, stock: payload.stock, notes: payload.notes, updated_at: payload.updated_at })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("ingredients").insert({
        organization_id: payload.organization_id,
        name: payload.name,
        unit_id: payload.unit_id,
        cost_per_unit: payload.cost_per_unit,
        stock: payload.stock,
        notes: payload.notes,
      });
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    }
    setSubmitLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error: err } = await supabase.from("ingredients").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<IngredientWithUnit>[] = [
    { key: "name", header: "Nama" },
    {
      key: "units",
      header: "Satuan",
      render: (row) => row.units?.symbol ?? row.units?.name ?? "-",
    },
    {
      key: "cost_per_unit",
      header: "Harga/satuan",
      render: (row) => formatIdr(row.cost_per_unit),
    },
    {
      key: "stock",
      header: "Stok",
      render: (row) => {
        const s = Number(row.stock ?? 0);
        const sym = row.units?.symbol ?? "";
        return `${s} ${sym}`.trim() || "0";
      },
    },
    {
      key: "notes",
      header: "Catatan",
      render: (row) => (row.notes ? String(row.notes).slice(0, 40) + (String(row.notes).length > 40 ? "…" : "") : "-"),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Bahan (Ingredients)</h2>
        <p className="text-[var(--muted-foreground)]">
          Bahan baku untuk resep F&B. Dipakai di produk untuk menghitung HPP dari resep.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="Belum ada bahan. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Bahan"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Bahan" : "Tambah Bahan"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Susu UHT, Espresso, Gula"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Satuan</label>
            <select
              value={form.unit_id}
              onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            >
              <option value="">Pilih satuan</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Harga per satuan (HPP bahan)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={form.cost_per_unit}
              onChange={(e) => setForm((f) => ({ ...f, cost_per_unit: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Stok</label>
            <Input
              type="text"
              inputMode="decimal"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Opsional"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitLoading}>
              {submitLoading ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Bahan"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"? Bahan yang dipakai di resep produk akan terputus.`}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

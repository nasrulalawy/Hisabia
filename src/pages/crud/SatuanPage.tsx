import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Unit } from "@/lib/database.types";

export function SatuanPage() {
  const { orgId } = useOrg();
  const [data, setData] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ name: "", symbol: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("units")
      .select("*")
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
    fetchData();
  }, [orgId]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", symbol: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: Unit) {
    setEditing(row);
    setForm({ name: row.name, symbol: row.symbol });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.symbol.trim() || !orgId) return;
    setSubmitLoading(true);
    setError(null);
    const payload = { organization_id: orgId, name: form.name.trim(), symbol: form.symbol.trim() };
    if (editing) {
      const { error: err } = await supabase
        .from("units")
        .update({ name: payload.name, symbol: payload.symbol, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("units").insert(payload);
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
    const { error: err } = await supabase.from("units").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<Unit>[] = [
    { key: "name", header: "Nama" },
    { key: "symbol", header: "Simbol" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Satuan</h2>
        <p className="text-[var(--muted-foreground)]">
          Kelola satuan produk (pcs, kg, liter, box, dll).
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
        emptyMessage="Belum ada satuan. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Satuan"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Satuan" : "Tambah Satuan"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Kilogram"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Simbol</label>
            <Input
              value={form.symbol}
              onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
              placeholder="Contoh: kg"
              required
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
        title="Hapus Satuan"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

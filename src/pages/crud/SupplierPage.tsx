import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Supplier } from "@/lib/database.types";

export function SupplierPage() {
  const { orgId } = useOrg();
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("suppliers")
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
    setForm({
      name: "",
      contact: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: Supplier) {
    setEditing(row);
    setForm({
      name: row.name,
      contact: row.contact ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      notes: row.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !orgId) return;
    setSubmitLoading(true);
    setError(null);
    const payload = {
      organization_id: orgId,
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error: err } = await supabase
        .from("suppliers")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("suppliers").insert(payload);
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
    const { error: err } = await supabase.from("suppliers").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<Supplier>[] = [
    { key: "name", header: "Nama" },
    { key: "contact", header: "Kontak" },
    { key: "phone", header: "Telepon" },
    { key: "email", header: "Email" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Supplier</h2>
        <p className="text-[var(--muted-foreground)]">Kelola data supplier/vendor organisasi.</p>
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
        emptyMessage="Belum ada supplier. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Supplier"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Supplier" : "Tambah Supplier"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nama supplier"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Kontak</label>
              <Input
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="Nama kontak"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Telepon</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="08xxx"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Alamat</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Alamat lengkap"
              rows={2}
              className="h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan tambahan"
              rows={2}
              className="h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
        title="Hapus Supplier"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { MenuCategory } from "@/lib/database.types";

export function KategoriPage() {
  const { orgId, currentOutletId } = useOrg();
  const [data, setData] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuCategory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ name: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    let query = supabase
      .from("menu_categories")
      .select("*")
      .eq("organization_id", orgId);
    if (currentOutletId) {
      query = query.or(`outlet_id.is.null,outlet_id.eq.${currentOutletId}`);
    } else {
      query = query.is("outlet_id", null);
    }
    const { data: rows, error: err } = await query.order("sort_order").order("name");
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
  }, [orgId, currentOutletId]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: MenuCategory) {
    setEditing(row);
    setForm({ name: row.name });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !orgId) return;
    setSubmitLoading(true);
    setError(null);
    const slug = slugify(form.name) || "kategori";
    const payload = {
      organization_id: orgId,
      outlet_id: currentOutletId,
      name: form.name.trim(),
      slug,
      sort_order: editing ? (editing as MenuCategory & { sort_order: number }).sort_order : 0,
    };
    if (editing) {
      const { error: err } = await supabase
        .from("menu_categories")
        .update({ name: payload.name, slug: payload.slug, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("menu_categories").insert(payload);
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
    const { error: err } = await supabase.from("menu_categories").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<MenuCategory>[] = [
    { key: "name", header: "Nama" },
    { key: "slug", header: "Slug", className: "text-[var(--muted-foreground)]" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Kategori</h2>
        <p className="text-[var(--muted-foreground)]">
          Kelola kategori produk/menu untuk organisasi Anda.
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
        emptyMessage="Belum ada kategori. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Kategori"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Kategori" : "Tambah Kategori"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="Contoh: Makanan"
              required
              autoFocus
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
        title="Hapus Kategori"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

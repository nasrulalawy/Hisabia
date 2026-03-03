import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OUTLET_FEATURE_LIST } from "@/lib/outletFeatures";
import type { EmployeeRole, EmployeeRoleFeaturePermission } from "@/lib/database.types";

type PermState = Record<
  string,
  { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
>;

const DEFAULT_CRUD = {
  can_create: true,
  can_read: true,
  can_update: true,
  can_delete: true,
};

export function KategoriKaryawanPage() {
  const { orgId } = useOrg();
  const [data, setData] = useState<EmployeeRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [permissions, setPermissions] = useState<PermState>({});
  const [permLoading, setPermLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("employee_roles")
      .select("*")
      .eq("organization_id", orgId)
      .order("name");
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setData((rows ?? []) as EmployeeRole[]);
    setError(null);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  async function loadPermissions(roleId: string) {
    setPermLoading(true);
    const { data: rows, error: err } = await supabase
      .from("employee_role_feature_permissions")
      .select("feature_key, can_create, can_read, can_update, can_delete")
      .eq("employee_role_id", roleId);
    setPermLoading(false);
    if (err) return;
    const perm: PermState = {};
    OUTLET_FEATURE_LIST.forEach((f) => {
      const row = (rows as EmployeeRoleFeaturePermission[] | null)?.find((r) => r.feature_key === f.key);
      perm[f.key] = row
        ? {
            can_create: row.can_create,
            can_read: row.can_read,
            can_update: row.can_update,
            can_delete: row.can_delete,
          }
        : { ...DEFAULT_CRUD };
    });
    setPermissions(perm);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: "", description: "" });
    const perm: PermState = {};
    OUTLET_FEATURE_LIST.forEach((f) => (perm[f.key] = { ...DEFAULT_CRUD }));
    setPermissions(perm);
    setError(null);
    setModalOpen(true);
  }

  async function openEdit(row: EmployeeRole) {
    setEditing(row);
    setForm({ name: row.name, description: row.description ?? "" });
    setError(null);
    setModalOpen(true);
    await loadPermissions(row.id);
  }

  function setPerm(
    featureKey: string,
    field: "can_create" | "can_read" | "can_update" | "can_delete",
    value: boolean
  ) {
    setPermissions((p) => ({
      ...p,
      [featureKey]: { ...(p[featureKey] ?? DEFAULT_CRUD), [field]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !orgId) return;
    setSubmitLoading(true);
    setError(null);
    const now = new Date().toISOString();
    if (editing) {
      const { error: err } = await supabase
        .from("employee_roles")
        .update({ name: form.name.trim(), description: form.description.trim() || null, updated_at: now })
        .eq("id", editing.id);
      if (err) {
        setError(err.message);
        setSubmitLoading(false);
        return;
      }
      const roleId = editing.id;
      const { error: delErr } = await supabase
        .from("employee_role_feature_permissions")
        .delete()
        .eq("employee_role_id", roleId);
      if (delErr) {
        setError(delErr.message);
        setSubmitLoading(false);
        return;
      }
      const rows = OUTLET_FEATURE_LIST.map((f) => {
        const p = permissions[f.key] ?? DEFAULT_CRUD;
        return {
          employee_role_id: roleId,
          feature_key: f.key,
          can_create: p.can_create,
          can_read: p.can_read,
          can_update: p.can_update,
          can_delete: p.can_delete,
          updated_at: now,
        };
      });
      const { error: insErr } = await supabase.from("employee_role_feature_permissions").insert(rows);
      if (insErr) setError(insErr.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { data: newRole, error: insRoleErr } = await supabase
        .from("employee_roles")
        .insert({
          organization_id: orgId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          updated_at: now,
        })
        .select("id")
        .single();
      if (insRoleErr || !newRole) {
        setError(insRoleErr?.message ?? "Gagal membuat kategori");
        setSubmitLoading(false);
        return;
      }
      const roleId = (newRole as { id: string }).id;
      const rows = OUTLET_FEATURE_LIST.map((f) => {
        const p = permissions[f.key] ?? DEFAULT_CRUD;
        return {
          employee_role_id: roleId,
          feature_key: f.key,
          can_create: p.can_create,
          can_read: p.can_read,
          can_update: p.can_update,
          can_delete: p.can_delete,
          updated_at: now,
        };
      });
      const { error: insErr } = await supabase.from("employee_role_feature_permissions").insert(rows);
      if (insErr) setError(insErr.message);
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
    const { error: err } = await supabase.from("employee_roles").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<EmployeeRole>[] = [
    { key: "name", header: "Nama" },
    { key: "description", header: "Deskripsi" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Kategori Karyawan</h2>
        <p className="text-[var(--muted-foreground)]">Atur kategori (role) dan hak akses CRUD per fitur.</p>
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
        title={editing ? "Edit Kategori Karyawan" : "Tambah Kategori Karyawan"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Kasir, Driver, Admin Toko"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Deskripsi</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Keterangan opsional"
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">Hak akses per fitur</h3>
            <p className="mb-3 text-xs text-[var(--muted-foreground)]">
              Centang Create/Read/Update/Delete per fitur. Jika Read tidak dicentang, menu fitur disembunyikan.
            </p>
            {permLoading ? (
              <p className="text-sm text-[var(--muted-foreground)]">Memuat…</p>
            ) : (
              <div className="max-h-80 overflow-auto rounded border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--muted)]">
                    <tr>
                      <th className="border-b border-[var(--border)] px-3 py-2 text-left font-medium">Fitur</th>
                      <th className="border-b border-[var(--border)] px-2 py-2 text-center">C</th>
                      <th className="border-b border-[var(--border)] px-2 py-2 text-center">R</th>
                      <th className="border-b border-[var(--border)] px-2 py-2 text-center">U</th>
                      <th className="border-b border-[var(--border)] px-2 py-2 text-center">D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OUTLET_FEATURE_LIST.map((f) => {
                      const p = permissions[f.key] ?? DEFAULT_CRUD;
                      return (
                        <tr key={f.key} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-3 py-1.5">{f.label}</td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={p.can_create}
                              onChange={(e) => setPerm(f.key, "can_create", e.target.checked)}
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={p.can_read}
                              onChange={(e) => setPerm(f.key, "can_read", e.target.checked)}
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={p.can_update}
                              onChange={(e) => setPerm(f.key, "can_update", e.target.checked)}
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={p.can_delete}
                              onChange={(e) => setPerm(f.key, "can_delete", e.target.checked)}
                              className="h-4 w-4 rounded border-[var(--border)]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitLoading || permLoading}>
              {submitLoading ? "Menyimpan…" : editing ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus kategori karyawan"
        message={deleteTarget ? `Yakin hapus kategori "${deleteTarget.name}"?` : ""}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

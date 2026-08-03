import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Employee, EmployeeRole } from "@/lib/database.types";
import type { Outlet } from "@/lib/database.types";

type EmployeeRow = Employee & {
  outlets?: { name: string } | null;
  employee_roles?: { name: string } | null;
};

export function KaryawanPage() {
  const { orgId, outlets } = useOrg();
  const [data, setData] = useState<EmployeeRow[]>([]);
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberLimit, setMemberLimit] = useState(2);
  const [memberCount, setMemberCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    outlet_id: "" as string,
    employee_role_id: "" as string,
    is_active: true,
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmployee, setInviteEmployee] = useState<EmployeeRow | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const [empRes, rolesRes, membersRes, subRes] = await Promise.all([
      supabase
        .from("employees")
        .select("*, outlets(name), employee_roles(name)")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("employee_roles")
        .select("*")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("subscriptions")
        .select("subscription_plans(member_limit)")
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);
    setLoading(false);
    if (empRes.error) {
      setError(empRes.error.message);
      return;
    }
    setData((empRes.data ?? []) as EmployeeRow[]);
    setRoles((rolesRes.data ?? []) as EmployeeRole[]);
    setMemberCount(membersRes.count ?? 0);
    const plan = (
      subRes.data as { subscription_plans?: { member_limit: number } | null } | null
    )?.subscription_plans;
    setMemberLimit(plan?.member_limit ?? 2);
    if (rolesRes.error) setError(rolesRes.error.message);
    else setError(null);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  function openAdd() {
    setEditing(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      outlet_id: "",
      employee_role_id: "",
      is_active: true,
    });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: EmployeeRow) {
    setEditing(row);
    setForm({
      name: row.name,
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      notes: row.notes ?? "",
      outlet_id: row.outlet_id ?? "",
      employee_role_id: row.employee_role_id ?? "",
      is_active: row.is_active,
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
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      outlet_id: form.outlet_id || null,
      employee_role_id: form.employee_role_id || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error: err } = await supabase
        .from("employees")
        .update(payload)
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("employees").insert(payload);
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
    const { error: err } = await supabase.from("employees").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  function generateInviteToken(): string {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  async function handleTambahAkun(row: EmployeeRow) {
    if (!row.email?.trim()) {
      setError("Isi email karyawan terlebih dahulu (edit karyawan) agar bisa mengundang akun.");
      return;
    }
    if (!row.is_active) {
      setError("Aktifkan karyawan terlebih dahulu sebelum membuat akun.");
      return;
    }
    if (memberLimit < 999 && memberCount >= memberLimit) {
      setError(
        `Limit user organisasi tercapai (${memberLimit}). Upgrade paket untuk menambah akun.`
      );
      return;
    }
    setInviteLoading(true);
    setError(null);
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const { error: err } = await supabase
      .from("employees")
      .update({
        invite_token: token,
        invite_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setInviteLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    const link = `${window.location.origin}/daftar-karyawan?token=${token}`;
    setInviteLink(link);
    setInviteEmployee(row);
    fetchData();
  }

  function copyInviteLink() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  const outletList = outlets ?? [];
  const columns: Column<EmployeeRow>[] = [
    { key: "name", header: "Nama" },
    { key: "phone", header: "Telepon" },
    { key: "email", header: "Email" },
    {
      key: "outlets",
      header: "Outlet",
      render: (row) => (row.outlets as { name: string } | null)?.name ?? "—",
    },
    {
      key: "employee_roles",
      header: "Kategori",
      render: (row) => (row.employee_roles as { name: string } | null)?.name ?? "—",
    },
    {
      key: "akun",
      header: "Akun",
      render: (row) => {
        if (row.user_id) {
          return <span className="text-sm text-emerald-600">Terhubung</span>;
        }
        if (!row.email?.trim() || !row.is_active) {
          return <span className="text-sm text-[var(--muted-foreground)]">—</span>;
        }
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTambahAkun(row)}
            disabled={inviteLoading}
          >
            {inviteLoading ? "..." : "Tambah akun"}
          </Button>
        );
      },
    },
    {
      key: "is_active",
      header: "Aktif",
      render: (row) => (row.is_active ? "Ya" : "Tidak"),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Karyawan</h2>
        <p className="text-[var(--muted-foreground)]">
          Kelola data karyawan dan akun login. User: {memberCount}
          {memberLimit < 999 ? ` / ${memberLimit}` : ""}.
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
        emptyMessage="Belum ada karyawan. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Karyawan"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Karyawan" : "Tambah Karyawan"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nama lengkap"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Telepon</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="08..."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@contoh.com"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Wajib diisi jika ingin membuat akun login.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Alamat</label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Alamat"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Outlet</label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
                value={form.outlet_id}
                onChange={(e) => setForm((f) => ({ ...f, outlet_id: e.target.value }))}
              >
                <option value="">— Semua outlet —</option>
                {outletList.map((o: Outlet) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Kategori Karyawan
              </label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
                value={form.employee_role_id}
                onChange={(e) => setForm((f) => ({ ...f, employee_role_id: e.target.value }))}
              >
                <option value="">— Pilih kategori —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan internal"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-[var(--border)]"
            />
            <label htmlFor="is_active" className="text-sm text-[var(--foreground)]">
              Karyawan aktif
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitLoading}>
              {submitLoading ? "Menyimpan…" : editing ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus karyawan"
        message={deleteTarget ? `Yakin hapus "${deleteTarget.name}"?` : ""}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />

      <Modal
        open={!!inviteEmployee}
        onClose={() => {
          setInviteEmployee(null);
          setInviteLink(null);
        }}
        title="Tambah akun karyawan"
        size="md"
      >
        {inviteEmployee && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Bagikan link berikut ke <strong>{inviteEmployee.name}</strong> ({inviteEmployee.email}).
              Karyawan buka link, daftar dengan email tersebut, lalu bisa login ke aplikasi.
            </p>
            {inviteLink && (
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  {linkCopied ? "Tersalin!" : "Salin"}
                </Button>
              </div>
            )}
            <p className="text-xs text-[var(--muted-foreground)]">
              Link berlaku 7 hari. Jika kadaluarsa, klik &quot;Tambah akun&quot; lagi untuk buat link
              baru.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setInviteEmployee(null);
                  setInviteLink(null);
                }}
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

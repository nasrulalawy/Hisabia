import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatDate, formatIdr } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type {
  Customer,
  KreditSyariahAkad,
  KreditSyariahAngsuran,
} from "@/lib/database.types";

export function PelangganPage() {
  const { orgId } = useOrg();
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [catalogUrl, setCatalogUrl] = useState<string>("");
  const [inviteCustomer, setInviteCustomer] = useState<Customer | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [akadLoading, setAkadLoading] = useState(false);
  const [akadRows, setAkadRows] = useState<
    (KreditSyariahAkad & { totalPaid: number; remaining: number })[]
  >([]);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("customers")
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

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("catalog_slug")
        .eq("id", orgId)
        .single();
      const slug = data?.catalog_slug?.trim();
      setCatalogUrl(`${window.location.origin}/katalog/${slug || orgId}`);
    })();
  }, [orgId]);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: Customer) {
    setEditing(row);
    setForm({
      name: row.name,
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      notes: row.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
    loadCustomerAkad(row.id);
  }

  async function loadCustomerAkad(customerId: string) {
    if (!orgId) return;
    setAkadLoading(true);
    const { data: akadData, error: akadErr } = await supabase
      .from("kredit_syariah_akad")
      .select("id, organization_id, customer_id, total_amount, tenor_bulan, angsuran_per_bulan, status, tanggal_mulai, tanggal_jatuh_tempo, created_at, updated_at")
      .eq("organization_id", orgId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (akadErr || !akadData || akadData.length === 0) {
      setAkadRows([]);
      setAkadLoading(false);
      return;
    }
    const akadList = akadData as KreditSyariahAkad[];
    const ids = akadList.map((a) => a.id);
    const { data: angsuranData } = await supabase
      .from("kredit_syariah_angsuran")
      .select("akad_id, jumlah_bayar")
      .in("akad_id", ids);
    const paidMap = new Map<string, number>();
    (angsuranData as KreditSyariahAngsuran[] | null ?? []).forEach((row) => {
      const prev = paidMap.get(row.akad_id) ?? 0;
      paidMap.set(row.akad_id, prev + Number(row.jumlah_bayar));
    });
    const extended = akadList.map((a) => {
      const totalPaid = paidMap.get(a.id) ?? 0;
      const remaining = Math.max(0, Number(a.total_amount) - totalPaid);
      return { ...a, totalPaid, remaining };
    });
    setAkadRows(extended);
    setAkadLoading(false);
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
    };
    if (editing) {
      const { error: err } = await supabase
        .from("customers")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("customers").insert(payload);
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
    const { error: err } = await supabase.from("customers").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  function handleCopyCatalogLink() {
    if (!catalogUrl) return;
    navigator.clipboard.writeText(catalogUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function generateInviteToken(): string {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  async function handleTambahAkun(row: Customer) {
    if (!row.email?.trim()) {
      setError("Isi email pelanggan terlebih dahulu (edit pelanggan) agar bisa mengundang akun.");
      return;
    }
    setInviteLoading(true);
    setError(null);
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const { error: err } = await supabase
      .from("customers")
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
    const link = `${window.location.origin}/daftar-pelanggan?token=${token}`;
    setInviteLink(link);
    setInviteCustomer(row);
    fetchData();
  }

  function copyInviteLink() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  const columns: Column<Customer>[] = [
    { key: "name", header: "Nama" },
    { key: "phone", header: "Telepon" },
    { key: "email", header: "Email" },
    {
      key: "akun",
      header: "Akun",
      render: (row) => {
        if (row.user_id) {
          return <span className="text-sm text-emerald-600">Terhubung</span>;
        }
        if (!row.email?.trim()) {
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
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Pelanggan</h2>
          <p className="text-[var(--muted-foreground)]">Kelola data pelanggan organisasi.</p>
        </div>
        {orgId && (
          <Button variant="outline" size="sm" onClick={handleCopyCatalogLink} disabled={!catalogUrl}>
            {linkCopied ? "Tersalin!" : "Salin Link Katalog"}
          </Button>
        )}
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
        emptyMessage="Belum ada pelanggan. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Pelanggan"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Pelanggan" : "Tambah Pelanggan"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nama pelanggan"
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
                placeholder="08xxx"
              />
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
          {editing && (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
                Kredit Syariah (Cicilan)
              </h3>
              {akadLoading ? (
                <p className="text-xs text-[var(--muted-foreground)]">Memuat data cicilan...</p>
              ) : akadRows.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Pelanggan ini belum memiliki akad cicilan.
                </p>
              ) : (
                <>
                  <div className="mb-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3">
                      <p className="text-xs text-[var(--muted-foreground)]">Total Pembiayaan</p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatIdr(
                          akadRows.reduce(
                            (sum, a) => sum + Number(a.total_amount),
                            0
                          )
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3">
                      <p className="text-xs text-[var(--muted-foreground)]">Total Sudah Dibayar</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-600">
                        {formatIdr(akadRows.reduce((sum, a) => sum + a.totalPaid, 0))}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3">
                      <p className="text-xs text-[var(--muted-foreground)]">Total Belum Dibayar</p>
                      <p className="mt-1 text-sm font-semibold text-red-600">
                        {formatIdr(akadRows.reduce((sum, a) => sum + a.remaining, 0))}
                      </p>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)]">
                          <th className="px-3 py-2 text-left font-medium">Akad</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="px-3 py-2 text-right font-medium">Sudah Dibayar</th>
                          <th className="px-3 py-2 text-right font-medium">Sisa</th>
                          <th className="px-3 py-2 text-left font-medium">Mulai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {akadRows.map((a) => (
                          <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="px-3 py-2 font-mono">
                              #{a.id.slice(0, 8)}
                            </td>
                            <td className="px-3 py-2 capitalize">
                              {a.status}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatIdr(Number(a.total_amount))}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-600">
                              {formatIdr(a.totalPaid)}
                            </td>
                            <td className="px-3 py-2 text-right text-red-600">
                              {formatIdr(a.remaining)}
                            </td>
                            <td className="px-3 py-2">
                              {a.tanggal_mulai ? formatDate(a.tanggal_mulai) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
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
        title="Hapus Pelanggan"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />

      <Modal
        open={!!inviteCustomer}
        onClose={() => { setInviteCustomer(null); setInviteLink(null); }}
        title="Tambah akun pelanggan"
        size="md"
      >
        {inviteCustomer && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Bagikan link berikut ke <strong>{inviteCustomer.name}</strong> ({inviteCustomer.email}).
              Pelanggan buka link, daftar dengan email tersebut, lalu bisa login dan belanja di katalog.
            </p>
            {inviteLink && (
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteLink}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  {linkCopied ? "Tersalin!" : "Salin"}
                </Button>
              </div>
            )}
            <p className="text-xs text-[var(--muted-foreground)]">
              Link berlaku 7 hari. Jika kadaluarsa, klik &quot;Tambah akun&quot; lagi untuk buat link baru.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => { setInviteCustomer(null); setInviteLink(null); }}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

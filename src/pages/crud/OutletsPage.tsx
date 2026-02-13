import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import type { Outlet, OutletType } from "@/lib/database.types";

const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  gudang: "Gudang",
  mart: "Mart / Retail",
  fnb: "F&B (Food & Beverage)",
  barbershop: "Barbershop",
};

export function OutletsPage() {
  const { orgId, outlets } = useOrg();
  const [data, setData] = useState<Outlet[]>(outlets);
  const [loading, setLoading] = useState(true);
  const [outletLimit, setOutletLimit] = useState<number>(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Outlet | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    address: string;
    timezone: string;
    outlet_type: OutletType;
  }>({ name: "", address: "", timezone: "Asia/Jakarta", outlet_type: "mart" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const [outletsRes, subRes] = await Promise.all([
      supabase
        .from("outlets")
        .select("*")
        .eq("organization_id", orgId)
        .order("is_default", { ascending: false })
        .order("created_at"),
      supabase
        .from("subscriptions")
        .select("subscription_plans(outlet_limit)")
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);
    setLoading(false);
    const err = outletsRes.error;
    if (err) {
      setError(err.message);
      return;
    }
    setData(outletsRes.data ?? []);
    const plan = (subRes.data as { subscription_plans?: { outlet_limit: number } } | null)?.subscription_plans;
    setOutletLimit(plan?.outlet_limit ?? 1);
    setError(null);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  function openAdd() {
    if (outletLimit < 999 && data.length >= outletLimit) {
      setError(`Limit outlet tercapai (${outletLimit}). Upgrade paket untuk menambah outlet.`);
      return;
    }
    setEditing(null);
    setForm({ name: "", address: "", timezone: "Asia/Jakarta", outlet_type: "mart" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: Outlet) {
    setEditing(row);
    setForm({
      name: row.name,
      address: row.address ?? "",
      timezone: row.timezone ?? "Asia/Jakarta",
      outlet_type: (row.outlet_type as OutletType) ?? "mart",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !orgId) return;
    if (!editing && outletLimit < 999 && data.length >= outletLimit) {
      setError(`Limit outlet tercapai (${outletLimit}). Upgrade paket untuk menambah outlet.`);
      return;
    }
    setSubmitLoading(true);
    setError(null);
    const hasExisting = data.length > 0;
    const payload = {
      organization_id: orgId,
      name: form.name.trim(),
      address: form.address.trim() || null,
      timezone: form.timezone,
      outlet_type: form.outlet_type,
      is_default: !hasExisting && !editing,
    };
    if (editing) {
      const { error: err } = await supabase
        .from("outlets")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("outlets").insert(payload);
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
    const { error: err } = await supabase.from("outlets").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<Outlet>[] = [
    {
      key: "name",
      header: "Nama",
      render: (r) => (
        <span className="flex items-center gap-2">
          {r.name}
          {r.is_default && <Badge variant="success">Default</Badge>}
        </span>
      ),
    },
    {
      key: "outlet_type",
      header: "Jenis",
      render: (r) => OUTLET_TYPE_LABELS[(r.outlet_type as OutletType) ?? "mart"],
    },
    { key: "address", header: "Alamat", render: (r) => r.address ?? "-" },
    { key: "timezone", header: "Zona Waktu" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Outlets</h2>
        <p className="text-[var(--muted-foreground)]">Kelola outlet/cabang organisasi.</p>
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
        emptyMessage="Belum ada outlet. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Outlet"
        addDisabled={outletLimit < 999 && data.length >= outletLimit}
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Outlet" : "Tambah Outlet"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nama outlet"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Alamat</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Alamat outlet"
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jenis Outlet *</label>
            <select
              value={form.outlet_type}
              onChange={(e) => setForm((f) => ({ ...f, outlet_type: e.target.value as OutletType }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {Object.entries(OUTLET_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Gudang: hanya fitur stok & pembelian. Mart/F&B/Barbershop: POS, penjualan, dll.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Zona Waktu</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
              <option value="UTC">UTC</option>
            </select>
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
        title="Hapus Outlet"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

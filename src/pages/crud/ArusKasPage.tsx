import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import type { CashFlow } from "@/lib/database.types";

export function ArusKasPage() {
  const { orgId, currentOutletId } = useOrg();
  const [data, setData] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CashFlow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashFlow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ type: "in" as "in" | "out", amount: "", description: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    let query = supabase
      .from("cash_flows")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (currentOutletId) {
      query = query.or(`outlet_id.is.null,outlet_id.eq.${currentOutletId}`);
    }
    const { data: rows, error: err } = await query;
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
    setForm({ type: "in", amount: "", description: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: CashFlow) {
    setEditing(row);
    setForm({
      type: row.type as "in" | "out",
      amount: String(row.amount),
      description: row.description ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0 || !orgId) return;
    setSubmitLoading(true);
    setError(null);
    const amount = Math.abs(parseFloat(form.amount));
    const payload = {
      organization_id: orgId,
      outlet_id: currentOutletId,
      type: form.type,
      amount,
      description: form.description.trim() || null,
    };
    if (editing) {
      const { error: err } = await supabase
        .from("cash_flows")
        .update({ ...payload })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error: err } = await supabase.from("cash_flows").insert(payload);
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
    const { error: err } = await supabase.from("cash_flows").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<CashFlow>[] = [
    {
      key: "created_at",
      header: "Tanggal",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "type",
      header: "Jenis",
      render: (row) =>
        row.type === "in" ? (
          <Badge variant="success">Masuk</Badge>
        ) : (
          <Badge variant="destructive">Keluar</Badge>
        ),
    },
    {
      key: "amount",
      header: "Jumlah",
      render: (row) => formatIdr(Number(row.amount)),
    },
    { key: "description", header: "Keterangan", render: (row) => row.description ?? "-" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Arus Kas</h2>
        <p className="text-[var(--muted-foreground)]">Kelola transaksi kas masuk dan keluar.</p>
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
        emptyMessage="Belum ada transaksi. Klik Tambah untuk menambah."
        onAdd={openAdd}
        addLabel="Tambah Transaksi"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Transaksi" : "Tambah Transaksi"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jenis</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "in" | "out" }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="in">Kas Masuk</option>
              <option value="out">Kas Keluar</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jumlah (Rp) *</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Keterangan</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Keterangan transaksi"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
        title="Hapus Transaksi"
        message="Yakin ingin menghapus transaksi ini?"
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

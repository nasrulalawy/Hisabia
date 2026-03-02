import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { postJournalEntry } from "@/lib/accounting";
import type { Receivable } from "@/lib/database.types";
import type { Payable } from "@/lib/database.types";

type Tab = "piutang" | "hutang";

interface ReceivableWithCustomer extends Receivable {
  customers?: { name: string; phone: string | null } | null;
}

interface PayableWithSupplier extends Payable {
  suppliers?: { name: string } | null;
}

function PiutangSection() {
  const { orgId, currentOutletId } = useOrg();
  const [data, setData] = useState<ReceivableWithCustomer[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReceivableWithCustomer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReceivableWithCustomer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ customer_id: "", amount: "", paid: "", due_date: "", notes: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name");
    setCustomers(cust ?? []);

    const { data: rows, error: err } = await supabase
      .from("receivables")
      .select("*, customers(name, phone)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
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
    setForm({ customer_id: "", amount: "", paid: "0", due_date: "", notes: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: ReceivableWithCustomer) {
    setEditing(row);
    setForm({
      customer_id: row.customer_id ?? "",
      amount: String(row.amount),
      paid: String(row.paid ?? 0),
      due_date: row.due_date ? row.due_date.toString().slice(0, 10) : "",
      notes: row.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0 || !orgId) return;
    setSubmitLoading(true);
    setError(null);
    const paidAmount = parseFloat(form.paid) || 0;
    const payload = {
      organization_id: orgId,
      customer_id: form.customer_id || null,
      amount: parseFloat(form.amount),
      paid: paidAmount,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error: err } = await supabase
        .from("receivables")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        const prevPaid = Number(editing.paid ?? 0);
        const paidDiff = paidAmount - prevPaid;
        if (paidDiff > 0) {
          const { data: cf } = await supabase
            .from("cash_flows")
            .insert({
              organization_id: orgId,
              outlet_id: currentOutletId,
              type: "in",
              amount: paidDiff,
              description: `Pembayaran piutang ${editing.customers?.name ?? ""}`.trim(),
              reference_type: "receivable",
              reference_id: editing.id,
            })
            .select("id")
            .single();
          if (cf) {
            const d = new Date().toISOString().slice(0, 10);
            await postJournalEntry({
              organization_id: orgId,
              entry_date: d,
              description: `Pembayaran piutang ${editing.customers?.name ?? ""}`.trim(),
              reference_type: "cash_flow",
              reference_id: cf.id,
              lines: [
                { code: "1-1", debit: paidDiff, credit: 0 },
                { code: "1-2", debit: 0, credit: paidDiff },
              ],
            });
          }
        }
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { data: inserted, error: err } = await supabase.from("receivables").insert(payload).select("id").single();
      if (err) setError(err.message);
      else if (inserted) {
        const d = new Date().toISOString().slice(0, 10);
        await postJournalEntry({
          organization_id: orgId,
          entry_date: d,
          description: form.notes.trim() || "Piutang usaha",
          reference_type: "receivable",
          reference_id: inserted.id,
          lines: [
            { code: "1-2", debit: parseFloat(form.amount), credit: 0 },
            { code: "4-1", debit: 0, credit: parseFloat(form.amount) },
          ],
        });
        if (paidAmount > 0) {
          const { data: cf } = await supabase
            .from("cash_flows")
            .insert({
              organization_id: orgId,
              outlet_id: currentOutletId,
              type: "in",
              amount: paidAmount,
              description: `Pembayaran piutang`,
              reference_type: "receivable",
              reference_id: inserted.id,
            })
            .select("id")
            .single();
          if (cf) {
            await postJournalEntry({
              organization_id: orgId,
              entry_date: d,
              description: "Pembayaran piutang",
              reference_type: "cash_flow",
              reference_id: cf.id,
              lines: [
                { code: "1-1", debit: paidAmount, credit: 0 },
                { code: "1-2", debit: 0, credit: paidAmount },
              ],
            });
          }
        }
        setModalOpen(false);
        fetchData();
      }
    }
    setSubmitLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error: err } = await supabase.from("receivables").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<ReceivableWithCustomer>[] = [
    { key: "customers", header: "Pelanggan", render: (r) => r.customers?.name ?? "-" },
    { key: "amount", header: "Jumlah", render: (r) => formatIdr(Number(r.amount)) },
    { key: "paid", header: "Dibayar", render: (r) => formatIdr(Number(r.paid ?? 0)) },
    {
      key: "sisa",
      header: "Sisa",
      render: (r) => formatIdr(Number(r.amount) - Number(r.paid ?? 0)),
    },
    { key: "due_date", header: "Jatuh Tempo", render: (r) => (r.due_date ? formatDate(r.due_date) : "-") },
  ];

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="Belum ada piutang."
        onAdd={openAdd}
        addLabel="Tambah Piutang"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Piutang" : "Tambah Piutang"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Pelanggan</label>
            <select
              value={form.customer_id}
              onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="">-- Pilih Pelanggan --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jumlah (Rp) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Sudah Dibayar (Rp)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.paid}
                onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jatuh Tempo</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
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
        title="Hapus Piutang"
        message="Yakin ingin menghapus data piutang ini?"
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </>
  );
}

function HutangSection() {
  const { orgId, currentOutletId } = useOrg();
  const [data, setData] = useState<PayableWithSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PayableWithSupplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayableWithSupplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", amount: "", paid: "", due_date: "", notes: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: sup } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name");
    setSuppliers(sup ?? []);

    const { data: rows, error: err } = await supabase
      .from("payables")
      .select("*, suppliers(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
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
    setForm({ supplier_id: "", amount: "", paid: "0", due_date: "", notes: "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(row: PayableWithSupplier) {
    setEditing(row);
    setForm({
      supplier_id: row.supplier_id ?? "",
      amount: String(row.amount),
      paid: String(row.paid ?? 0),
      due_date: row.due_date ? row.due_date.toString().slice(0, 10) : "",
      notes: row.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0 || !orgId) return;
    setSubmitLoading(true);
    setError(null);
    const paidAmount = parseFloat(form.paid) || 0;
    const payload = {
      organization_id: orgId,
      supplier_id: form.supplier_id || null,
      amount: parseFloat(form.amount),
      paid: paidAmount,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error: err } = await supabase
        .from("payables")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (err) setError(err.message);
      else {
        const prevPaid = Number(editing.paid ?? 0);
        const paidDiff = paidAmount - prevPaid;
        if (paidDiff > 0) {
          const { data: cf } = await supabase
            .from("cash_flows")
            .insert({
              organization_id: orgId,
              outlet_id: currentOutletId,
              type: "out",
              amount: paidDiff,
              description: `Pembayaran hutang ${editing.suppliers?.name ?? ""}`.trim(),
              reference_type: "payable",
              reference_id: editing.id,
            })
            .select("id")
            .single();
          if (cf) {
            const d = new Date().toISOString().slice(0, 10);
            await postJournalEntry({
              organization_id: orgId,
              entry_date: d,
              description: `Pembayaran hutang ${editing.suppliers?.name ?? ""}`.trim(),
              reference_type: "cash_flow",
              reference_id: cf.id,
              lines: [
                { code: "2-1", debit: paidDiff, credit: 0 },
                { code: "1-1", debit: 0, credit: paidDiff },
              ],
            });
          }
        }
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { data: inserted, error: err } = await supabase.from("payables").insert(payload).select("id").single();
      if (err) setError(err.message);
      else if (inserted) {
        const d = new Date().toISOString().slice(0, 10);
        await postJournalEntry({
          organization_id: orgId,
          entry_date: d,
          description: form.notes.trim() || "Hutang usaha",
          reference_type: "payable",
          reference_id: inserted.id,
          lines: [
            { code: "5-2", debit: parseFloat(form.amount), credit: 0 },
            { code: "2-1", debit: 0, credit: parseFloat(form.amount) },
          ],
        });
        if (paidAmount > 0) {
          const { data: cf } = await supabase
            .from("cash_flows")
            .insert({
              organization_id: orgId,
              outlet_id: currentOutletId,
              type: "out",
              amount: paidAmount,
              description: `Pembayaran hutang`,
              reference_type: "payable",
              reference_id: inserted.id,
            })
            .select("id")
            .single();
          if (cf) {
            await postJournalEntry({
              organization_id: orgId,
              entry_date: d,
              description: "Pembayaran hutang",
              reference_type: "cash_flow",
              reference_id: cf.id,
              lines: [
                { code: "2-1", debit: paidAmount, credit: 0 },
                { code: "1-1", debit: 0, credit: paidAmount },
              ],
            });
          }
        }
        setModalOpen(false);
        fetchData();
      }
    }
    setSubmitLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error: err } = await supabase.from("payables").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<PayableWithSupplier>[] = [
    { key: "suppliers", header: "Supplier", render: (r) => r.suppliers?.name ?? "-" },
    { key: "amount", header: "Jumlah", render: (r) => formatIdr(Number(r.amount)) },
    { key: "paid", header: "Dibayar", render: (r) => formatIdr(Number(r.paid ?? 0)) },
    {
      key: "sisa",
      header: "Sisa",
      render: (r) => formatIdr(Number(r.amount) - Number(r.paid ?? 0)),
    },
    { key: "due_date", header: "Jatuh Tempo", render: (r) => (r.due_date ? formatDate(r.due_date) : "-") },
  ];

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="Belum ada hutang."
        onAdd={openAdd}
        addLabel="Tambah Hutang"
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Hutang" : "Tambah Hutang"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Supplier</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="">-- Pilih Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jumlah (Rp) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Sudah Dibayar (Rp)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.paid}
                onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Jatuh Tempo</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
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
        title="Hapus Hutang"
        message="Yakin ingin menghapus data hutang ini?"
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </>
  );
}

export function HutangPiutangPage() {
  const [tab, setTab] = useState<Tab>("piutang");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Hutang & Piutang</h2>
        <p className="text-[var(--muted-foreground)]">Kelola piutang (tagihan) dan hutang (utang ke supplier).</p>
      </div>
      <div className="flex gap-2 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setTab("piutang")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "piutang"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Piutang
        </button>
        <button
          type="button"
          onClick={() => setTab("hutang")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "hutang"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Hutang
        </button>
      </div>
      {tab === "piutang" ? <PiutangSection /> : <HutangSection />}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatIdr, formatDate } from "@/lib/utils";
import type { SalesInvoice } from "@/lib/database.types";

interface InvoiceWithCustomer extends SalesInvoice {
  customers?: { name: string } | null;
}

export function InvoiceListPage() {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [data, setData] = useState<InvoiceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithCustomer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("sales_invoices")
      .select("*, customers(name)")
      .eq("organization_id", orgId)
      .order("invoice_date", { ascending: false });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setData((rows as InvoiceWithCustomer[]) ?? []);
    setError(null);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error: err } = await supabase.from("sales_invoices").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    sent: "Terkirim",
    paid: "Lunas",
    overdue: "Jatuh tempo",
    canceled: "Dibatalkan",
  };

  const columns: Column<InvoiceWithCustomer>[] = [
    { key: "number", header: "No. Invoice" },
    {
      key: "customers",
      header: "Pelanggan",
      render: (row) => row.customers?.name ?? "-",
    },
    {
      key: "invoice_date",
      header: "Tanggal",
      render: (row) => formatDate(row.invoice_date),
    },
    {
      key: "total",
      header: "Total",
      render: (row) => formatIdr(Number(row.total)),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => statusLabel[row.status] ?? row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Invoice</h2>
        <p className="text-[var(--muted-foreground)]">Faktur penjualan dan tagihan ke pelanggan.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="Belum ada invoice. Klik Tambah untuk membuat."
        onAdd={() => navigate("tambah")}
        addLabel="Tambah Invoice"
        onEdit={(row) => navigate(`${row.id}/edit`)}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Invoice"
        message={deleteTarget ? `Hapus invoice ${deleteTarget.number}?` : ""}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

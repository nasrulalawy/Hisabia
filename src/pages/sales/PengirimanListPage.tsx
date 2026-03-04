import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate } from "@/lib/utils";
import type { SalesDelivery } from "@/lib/database.types";

interface DeliveryWithInvoice extends SalesDelivery {
  sales_invoices?: { number: string } | null;
}

export function PengirimanListPage() {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [data, setData] = useState<DeliveryWithInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryWithInvoice | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("sales_deliveries")
      .select("*, sales_invoices(number)")
      .eq("organization_id", orgId)
      .order("delivery_date", { ascending: false });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    setData((rows as DeliveryWithInvoice[]) ?? []);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [orgId]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error: err } = await supabase.from("sales_deliveries").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const statusLabel: Record<string, string> = {
    pending: "Menunggu",
    partial: "Sebagian",
    delivered: "Terkirim",
  };

  const columns: Column<DeliveryWithInvoice>[] = [
    { key: "number", header: "No. Surat Jalan" },
    {
      key: "sales_invoices",
      header: "Invoice",
      render: (row) => row.sales_invoices?.number ?? "-",
    },
    {
      key: "delivery_date",
      header: "Tanggal",
      render: (row) => formatDate(row.delivery_date),
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
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Pengiriman</h2>
        <p className="text-[var(--muted-foreground)]">Surat jalan dan pengiriman berdasarkan invoice.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="Belum ada pengiriman. Klik Tambah untuk membuat."
        onAdd={() => navigate("tambah")}
        addLabel="Tambah Pengiriman"
        onEdit={(row) => navigate(`${row.id}/edit`)}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Pengiriman"
        message={deleteTarget ? `Hapus surat jalan ${deleteTarget.number}?` : ""}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

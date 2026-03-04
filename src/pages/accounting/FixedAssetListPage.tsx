import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatIdr, formatDate } from "@/lib/utils";
import type { FixedAsset } from "@/lib/database.types";

export function FixedAssetListPage() {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [data, setData] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FixedAsset | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [depreciationLoading, setDepreciationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depreciationResult, setDepreciationResult] = useState<{ depreciations_created: number; period: string } | null>(null);

  async function fetchData() {
    if (!orgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("fixed_assets")
      .select("*")
      .eq("organization_id", orgId)
      .order("code");
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

  async function runDepreciation() {
    if (!orgId) return;
    setDepreciationLoading(true);
    setError(null);
    setDepreciationResult(null);
    const now = new Date();
    const periodDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const { data: result, error: err } = await supabase.rpc("run_fixed_asset_depreciation", {
      p_org_id: orgId,
      p_period_date: periodDate,
    });
    setDepreciationLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDepreciationResult(result as { depreciations_created: number; period: string });
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error: err } = await supabase.from("fixed_assets").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<FixedAsset>[] = [
    { key: "code", header: "Kode" },
    { key: "name", header: "Nama" },
    {
      key: "purchase_date",
      header: "Tanggal Beli",
      render: (row) => formatDate(row.purchase_date),
    },
    {
      key: "purchase_value",
      header: "Nilai Perolehan",
      render: (row) => formatIdr(Number(row.purchase_value)),
    },
    {
      key: "useful_life_months",
      header: "Umur (bulan)",
    },
    { key: "status", header: "Status" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Aset Tetap</h2>
        <p className="text-[var(--muted-foreground)]">Kartu aset tetap dan penyusutan bulanan.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {depreciationResult !== null && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Penyusutan bulan ini: {depreciationResult.depreciations_created} aset diproses (periode {depreciationResult.period}).
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={runDepreciation}
          disabled={depreciationLoading}
        >
          {depreciationLoading ? "Memproses..." : "Hitung penyusutan bulan ini"}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="Belum ada aset tetap. Klik Tambah Aset untuk menambah."
        onAdd={() => navigate("tambah")}
        addLabel="Tambah Aset"
        onEdit={(row) => navigate(`${row.id}/edit`)}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Aset Tetap"
        message={deleteTarget ? `Yakin ingin menghapus aset "${deleteTarget.name}" (${deleteTarget.code})?` : ""}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, getStockStatus, getStockStatusLabel } from "@/lib/utils";
import { DataTable, type Column } from "@/components/crud/DataTable";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Product } from "@/lib/database.types";

interface ProductWithRelations extends Product {
  menu_categories?: { name: string } | null;
  suppliers?: { name: string } | null;
  units?: { symbol: string } | null;
}

export function ProdukListPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { orgId: ctxOrgId } = useOrg();
  const navigate = useNavigate();
  const [data, setData] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ProductWithRelations | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseOrgId = orgId ?? ctxOrgId;

  async function fetchData() {
    if (!baseOrgId) return;
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from("products")
      .select(
        `
        *,
        menu_categories(name),
        suppliers(name),
        units(symbol)
      `
      )
      .eq("organization_id", baseOrgId)
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
  }, [baseOrgId]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error: err } = await supabase.from("products").delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      fetchData();
    }
  }

  const columns: Column<ProductWithRelations>[] = [
    {
      key: "name",
      header: "Nama",
      render: (row) => (
        <Link
          to={`/org/${baseOrgId}/produk/${row.id}`}
          className="font-medium text-[var(--primary)] hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "menu_categories",
      header: "Kategori",
      render: (row) => row.menu_categories?.name ?? "-",
    },
    {
      key: "stock",
      header: "Stok",
      render: (row) => {
        const stock = Number(row.stock);
        const status = getStockStatus(stock);
        const label = getStockStatusLabel(status);
        return (
          <span className="flex items-center gap-2">
            <span>{stock} {row.units?.symbol ?? ""}</span>
            {label && (
              <Badge
                variant={status === "minus" || status === "empty" ? "destructive" : "warning"}
              >
                {label}
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      key: "cost_price",
      header: "HPP",
      render: (row) => formatIdr(Number(row.cost_price)),
    },
    {
      key: "selling_price",
      header: "Harga Jual",
      render: (row) => formatIdr(Number(row.selling_price)),
    },
    {
      key: "is_available",
      header: "Status",
      render: (row) =>
        row.is_available ? (
          <Badge variant="success">Aktif</Badge>
        ) : (
          <Badge variant="default">Nonaktif</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Produk</h2>
          <p className="text-[var(--muted-foreground)]">Kelola produk dan stok organisasi.</p>
        </div>
        <Link to={`/org/${baseOrgId}/produk/tambah`}>
          <Button>Tambah Produk</Button>
        </Link>
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
        emptyMessage="Belum ada produk. Klik Tambah Produk untuk menambah."
        onEdit={(row) => navigate(`/org/${baseOrgId}/produk/${row.id}`)}
        onDelete={(row) => setDeleteTarget(row)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Produk"
        message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

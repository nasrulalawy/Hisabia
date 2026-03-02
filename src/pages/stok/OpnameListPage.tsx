import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { StockOpnameSession } from "@/lib/database.types";

interface SessionWithWarehouse extends StockOpnameSession {
  warehouses?: { name: string } | null;
}

export function OpnameListPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { orgId: ctxOrgId } = useOrg();
  const baseOrgId = orgId ?? ctxOrgId;
  const [sessions, setSessions] = useState<SessionWithWarehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!baseOrgId) return;
    setLoading(true);
    supabase
      .from("stock_opname_sessions")
      .select("*, warehouses(name)")
      .eq("organization_id", baseOrgId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSessions((data as SessionWithWarehouse[]) ?? []);
        setLoading(false);
      });
  }, [baseOrgId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Stock Opname</h2>
          <p className="text-[var(--muted-foreground)]">
            Hitung fisik stok dan sesuaikan dengan sistem. Data tidak pernah dihapus.
          </p>
        </div>
        <Link to={`/org/${baseOrgId}/opname/baru`}>
          <Button>Buat Opname Baru</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Sesi Opname</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-8 text-center text-[var(--muted-foreground)]">Belum ada sesi opname.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">Tanggal</th>
                    <th className="pb-2 font-medium">Lokasi</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Finalisasi</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3">{formatDate(s.created_at)}</td>
                      <td className="py-3">{s.warehouse_id ? s.warehouses?.name ?? "-" : "Stok Toko"}</td>
                      <td className="py-3">
                        <Badge variant={s.status === "finalized" ? "success" : "warning"}>
                          {s.status === "finalized" ? "Finalized" : "Draft"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {s.finalized_at ? formatDate(s.finalized_at) : "-"}
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/org/${baseOrgId}/opname/${s.id}`}
                          className="text-[var(--primary)] hover:underline"
                        >
                          {s.status === "draft" ? "Edit" : "Lihat"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

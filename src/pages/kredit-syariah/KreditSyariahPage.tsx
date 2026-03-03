import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { KreditSyariahAkad, KreditSyariahAkadStatus } from "@/lib/database.types";

interface AkadRow extends KreditSyariahAkad {
  customers?: { name: string; phone: string | null } | null;
}

const STATUS_LABELS: Record<KreditSyariahAkadStatus, string> = {
  draft: "Draft",
  aktif: "Aktif",
  lunas: "Lunas",
  macet: "Macet",
};

const STATUS_CLASS: Record<KreditSyariahAkadStatus, string> = {
  draft: "bg-[var(--muted)]",
  aktif: "bg-emerald-100 text-emerald-700",
  lunas: "bg-blue-100 text-blue-700",
  macet: "bg-red-100 text-red-700",
};

export function KreditSyariahPage() {
  const { orgId, organizationFeatureGrants, currentOutletType } = useOrg();
  const { orgId: _routeOrgId } = useParams<{ orgId: string }>();
  const [list, setList] = useState<AkadRow[]>([]);
  const hasGrant = organizationFeatureGrants?.includes("kredit_syariah") ?? false;
  const isMart = currentOutletType === "mart";
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<KreditSyariahAkadStatus | "">("");

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("kredit_syariah_akad")
        .select("*, customers(name, phone)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (filterStatus) q = q.eq("status", filterStatus);
      const { data } = await q;
      if (!cancelled) {
        setList((data ?? []) as AkadRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, filterStatus]);

  if (!hasGrant || !isMart) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-[var(--muted-foreground)]">
            Fitur Kredit Syariah hanya tersedia untuk usaha tipe Mart dan organisasi yang telah diberi izin oleh admin.
          </p>
          <Link to={`/org/${orgId}/dashboard`} className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline">
            Kembali ke Dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Kredit Syariah</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Pembiayaan tanpa bunga (akad murabahah/qard). Hanya untuk organisasi yang telah diberi izin.
          </p>
        </div>
        <Link to={`/org/${orgId}/kredit-syariah/baru`}>
          <Button>Buat Akad Baru</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Akad</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFilterStatus("")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                filterStatus === "" ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              Semua
            </button>
            {(Object.keys(STATUS_LABELS) as KreditSyariahAkadStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  filterStatus === s ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-[var(--muted-foreground)]">
              Belum ada akad. Klik &quot;Buat Akad Baru&quot; untuk menambah.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">Pelanggan</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Tenor</th>
                    <th className="pb-2 font-medium">Angsuran/bulan</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Jatuh Tempo</th>
                    <th className="pb-2 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 font-medium">{row.customers?.name ?? "—"}</td>
                      <td className="py-3">{formatIdr(Number(row.total_amount))}</td>
                      <td className="py-3">{row.tenor_bulan} bln</td>
                      <td className="py-3">{formatIdr(Number(row.angsuran_per_bulan))}</td>
                      <td className="py-3">
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[row.status]}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="py-3 text-[var(--muted-foreground)]">
                        {row.tanggal_jatuh_tempo ? formatDate(row.tanggal_jatuh_tempo) : "—"}
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/org/${orgId}/kredit-syariah/${row.id}`}
                          className="text-[var(--primary)] hover:underline"
                        >
                          Detail
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

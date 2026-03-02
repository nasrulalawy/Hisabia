import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface PeriodLock {
  id: string;
  period: string;
  locked_at: string;
}

export function TutupBukuPage() {
  const { orgId } = useOrg();
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function getPeriods(): string[] {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }

  async function fetchLocks() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("period_locks")
      .select("id, period, locked_at")
      .eq("organization_id", orgId);
    setLocks(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchLocks();
  }, [orgId]);

  const lockedSet = new Set(locks.map((l) => l.period));
  const periods = getPeriods();

  async function lock(period: string) {
    if (!orgId) return;
    setActionLoading(period);
    setError(null);
    const { error: err } = await supabase.rpc("lock_period", { p_org_id: orgId, p_period: period });
    setActionLoading(null);
    if (err) setError(err.message);
    else await fetchLocks();
  }

  async function unlock(period: string) {
    if (!orgId) return;
    setActionLoading(period);
    setError(null);
    const { error: err } = await supabase.rpc("unlock_period", { p_org_id: orgId, p_period: period });
    setActionLoading(null);
    if (err) setError(err.message);
    else await fetchLocks();
  }

  const lockInfo = (period: string) => locks.find((l) => l.period === period);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Tutup Buku</h2>
        <p className="text-[var(--muted-foreground)]">
          Kunci periode agar jurnal pada periode tersebut tidak bisa ditambah atau diubah. Data tidak dihapus.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
                <th className="px-3 py-2 text-left font-medium">Periode</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Dikunci pada</th>
                <th className="px-3 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => {
                const isLocked = lockedSet.has(period);
                const info = lockInfo(period);
                const [y, m] = period.split("-");
                const periodLabel = `${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][parseInt(m, 10) - 1]} ${y}`;
                return (
                  <tr key={period} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2 font-medium">{periodLabel}</td>
                    <td className="px-3 py-2">
                      {isLocked ? (
                        <Badge variant="destructive">Terkunci</Badge>
                      ) : (
                        <Badge variant="secondary">Terbuka</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      {info ? formatDate(info.locked_at) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isLocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unlock(period)}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === period ? "..." : "Buka"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => lock(period)}
                          disabled={actionLoading !== null}
                        >
                          {actionLoading === period ? "..." : "Kunci"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

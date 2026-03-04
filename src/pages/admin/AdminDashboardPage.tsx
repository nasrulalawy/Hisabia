import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AdminStats } from "./adminTypes";

export function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    supabase.rpc("get_admin_stats").then(({ data }) => {
      const d = data as (AdminStats & { error?: string }) | null;
      if (d?.error) setError(d.error);
      else if (d) setStats(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Dashboard</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">Ringkasan platform Hisabia</p>
      </div>
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Organisasi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.orgCount}</p>
            </CardContent>
          </Card>
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Pengguna</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.userCount}</p>
            </CardContent>
          </Card>
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Subscription Aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.activeSubscriptions}</p>
            </CardContent>
          </Card>
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Transaksi Hari Ini</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.ordersToday}</p>
            </CardContent>
          </Card>
          <Card className="border-[var(--border)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Revenue Bulan Ini</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{formatIdr(stats.revenueMonth)}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

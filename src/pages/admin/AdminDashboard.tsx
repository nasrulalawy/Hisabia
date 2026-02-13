import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface AdminStats {
  orgCount: number;
  userCount: number;
  activeSubscriptions: number;
  ordersToday: number;
  revenueMonth: number;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  outlet_count: number;
  sub_status: string | null;
  plan_name: string | null;
}

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);

  useEffect(() => {
    (async () => {
      const [statsRes, orgsRes] = await Promise.all([
        supabase.rpc("get_admin_stats"),
        supabase.rpc("get_admin_organizations"),
      ]);
      const statsData = statsRes.data as { error?: string } & AdminStats | null;
      const orgsData = orgsRes.data as { error?: string } | OrgRow[] | null;

      if (statsData?.error) {
        setError(statsData.error);
        setLoading(false);
        return;
      }
      if (Array.isArray(orgsData)) {
        setOrgs(orgsData);
      } else if (orgsData && typeof orgsData === "object" && "error" in orgsData) {
        setError((orgsData as { error?: string }).error ?? "Gagal memuat organisasi");
      }
      if (statsData && !statsData.error) {
        setStats({
          orgCount: statsData.orgCount ?? 0,
          userCount: statsData.userCount ?? 0,
          activeSubscriptions: statsData.activeSubscriptions ?? 0,
          ordersToday: statsData.ordersToday ?? 0,
          revenueMonth: statsData.revenueMonth ?? 0,
        });
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--muted)] p-6">
        <p className="text-center text-lg text-red-600">{error}</p>
        <Link to="/" className="text-[var(--primary)] hover:underline">
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Hisabia Admin</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Ke Aplikasi
            </Link>
            <Link
              to="/logout"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              Keluar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Dashboard SaaS</h2>
          <p className="text-[var(--muted-foreground)]">Ringkasan platform Hisabia</p>
        </div>

        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Organisasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.orgCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Pengguna
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.userCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Subscription Aktif
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {stats.activeSubscriptions}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Transaksi Hari Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.ordersToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Revenue Bulan Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatIdr(stats.revenueMonth)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Daftar Organisasi</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Semua toko/organisasi yang terdaftar
            </p>
          </CardHeader>
          <CardContent>
            {orgs.length === 0 ? (
              <p className="py-8 text-center text-[var(--muted-foreground)]">
                Belum ada organisasi
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                      <th className="pb-3 font-medium">Nama</th>
                      <th className="pb-3 font-medium">Slug</th>
                      <th className="pb-3 font-medium">Plan</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Member</th>
                      <th className="pb-3 font-medium">Outlet</th>
                      <th className="pb-3 font-medium">Dibuat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org) => (
                      <tr
                        key={org.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="py-3 font-medium">{org.name}</td>
                        <td className="py-3 font-mono text-xs">{org.slug}</td>
                        <td className="py-3">{org.plan_name ?? "—"}</td>
                        <td className="py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              org.sub_status === "active" || org.sub_status === "trialing"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-[var(--muted)]"
                            }`}
                          >
                            {org.sub_status ?? "—"}
                          </span>
                        </td>
                        <td className="py-3">{org.member_count}</td>
                        <td className="py-3">{org.outlet_count}</td>
                        <td className="py-3 text-[var(--muted-foreground)]">
                          {formatDate(org.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

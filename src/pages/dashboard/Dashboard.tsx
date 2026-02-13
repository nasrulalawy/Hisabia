import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DailySales {
  date: string;
  total: number;
  label: string;
}

interface CashFlowData {
  name: string;
  value: number;
  color: string;
}

export function Dashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const { orgId: ctxOrgId } = useOrg();
  const baseOrgId = orgId ?? ctxOrgId;

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7" | "14" | "30">("7");
  const [stats, setStats] = useState({
    salesToday: 0,
    salesWeek: 0,
    salesMonth: 0,
    ordersToday: 0,
    ordersWeek: 0,
    cashIn: 0,
    cashOut: 0,
    receivableUnpaid: 0,
    payableUnpaid: 0,
    productCount: 0,
    outletCount: 0,
  });
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [cashFlowChart, setCashFlowChart] = useState<CashFlowData[]>([]);
  const [recentOrders, setRecentOrders] = useState<
    { id: string; total: number; status: string; created_at: string }[]
  >([]);

  useEffect(() => {
    if (!baseOrgId) return;
    setLoading(true);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    Promise.all([
      // Orders - penjualan
      supabase
        .from("orders")
        .select("total, created_at")
        .eq("organization_id", baseOrgId)
        .eq("status", "paid"),
      // Cash flows
      supabase
        .from("cash_flows")
        .select("type, amount, created_at")
        .eq("organization_id", baseOrgId)
        .gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      // Receivables
      supabase
        .from("receivables")
        .select("amount, paid")
        .eq("organization_id", baseOrgId),
      // Payables
      supabase
        .from("payables")
        .select("amount, paid")
        .eq("organization_id", baseOrgId),
      // Products count
      supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", baseOrgId),
      // Outlets count
      supabase.from("outlets").select("id", { count: "exact", head: true }).eq("organization_id", baseOrgId),
      // Recent orders
      supabase
        .from("orders")
        .select("id, total, status, created_at")
        .eq("organization_id", baseOrgId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]).then(
      ([ordersRes, cashRes, recRes, payRes, prodRes, outRes, recentRes]) => {
        const orders = ordersRes.data ?? [];
        const cashFlows = cashRes.data ?? [];
        const receivables = recRes.data ?? [];
        const payables = payRes.data ?? [];

        const salesToday = orders
          .filter((o) => o.created_at >= todayStart)
          .reduce((s, o) => s + Number(o.total), 0);
        const ordersToday = orders.filter((o) => o.created_at >= todayStart).length;

        const salesWeek = orders
          .filter((o) => new Date(o.created_at) >= weekStart)
          .reduce((s, o) => s + Number(o.total), 0);
        const ordersWeek = orders.filter((o) => new Date(o.created_at) >= weekStart).length;

        const salesMonth = orders
          .filter((o) => o.created_at >= monthStart)
          .reduce((s, o) => s + Number(o.total), 0);

        let cashIn = 0,
          cashOut = 0;
        cashFlows.forEach((c) => {
          const amt = Number(c.amount);
          if (c.type === "in") cashIn += amt;
          else cashOut += amt;
        });

        let recUnpaid = 0;
        receivables.forEach((r) => {
          recUnpaid += Number(r.amount) - Number(r.paid ?? 0);
        });

        let payUnpaid = 0;
        payables.forEach((r) => {
          payUnpaid += Number(r.amount) - Number(r.paid ?? 0);
        });

        setStats({
          salesToday,
          salesWeek,
          salesMonth,
          ordersToday,
          ordersWeek,
          cashIn,
          cashOut,
          receivableUnpaid: recUnpaid,
          payableUnpaid: payUnpaid,
          productCount: prodRes.count ?? 0,
          outletCount: outRes.count ?? 0,
        });

        // Daily sales for chart (last N days)
        const days = parseInt(period, 10);
        const dayMap: Record<string, number> = {};
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          dayMap[key] = 0;
        }
        orders.forEach((o) => {
          const key = o.created_at.slice(0, 10);
          if (key in dayMap) dayMap[key] += Number(o.total);
        });
        setDailySales(
          Object.entries(dayMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, total]) => ({
              date,
              total,
              label: new Date(date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric" }),
            }))
        );

        setCashFlowChart([
          { name: "Kas Masuk", value: cashIn, color: "var(--primary)" },
          { name: "Kas Keluar", value: cashOut, color: "#ef4444" },
        ]);

        setRecentOrders(
          (recentRes.data ?? []).map((o) => ({
            id: o.id,
            total: Number(o.total),
            status: o.status,
            created_at: o.created_at,
          }))
        );

        setLoading(false);
      }
    );
  }, [baseOrgId, period]);

  if (loading && !stats.outletCount && !stats.productCount) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Dashboard</h2>
        <p className="text-[var(--muted-foreground)]">Ringkasan usaha dan aktivitas terbaru.</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
              Penjualan Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--foreground)]">{formatIdr(stats.salesToday)}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{stats.ordersToday} transaksi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
              Penjualan 7 Hari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--foreground)]">{formatIdr(stats.salesWeek)}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{stats.ordersWeek} transaksi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
              Penjualan Bulan Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--primary)]">{formatIdr(stats.salesMonth)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
              Net Arus Kas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                stats.cashIn - stats.cashOut >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatIdr(stats.cashIn - stats.cashOut)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Masuk {formatIdr(stats.cashIn)} / Keluar {formatIdr(stats.cashOut)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Grafik Penjualan */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Penjualan per Hari</CardTitle>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "7" | "14" | "30")}
              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
            >
              <option value="7">7 hari</option>
              <option value="14">14 hari</option>
              <option value="30">30 hari</option>
            </select>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis
                    tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}jt` : v >= 1e3 ? `${v / 1e3}k` : v)}
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [value != null ? formatIdr(value) : "-", "Total"]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.date ? formatDate(payload[0].payload.date) : label
                    }
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grafik Arus Kas */}
        <Card>
          <CardHeader>
            <CardTitle>Arus Kas (30 hari terakhir)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {stats.cashIn === 0 && stats.cashOut === 0 ? (
                <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
                  Belum ada data arus kas
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cashFlowChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {cashFlowChart.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) => (value != null ? formatIdr(value) : "-")}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Piutang & Hutang */}
        <Card>
          <CardHeader>
            <CardTitle>Piutang Belum Lunas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatIdr(stats.receivableUnpaid)}</p>
            <Link
              to={`/org/${baseOrgId}/hutang-piutang`}
              className="mt-2 inline-block text-sm text-[var(--primary)] hover:underline"
            >
              Lihat detail →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hutang Belum Lunas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatIdr(stats.payableUnpaid)}</p>
            <Link
              to={`/org/${baseOrgId}/hutang-piutang`}
              className="mt-2 inline-block text-sm text-[var(--primary)] hover:underline"
            >
              Lihat detail →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Outlets</span>
              <span className="font-medium">{stats.outletCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Produk</span>
              <span className="font-medium">{stats.productCount}</span>
            </div>
            <Link
              to={`/org/${baseOrgId}/pos`}
              className="mt-3 block text-center text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Buka POS →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Transaksi Terbaru */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transaksi Terbaru</CardTitle>
          <Link
            to={`/org/${baseOrgId}/arus-kas`}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Lihat semua
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="py-8 text-center text-[var(--muted-foreground)]">Belum ada transaksi</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Tanggal</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="py-3">{formatDate(o.created_at)}</td>
                      <td className="py-3 font-medium">{formatIdr(o.total)}</td>
                      <td className="py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            o.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[var(--muted)]"
                          }`}
                        >
                          {o.status === "paid" ? "Lunas" : o.status === "pending" ? "Pending" : o.status}
                        </span>
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

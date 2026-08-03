import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
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

interface PosisiKeuanganItem {
  name: string;
  value: number;
  color: string;
}

interface PenjualanHarianItem {
  date: string;
  total: number;
  label: string;
}

const CHART_COLORS = {
  kas: "#22c55e",
  piutang: "#3b82f6",
  hutang: "#ef4444",
  persediaan: "#f59e0b",
  laba: "#8b5cf6",
};

export function DashboardKeuanganPage() {
  const { orgId, currentOutletId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [kas, setKas] = useState(0);
  const [piutang, setPiutang] = useState(0);
  const [hutang, setHutang] = useState(0);
  const [persediaan, setPersediaan] = useState(0);
  const [labaPeriode, setLabaPeriode] = useState(0);
  const [penjualanHariIni, setPenjualanHariIni] = useState(0);
  const [chartPosisi, setChartPosisi] = useState<PosisiKeuanganItem[]>([]);
  const [chartPenjualanHarian, setChartPenjualanHarian] = useState<PenjualanHarianItem[]>([]);

  useEffect(() => {
    if (!orgId || !currentOutletId) return;
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    (async () => {
      // Isolasi outlet: kas & piutang/hutang dari data outlet, bukan jurnal org-wide
      const [cashRes, recRes, payRes, prodRes, stockRes, ordersTodayRes] = await Promise.all([
        supabase
          .from("cash_flows")
          .select("type, amount")
          .eq("organization_id", orgId)
          .eq("outlet_id", currentOutletId),
        supabase
          .from("receivables")
          .select("amount, paid")
          .eq("organization_id", orgId)
          .eq("outlet_id", currentOutletId),
        supabase
          .from("payables")
          .select("amount, paid")
          .eq("organization_id", orgId)
          .eq("outlet_id", currentOutletId),
        supabase
          .from("products")
          .select("id, cost_price")
          .eq("organization_id", orgId),
        supabase
          .from("outlet_product_stock")
          .select("product_id, stock")
          .eq("outlet_id", currentOutletId),
        supabase
          .from("orders")
          .select("total")
          .eq("organization_id", orgId)
          .eq("outlet_id", currentOutletId)
          .eq("status", "paid")
          .gte("created_at", todayStart.toISOString()),
      ]);

      let vKas = 0;
      (cashRes.data ?? []).forEach((c: { type: string; amount: number }) => {
        const amt = Number(c.amount) || 0;
        if (c.type === "in") vKas += amt;
        else vKas -= amt;
      });

      let vPiutang = 0;
      (recRes.data ?? []).forEach((r: { amount: number; paid?: number }) => {
        vPiutang += Number(r.amount) - Number(r.paid ?? 0);
      });

      let vHutang = 0;
      (payRes.data ?? []).forEach((r: { amount: number; paid?: number }) => {
        vHutang += Number(r.amount) - Number(r.paid ?? 0);
      });

      const stockMap: Record<string, number> = {};
      ((stockRes.data as { product_id: string; stock: number }[]) ?? []).forEach((s) => {
        stockMap[s.product_id] = Number(s.stock ?? 0);
      });
      let vPersediaan = 0;
      (prodRes.data ?? []).forEach((p: { id: string; cost_price: number }) => {
        vPersediaan += Number(p.cost_price ?? 0) * (stockMap[p.id] ?? 0);
      });

      const penjualan = (ordersTodayRes.data ?? []).reduce(
        (s, o: { total: number }) => s + Number(o.total),
        0
      );
      setPenjualanHariIni(penjualan);
      setKas(vKas);
      setPiutang(vPiutang);
      setHutang(vHutang);
      setPersediaan(vPersediaan);

      const daysBack = 14;
      const rangeStart = new Date();
      rangeStart.setDate(rangeStart.getDate() - daysBack);
      rangeStart.setHours(0, 0, 0, 0);
      const { data: ordersRange } = await supabase
        .from("orders")
        .select("total, created_at")
        .eq("organization_id", orgId)
        .eq("outlet_id", currentOutletId)
        .eq("status", "paid")
        .gte("created_at", rangeStart.toISOString());

      let penjualanPeriode = 0;
      const dayMap: Record<string, number> = {};
      for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayMap[d.toISOString().slice(0, 10)] = 0;
      }
      (ordersRange ?? []).forEach((o: { total: number; created_at: string }) => {
        const key = o.created_at.slice(0, 10);
        const amt = Number(o.total);
        penjualanPeriode += amt;
        if (key in dayMap) dayMap[key] += amt;
      });

      // Laba sederhana outlet: penjualan periode - kas keluar periode
      let cashOutPeriode = 0;
      (cashRes.data ?? []).forEach((c: { type: string; amount: number }) => {
        if (c.type === "out") cashOutPeriode += Number(c.amount) || 0;
      });
      const labaRugi = penjualanPeriode - cashOutPeriode;
      setLabaPeriode(labaRugi);

      setChartPenjualanHarian(
        Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, total]) => ({
            date,
            total,
            label: new Date(date + "T12:00:00").toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            }),
          }))
      );

      setChartPosisi(
        [
          { name: "Kas", value: Math.max(vKas, 0), color: CHART_COLORS.kas },
          { name: "Piutang", value: vPiutang, color: CHART_COLORS.piutang },
          { name: "Hutang", value: Math.abs(vHutang), color: CHART_COLORS.hutang },
          { name: "Persediaan", value: vPersediaan, color: CHART_COLORS.persediaan },
          {
            name: labaRugi >= 0 ? "Laba" : "Rugi",
            value: Math.abs(labaRugi),
            color: CHART_COLORS.laba,
          },
        ].filter((i) => i.value > 0)
      );

      setLoading(false);
    })();
  }, [orgId, currentOutletId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Dashboard Keuangan</h2>
        <p className="text-[var(--muted-foreground)]">Ringkasan posisi keuangan berdasarkan jurnal (per hari ini).</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Saldo Kas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[var(--foreground)]">{formatIdr(kas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Piutang (belum diterima)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[var(--foreground)]">{formatIdr(piutang)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Hutang (belum dibayar)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[var(--foreground)]">{formatIdr(hutang)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Nilai Persediaan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[var(--foreground)]">{formatIdr(persediaan)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Laba (rugi) periode berjalan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${labaPeriode >= 0 ? "text-[var(--foreground)]" : "text-red-600"}`}>
              {formatIdr(labaPeriode)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Penjualan hari ini</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-[var(--foreground)]">{formatIdr(penjualanHariIni)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grafik Posisi Keuangan</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">Komposisi Kas, Piutang, Hutang, Persediaan, Laba/Rugi</p>
          </CardHeader>
          <CardContent>
            {chartPosisi.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartPosisi}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${formatIdr(value)}`}
                    labelLine={false}
                  >
                    {chartPosisi.map((_, i) => (
                      <Cell key={i} fill={chartPosisi[i].color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => formatIdr(v ?? 0)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Belum ada data untuk grafik.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grafik Penjualan 14 Hari Terakhir</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">Total penjualan per hari (order lunas)</p>
          </CardHeader>
          <CardContent>
            {chartPenjualanHarian.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartPenjualanHarian} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${v / 1e6}Jt` : `${v / 1e3}rb`)} />
                  <Tooltip formatter={(v: number | undefined) => formatIdr(v ?? 0)} />
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Penjualan" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Belum ada data penjualan.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

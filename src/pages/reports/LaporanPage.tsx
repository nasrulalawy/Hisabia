import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function LaporanPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");
  const [cashSummary, setCashSummary] = useState<{ in: number; out: number; net: number }>({ in: 0, out: 0, net: 0 });
  const [receivableSummary, setReceivableSummary] = useState<{ total: number; paid: number; unpaid: number }>({
    total: 0,
    paid: 0,
    unpaid: 0,
  });
  const [payableSummary, setPayableSummary] = useState<{ total: number; paid: number; unpaid: number }>({
    total: 0,
    paid: 0,
    unpaid: 0,
  });
  const [orderSummary, setOrderSummary] = useState<{ count: number; total: number }>({ count: 0, total: 0 });

  function getDateRange() {
    const now = new Date();
    let start: Date;
    if (period === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start: start.toISOString(), end: now.toISOString() };
  }

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const { start, end } = getDateRange();

    Promise.all([
      supabase
        .from("cash_flows")
        .select("type, amount")
        .eq("organization_id", orgId)
        .gte("created_at", start)
        .lte("created_at", end),
      supabase.from("receivables").select("amount, paid").eq("organization_id", orgId),
      supabase.from("payables").select("amount, paid").eq("organization_id", orgId),
      supabase
        .from("orders")
        .select("total")
        .eq("organization_id", orgId)
        .eq("status", "paid")
        .gte("created_at", start)
        .lte("created_at", end),
    ]).then(([cashRes, recRes, payRes, orderRes]) => {
      let cashIn = 0,
        cashOut = 0;
      (cashRes.data ?? []).forEach((r) => {
        const amt = Number(r.amount);
        if (r.type === "in") cashIn += amt;
        else cashOut += amt;
      });

      let recTotal = 0,
        recPaid = 0;
      (recRes.data ?? []).forEach((r) => {
        recTotal += Number(r.amount);
        recPaid += Number(r.paid ?? 0);
      });

      let payTotal = 0,
        payPaid = 0;
      (payRes.data ?? []).forEach((r) => {
        payTotal += Number(r.amount);
        payPaid += Number(r.paid ?? 0);
      });

      const orders = orderRes.data ?? [];
      const orderTotal = orders.reduce((s, o) => s + Number(o.total), 0);

      setCashSummary({ in: cashIn, out: cashOut, net: cashIn - cashOut });
      setReceivableSummary({ total: recTotal, paid: recPaid, unpaid: recTotal - recPaid });
      setPayableSummary({ total: payTotal, paid: payPaid, unpaid: payTotal - payPaid });
      setOrderSummary({ count: orders.length, total: orderTotal });
      setLoading(false);
    });
  }, [orgId, period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Laporan</h2>
          <p className="text-[var(--muted-foreground)]">Ringkasan keuangan dan penjualan.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as "today" | "week" | "month")}
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          <option value="today">Hari ini</option>
          <option value="week">Minggu ini</option>
          <option value="month">Bulan ini</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Kas Masuk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{formatIdr(cashSummary.in)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Kas Keluar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatIdr(cashSummary.out)}</p>
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
                className={`text-2xl font-bold ${cashSummary.net >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {formatIdr(cashSummary.net)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                Penjualan ({period === "today" ? "Hari ini" : period === "week" ? "Minggu ini" : "Bulan ini"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--primary)]">{formatIdr(orderSummary.total)}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{orderSummary.count} transaksi</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Piutang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Total</span>
              <span>{formatIdr(receivableSummary.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Sudah Dibayar</span>
              <span className="text-emerald-600">{formatIdr(receivableSummary.paid)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-[var(--muted-foreground)]">Belum Dibayar</span>
              <span className="text-amber-600">{formatIdr(receivableSummary.unpaid)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hutang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Total</span>
              <span>{formatIdr(payableSummary.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Sudah Dibayar</span>
              <span className="text-emerald-600">{formatIdr(payableSummary.paid)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-[var(--muted-foreground)]">Belum Dibayar</span>
              <span className="text-amber-600">{formatIdr(payableSummary.unpaid)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

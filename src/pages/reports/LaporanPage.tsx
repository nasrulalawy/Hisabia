import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type PeriodType = "day" | "week" | "month" | "year";

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  hpp: number;
  laba: number;
  item_count: number;
  customer_name?: string | null;
}

function getDefaultDateValue(period: PeriodType): string {
  const now = new Date();
  if (period === "day") return now.toISOString().slice(0, 10);
  if (period === "week") return now.toISOString().slice(0, 10);
  if (period === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return String(now.getFullYear());
}

export function LaporanPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("month");
  const [dateValue, setDateValue] = useState(getDefaultDateValue("month"));
  const [dateLabel, setDateLabel] = useState("");

  const [penjualan, setPenjualan] = useState(0);
  const [hpp, setHpp] = useState(0);
  const [labaKotor, setLabaKotor] = useState(0);
  const [biaya, setBiaya] = useState(0);
  const [labaBersih, setLabaBersih] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);

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
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function getDateRange(): { start: string; end: string; label: string } {
    let start: Date;
    let end: Date;
    let label: string;
    if (period === "day") {
      const d = new Date(dateValue + "T00:00:00");
      start = new Date(d);
      end = new Date(d);
      end.setHours(23, 59, 59, 999);
      label = formatDate(d);
    } else if (period === "week") {
      const d = new Date(dateValue + "T12:00:00");
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(d.getFullYear(), d.getMonth(), diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      label = `${formatDate(start)} – ${formatDate(end)}`;
    } else if (period === "year") {
      const y = parseInt(dateValue, 10);
      start = new Date(y, 0, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(y, 11, 31);
      end.setHours(23, 59, 59, 999);
      label = `Tahun ${y}`;
    } else {
      const [y, m] = dateValue.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(y, m, 0);
      end.setHours(23, 59, 59, 999);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      label = `${monthNames[m - 1]} ${y}`;
    }
    return { start: start.toISOString(), end: end.toISOString(), label };
  }

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const { start, end, label } = getDateRange();
    setDateLabel(label);

    const ordersQuery = supabase
      .from("orders")
      .select("id, created_at, status, subtotal, discount, total, customer_id")
      .eq("organization_id", orgId)
      .in("status", ["paid", "pending"])
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });

    const cashQuery = supabase
      .from("cash_flows")
      .select("type, amount")
      .eq("organization_id", orgId)
      .gte("created_at", start)
      .lte("created_at", end);

    Promise.all([
      ordersQuery,
      supabase.from("receivables").select("amount, paid").eq("organization_id", orgId),
      supabase.from("payables").select("amount, paid").eq("organization_id", orgId),
      cashQuery,
    ]).then(async ([ordersRes, recRes, payRes, cashRes]) => {
      const orders = (ordersRes.data ?? []) as Array<{
        id: string;
        created_at: string;
        status: string;
        subtotal: number;
        discount: number;
        total: number;
        customer_id: string | null;
      }>;

      let totalPenjualan = 0;
      let totalHpp = 0;
      const rows: OrderRow[] = [];

      if (orders.length > 0) {
        const orderIds = orders.map((o) => o.id);
        const itemsRes = await supabase
          .from("order_items")
          .select("order_id, product_id, unit_id, price, quantity")
          .in("order_id", orderIds);
        const items = (itemsRes.data ?? []) as Array<{ order_id: string; product_id: string | null; unit_id: string | null; price: number; quantity: number }>;
        const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];

        const [productsRes, unitsRes, customersRes] = await Promise.all([
          productIds.length > 0
            ? supabase.from("products").select("id, cost_price").eq("organization_id", orgId).in("id", productIds)
            : Promise.resolve({ data: [] }),
          productIds.length > 0
            ? supabase.from("product_units").select("product_id, unit_id, conversion_to_base").in("product_id", productIds)
            : Promise.resolve({ data: [] }),
          supabase.from("customers").select("id, name").eq("organization_id", orgId),
        ]);

        const productMap = Object.fromEntries(((productsRes.data ?? []) as Array<{ id: string; cost_price: number }>).map((p) => [p.id, p]));
        const unitMap: Record<string, number> = {};
        ((unitsRes.data ?? []) as Array<{ product_id: string; unit_id: string; conversion_to_base: number }>).forEach((u) => {
          unitMap[`${u.product_id}_${u.unit_id}`] = Number(u.conversion_to_base) || 1;
        });
        const customerMap = Object.fromEntries(((customersRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));

        for (const order of orders) {
          const orderItems = items.filter((i) => i.order_id === order.id);
          let orderHpp = 0;
          for (const it of orderItems) {
            if (it.product_id && productMap[it.product_id]) {
              const costPrice = Number(productMap[it.product_id].cost_price ?? 0);
              const conv = it.unit_id ? (unitMap[`${it.product_id}_${it.unit_id}`] ?? 1) : 1;
              const qtyBase = Number(it.quantity) * conv;
              orderHpp += qtyBase * costPrice;
            }
          }
          const orderTotal = Number(order.total);
          totalPenjualan += orderTotal;
          totalHpp += orderHpp;
          rows.push({
            id: order.id,
            created_at: order.created_at,
            status: order.status,
            subtotal: Number(order.subtotal),
            discount: Number(order.discount ?? 0),
            total: orderTotal,
            hpp: orderHpp,
            laba: orderTotal - orderHpp,
            item_count: orderItems.length,
            customer_name: order.customer_id ? customerMap[order.customer_id] ?? null : null,
          });
        }
      }

      let cashIn = 0,
        cashOut = 0;
      (cashRes.data ?? []).forEach((r: { type: string; amount: number }) => {
        const amt = Number(r.amount);
        if (r.type === "in") cashIn += amt;
        else cashOut += amt;
      });

      setPenjualan(totalPenjualan);
      setHpp(totalHpp);
      setLabaKotor(totalPenjualan - totalHpp);
      setBiaya(cashOut);
      setLabaBersih(totalPenjualan - totalHpp - cashOut);
      setOrderCount(orders.length);
      setOrderRows(rows);
      setCashSummary({ in: cashIn, out: cashOut, net: cashIn - cashOut });

      let recTotal = 0,
        recPaid = 0;
      (recRes.data ?? []).forEach((r: { amount: number; paid?: number }) => {
        recTotal += Number(r.amount);
        recPaid += Number(r.paid ?? 0);
      });
      setReceivableSummary({ total: recTotal, paid: recPaid, unpaid: recTotal - recPaid });

      let payTotal = 0,
        payPaid = 0;
      (payRes.data ?? []).forEach((r: { amount: number; paid?: number }) => {
        payTotal += Number(r.amount);
        payPaid += Number(r.paid ?? 0);
      });
      setPayableSummary({ total: payTotal, paid: payPaid, unpaid: payTotal - payPaid });

      setLoading(false);
    });
  }, [orgId, period, dateValue, refreshKey]);

  async function handleDeleteOrder() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { data, error } = await supabase.rpc("delete_order", { p_order_id: deleteTarget.id });
    setDeleteLoading(false);
    if (error) {
      alert(error.message || "Gagal menghapus transaksi");
      return;
    }
    const res = data as { error?: string };
    if (res?.error) {
      alert(res.error);
      return;
    }
    setDeleteTarget(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Laporan</h2>
          <p className="text-[var(--muted-foreground)]">Ringkasan keuangan, penjualan, dan laba rugi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={period}
            onChange={(e) => {
              const p = e.target.value as PeriodType;
              setPeriod(p);
              setDateValue(getDefaultDateValue(p));
            }}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="day">Harian</option>
            <option value="week">Mingguan</option>
            <option value="month">Bulanan</option>
            <option value="year">Tahunan</option>
          </select>
          {period === "day" && (
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-10 w-auto"
            />
          )}
          {period === "week" && (
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-10 w-auto"
            />
          )}
          {period === "month" && (
            <Input
              type="month"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-10 w-auto"
            />
          )}
          {period === "year" && (
            <Input
              type="number"
              min={2020}
              max={2030}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value || String(new Date().getFullYear()))}
              placeholder="Tahun"
              className="h-10 w-24"
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Laba Rugi — {dateLabel}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Penjualan (net)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-[var(--foreground)]">{formatIdr(penjualan)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Setelah diskon · {orderCount} transaksi</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">HPP</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-red-600">{formatIdr(hpp)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Harga pokok penjualan</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Laba kotor</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xl font-bold ${labaKotor >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatIdr(labaKotor)}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">Penjualan − HPP</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Laba bersih</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xl font-bold ${labaBersih >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatIdr(labaBersih)}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">Laba kotor − biaya (kas keluar)</p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-3 flex flex-wrap gap-6 border-t border-[var(--border)] pt-3 text-sm">
              <span className="text-[var(--muted-foreground)]">Biaya (arus kas keluar): {formatIdr(biaya)}</span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold text-[var(--foreground)]">Detail transaksi ({dateLabel})</h3>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                    <th className="px-3 py-2 text-left font-medium">Pelanggan</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    <th className="px-3 py-2 text-right font-medium">Diskon</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">HPP</th>
                    <th className="px-3 py-2 text-right font-medium">Laba</th>
                    <th className="w-20 px-3 py-2 text-center font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-[var(--muted-foreground)]">
                        Tidak ada transaksi pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    orderRows.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/30">
                        <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                        <td className="px-3 py-2">{row.customer_name ?? "—"}</td>
                        <td className="px-3 py-2 text-right">{formatIdr(row.subtotal)}</td>
                        <td className="px-3 py-2 text-right">{formatIdr(row.discount)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatIdr(row.total)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{formatIdr(row.hpp)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${row.laba >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatIdr(row.laba)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title="Hapus transaksi"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Kas Masuk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-emerald-600">{formatIdr(cashSummary.in)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Kas Keluar</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-red-600">{formatIdr(cashSummary.out)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Net Arus Kas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${cashSummary.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatIdr(cashSummary.net)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">Jumlah Transaksi</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-[var(--foreground)]">{orderCount}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Order paid/pending</p>
              </CardContent>
            </Card>
          </div>

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
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteOrder}
        title="Hapus Transaksi"
        message={
          deleteTarget
            ? `Yakin ingin menghapus transaksi ${formatDate(deleteTarget.created_at)} (${formatIdr(deleteTarget.total)})? Stok akan dikembalikan.`
            : ""
        }
        confirmLabel="Hapus"
        loading={deleteLoading}
      />
    </div>
  );
}

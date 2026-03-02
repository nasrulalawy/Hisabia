import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export function DashboardKeuanganPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [kas, setKas] = useState(0);
  const [piutang, setPiutang] = useState(0);
  const [hutang, setHutang] = useState(0);
  const [persediaan, setPersediaan] = useState(0);
  const [labaPeriode, setLabaPeriode] = useState(0);
  const [penjualanHariIni, setPenjualanHariIni] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    (async () => {
      const { data: coa } = await supabase
        .from("chart_of_accounts")
        .select("id, code, account_type")
        .eq("organization_id", orgId);
      if (!coa?.length) {
        setLoading(false);
        return;
      }
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("organization_id", orgId)
        .lte("entry_date", today);
      const entryIds = (entries ?? []).map((e) => e.id);
      let byAccount: Record<string, { debit: number; credit: number }> = {};
      if (entryIds.length > 0) {
        const { data: lines } = await supabase
          .from("journal_entry_lines")
          .select("account_id, debit, credit")
          .in("journal_entry_id", entryIds);
        (lines ?? []).forEach((l: { account_id: string; debit: number; credit: number }) => {
          if (!byAccount[l.account_id]) byAccount[l.account_id] = { debit: 0, credit: 0 };
          byAccount[l.account_id].debit += Number(l.debit) || 0;
          byAccount[l.account_id].credit += Number(l.credit) || 0;
        });
      }
      const codeById: Record<string, string> = {};
      const typeById: Record<string, AccountType> = {};
      coa.forEach((a: { id: string; code: string; account_type: string }) => {
        codeById[a.id] = a.code;
        typeById[a.id] = a.account_type as AccountType;
      });
      const normalDebit: Record<AccountType, boolean> = {
        asset: true,
        expense: true,
        liability: false,
        equity: false,
        revenue: false,
      };
      let vKas = 0,
        vPiutang = 0,
        vHutang = 0,
        vPersediaan = 0,
        totalRevenue = 0,
        totalExpense = 0;
      coa.forEach((a: { id: string; code: string; account_type: string }) => {
        const t = byAccount[a.id] ?? { debit: 0, credit: 0 };
        const balance = normalDebit[a.account_type as AccountType]
          ? t.debit - t.credit
          : t.credit - t.debit;
        if (a.code === "1-1") vKas = balance;
        if (a.code === "1-2") vPiutang = balance;
        if (a.code === "2-1") vHutang = balance;
        if (a.code === "1-3") vPersediaan = balance;
        if (a.account_type === "revenue") totalRevenue += balance;
        if (a.account_type === "expense") totalExpense += balance;
      });
      setKas(vKas);
      setPiutang(vPiutang);
      setHutang(vHutang);
      setPersediaan(vPersediaan);
      setLabaPeriode(totalRevenue - totalExpense);

      const { data: ordersToday } = await supabase
        .from("orders")
        .select("total")
        .eq("organization_id", orgId)
        .eq("status", "paid")
        .gte("created_at", todayStart.toISOString());
      const penjualan = (ordersToday ?? []).reduce((s, o) => s + Number(o.total), 0);
      setPenjualanHariIni(penjualan);
      setLoading(false);
    })();
  }, [orgId]);

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
    </div>
  );
}

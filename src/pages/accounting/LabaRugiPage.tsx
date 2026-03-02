import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/Input";

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  account_type: string;
  balance: number;
}

export function LabaRugiPage() {
  const { orgId } = useOrg();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (async () => {
      const { data: coa } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type")
        .eq("organization_id", orgId)
        .in("account_type", ["revenue", "expense"])
        .order("sort_order")
        .order("code");
      if (!coa?.length) {
        setAccounts([]);
        setLoading(false);
        return;
      }
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("organization_id", orgId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
      const entryIds = (entries ?? []).map((e) => e.id);
      if (entryIds.length === 0) {
        setAccounts(coa.map((a) => ({ ...a, balance: 0 })));
        setLoading(false);
        return;
      }
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("account_id, debit, credit")
        .in("journal_entry_id", entryIds);
      const byAccount: Record<string, { debit: number; credit: number }> = {};
      (lines ?? []).forEach((l: { account_id: string; debit: number; credit: number }) => {
        if (!byAccount[l.account_id]) byAccount[l.account_id] = { debit: 0, credit: 0 };
        byAccount[l.account_id].debit += Number(l.debit) || 0;
        byAccount[l.account_id].credit += Number(l.credit) || 0;
      });
      const result: AccountBalance[] = coa.map((a) => {
        const t = byAccount[a.id] ?? { debit: 0, credit: 0 };
        const balance = a.account_type === "revenue" ? t.credit - t.debit : t.debit - t.credit;
        return { ...a, balance };
      });
      setAccounts(result);
      setLoading(false);
    })();
  }, [orgId, startDate, endDate]);

  const revenue = accounts.filter((a) => a.account_type === "revenue");
  const expense = accounts.filter((a) => a.account_type === "expense");
  const totalRevenue = revenue.reduce((s, a) => s + a.balance, 0);
  const totalExpense = expense.reduce((s, a) => s + a.balance, 0);
  const netIncome = totalRevenue - totalExpense;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Laporan Laba Rugi</h2>
          <p className="text-[var(--muted-foreground)]">Pendapatan dikurangi beban untuk suatu periode.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Dari</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Sampai</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6">
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            Periode: {formatDate(startDate)} s.d. {formatDate(endDate)}
          </p>
          <table className="w-full max-w-lg text-sm">
            <tbody>
              {revenue.length > 0 && (
                <>
                  <tr>
                    <td colSpan={2} className="pb-2 font-semibold text-[var(--foreground)]">Pendapatan</td>
                  </tr>
                  {revenue.map((a) => (
                    <tr key={a.id}>
                      <td className="py-1 pl-4">{a.code} — {a.name}</td>
                      <td className="py-1 text-right font-medium">{formatIdr(a.balance)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-medium">Total Pendapatan</td>
                    <td className="py-2 text-right font-semibold">{formatIdr(totalRevenue)}</td>
                  </tr>
                  <tr><td colSpan={2} className="h-2" /></tr>
                </>
              )}
              {expense.length > 0 && (
                <>
                  <tr>
                    <td colSpan={2} className="pb-2 font-semibold text-[var(--foreground)]">Beban</td>
                  </tr>
                  {expense.map((a) => (
                    <tr key={a.id}>
                      <td className="py-1 pl-4">{a.code} — {a.name}</td>
                      <td className="py-1 text-right font-medium">{formatIdr(a.balance)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-medium">Total Beban</td>
                    <td className="py-2 text-right font-semibold">{formatIdr(totalExpense)}</td>
                  </tr>
                </>
              )}
              {revenue.length === 0 && expense.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-[var(--muted-foreground)]">
                    Tidak ada akun pendapatan/beban atau tidak ada transaksi pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
            {(revenue.length > 0 || expense.length > 0) && (
              <tfoot>
                <tr className="border-t-2 border-[var(--border)]">
                  <td className="py-3 font-semibold">Laba (Rugi) Bersih</td>
                  <td className={`py-3 text-right font-semibold ${netIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatIdr(netIncome)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

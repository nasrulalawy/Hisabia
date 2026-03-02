import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/Input";

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  balance: number;
}

export function NeracaPage() {
  const { orgId } = useOrg();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
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
        .lte("entry_date", asOfDate);
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
      const normalDebit: Record<AccountType, boolean> = {
        asset: true,
        expense: true,
        liability: false,
        equity: false,
        revenue: false,
      };
      const result: AccountBalance[] = coa.map((a) => {
        const t = byAccount[a.id] ?? { debit: 0, credit: 0 };
        const balance = normalDebit[a.account_type as AccountType]
          ? t.debit - t.credit
          : t.credit - t.debit;
        return { ...a, balance };
      });
      setAccounts(result);
      setLoading(false);
    })();
  }, [orgId, asOfDate]);

  const assets = accounts.filter((a) => a.account_type === "asset");
  const liabilities = accounts.filter((a) => a.account_type === "liability");
  const equity = accounts.filter((a) => a.account_type === "equity");
  const revenue = accounts.filter((a) => a.account_type === "revenue");
  const expense = accounts.filter((a) => a.account_type === "expense");
  const totalAsset = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiability = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0);
  const totalRevenue = revenue.reduce((s, a) => s + a.balance, 0);
  const totalExpense = expense.reduce((s, a) => s + a.balance, 0);
  const labaPeriodeBerjalan = totalRevenue - totalExpense;
  const totalLiabEquity = totalLiability + totalEquity + labaPeriodeBerjalan;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Neraca</h2>
          <p className="text-[var(--muted-foreground)]">Posisi keuangan (Aset = Kewajiban + Ekuitas) per tanggal.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Per tanggal</label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Aset</h3>
            <table className="w-full text-sm">
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)]">
                    <td className="py-2">{a.code} — {a.name}</td>
                    <td className="py-2 text-right font-medium">{formatIdr(a.balance)}</td>
                  </tr>
                ))}
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-[var(--muted-foreground)]">Tidak ada akun aset</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] font-semibold">
                  <td className="py-2">Total Aset</td>
                  <td className="py-2 text-right">{formatIdr(totalAsset)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Kewajiban & Ekuitas</h3>
            <table className="w-full text-sm">
              <tbody>
                {liabilities.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={2} className="pb-1 pt-2 text-xs font-medium uppercase text-[var(--muted-foreground)]">Kewajiban</td>
                    </tr>
                    {liabilities.map((a) => (
                      <tr key={a.id} className="border-b border-[var(--border)]">
                        <td className="py-2">{a.code} — {a.name}</td>
                        <td className="py-2 text-right font-medium">{formatIdr(a.balance)}</td>
                      </tr>
                    ))}
                  </>
                )}
                {equity.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={2} className="pb-1 pt-2 text-xs font-medium uppercase text-[var(--muted-foreground)]">Ekuitas</td>
                    </tr>
                    {equity.map((a) => (
                      <tr key={a.id} className="border-b border-[var(--border)]">
                        <td className="py-2">{a.code} — {a.name}</td>
                        <td className="py-2 text-right font-medium">{formatIdr(a.balance)}</td>
                      </tr>
                    ))}
                  </>
                )}
                {(equity.length > 0 || Math.abs(labaPeriodeBerjalan) >= 0.01) && (
                  <>
                    <tr>
                      <td colSpan={2} className="pb-1 pt-2 text-xs font-medium uppercase text-[var(--muted-foreground)]">Laba (rugi) periode berjalan</td>
                    </tr>
                    <tr className="border-b border-[var(--border)]">
                      <td className="py-2">Pendapatan − Beban (s.d. tanggal)</td>
                      <td className="py-2 text-right font-medium">{formatIdr(labaPeriodeBerjalan)}</td>
                    </tr>
                  </>
                )}
                {liabilities.length === 0 && equity.length === 0 && Math.abs(labaPeriodeBerjalan) < 0.01 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-[var(--muted-foreground)]">Tidak ada akun</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] font-semibold">
                  <td className="py-2">Total Kewajiban + Ekuitas</td>
                  <td className="py-2 text-right">{formatIdr(totalLiabEquity)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {!loading && accounts.length > 0 && (
        <div className={`rounded-lg border p-4 ${Math.abs(totalAsset - totalLiabEquity) < 0.01 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          <p className="font-medium">
            {Math.abs(totalAsset - totalLiabEquity) < 0.01
              ? "Neraca seimbang (Total Aset = Total Kewajiban + Ekuitas)."
              : `Tidak seimbang: selisih ${formatIdr(totalAsset - totalLiabEquity)}. Pastikan semua transaksi tercatat di Jurnal Umum.`}
          </p>
          <p className="mt-1 text-sm opacity-90">Per tanggal: {formatDate(asOfDate)}</p>
          {totalLiability === 0 && totalEquity === 0 && Math.abs(labaPeriodeBerjalan) < 0.01 && totalAsset > 0 && (
            <p className="mt-2 text-sm opacity-90">
              Kewajiban (2-1) terisi dari data <strong>Hutang</strong> dan <strong>Pembelian kredit</strong>. Ekuitas termasuk laba periode berjalan (Pendapatan − Beban). Jika ada transaksi lama yang belum masuk jurnal, jalankan <strong>Sinkronkan ke Jurnal</strong> di halaman Jurnal Umum.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

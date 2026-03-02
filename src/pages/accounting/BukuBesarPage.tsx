import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import type { ChartOfAccount } from "@/lib/database.types";

interface LedgerRow {
  entry_date: string;
  number: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export function BukuBesarPage() {
  const { orgId } = useOrg();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [endingBalance, setEndingBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  async function fetchAccounts() {
    if (!orgId) return;
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .order("sort_order")
      .order("code");
    setAccounts(data ?? []);
  }

  useEffect(() => {
    if (!orgId) return;
    fetchAccounts();
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !selectedAccountId) return;
    setLoading(true);
    (async () => {
      const { data: entryIds } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("organization_id", orgId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
      const ids = (entryIds ?? []).map((e) => e.id);
      if (ids.length === 0) {
        setRows([]);
        setTotalDebit(0);
        setTotalCredit(0);
        setEndingBalance(0);
        setLoading(false);
        return;
      }
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select(
          `
          debit,
          credit,
          journal_entries(entry_date, number, description)
        `
        )
        .eq("account_id", selectedAccountId)
        .in("journal_entry_id", ids);
      const account = accounts.find((a) => a.id === selectedAccountId);
      const normalDebit = account ? ["asset", "expense"].includes(account.account_type) : true;
      const list = (lines ?? []) as { debit: number; credit: number; journal_entries: { entry_date: string; number: string | null; description: string | null } | null }[];
      list.sort((a, b) => (a.journal_entries?.entry_date ?? "").localeCompare(b.journal_entries?.entry_date ?? ""));
      let running = 0;
      const result: LedgerRow[] = list.map((l) => {
        const d = Number(l.debit) || 0;
        const c = Number(l.credit) || 0;
        running += normalDebit ? d - c : c - d;
        return {
          entry_date: l.journal_entries?.entry_date ?? "",
          number: l.journal_entries?.number ?? null,
          description: l.journal_entries?.description ?? null,
          debit: d,
          credit: c,
          balance: running,
        };
      });
      const sumD = result.reduce((a, r) => a + r.debit, 0);
      const sumC = result.reduce((a, r) => a + r.credit, 0);
      setRows(result);
      setTotalDebit(sumD);
      setTotalCredit(sumC);
      setEndingBalance(running);
      setLoading(false);
    })();
  }, [orgId, selectedAccountId, startDate, endDate, accounts]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Buku Besar</h2>
        <p className="text-[var(--muted-foreground)]">Daftar mutasi per akun dalam periode tertentu.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="min-w-[200px]">
          <label className="mb-1 block text-sm font-medium">Akun</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="">Pilih akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
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
      {selectedAccount && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <h3 className="text-lg font-semibold">
            {selectedAccount.code} — {selectedAccount.name}
          </h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            Periode: {formatDate(startDate)} s.d. {formatDate(endDate)}
          </p>
        </div>
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
                <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                <th className="px-3 py-2 text-left font-medium">No. Jurnal</th>
                <th className="px-3 py-2 text-left font-medium">Keterangan</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-3 py-2 text-right font-medium">Kredit</th>
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                    Tidak ada mutasi pada periode ini.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{formatDate(row.entry_date)}</td>
                    <td className="px-3 py-2">{row.number || "—"}</td>
                    <td className="px-3 py-2">{row.description || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.debit > 0 ? formatIdr(row.debit) : ""}</td>
                    <td className="px-3 py-2 text-right">{row.credit > 0 ? formatIdr(row.credit) : ""}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatIdr(row.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]/30 font-medium">
                  <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right">{formatIdr(totalDebit)}</td>
                  <td className="px-3 py-2 text-right">{formatIdr(totalCredit)}</td>
                  <td className="px-3 py-2 text-right">{formatIdr(endingBalance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

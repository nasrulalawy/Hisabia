import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { downloadCsv, printForPdf } from "@/lib/export";
import type { AccountType } from "@/lib/database.types";

interface Row {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  debit: number;
  credit: number;
}

export function NeracaSaldoPage() {
  const { orgId } = useOrg();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
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
        setRows([]);
        setTotalDebit(0);
        setTotalCredit(0);
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
        setRows(coa.map((a) => ({ ...a, debit: 0, credit: 0 })));
        setTotalDebit(0);
        setTotalCredit(0);
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
      const result: Row[] = coa.map((a) => {
        const t = byAccount[a.id] ?? { debit: 0, credit: 0 };
        let debit = 0,
          credit = 0;
        if (normalDebit[a.account_type as AccountType]) {
          const bal = t.debit - t.credit;
          if (bal >= 0) debit = bal;
          else credit = -bal;
        } else {
          const bal = t.credit - t.debit;
          if (bal >= 0) credit = bal;
          else debit = -bal;
        }
        return { ...a, debit, credit };
      });
      setRows(result);
      setTotalDebit(result.reduce((s, r) => s + r.debit, 0));
      setTotalCredit(result.reduce((s, r) => s + r.credit, 0));
      setLoading(false);
    })();
  }, [orgId, asOfDate]);

  function exportCsv() {
    const out: string[][] = [["Kode", "Nama Akun", "Tipe", "Debit", "Kredit"]];
    rows.forEach((r) => out.push([r.code, r.name, r.account_type, String(r.debit), String(r.credit)]));
    downloadCsv(out, `neraca-saldo-${asOfDate}.csv`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Neraca Saldo</h2>
          <p className="text-[var(--muted-foreground)]">Daftar saldo semua akun (total debit = total kredit) per tanggal.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Per tanggal</label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</Button>
          <Button variant="outline" size="sm" onClick={printForPdf}>Cetak</Button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50">
                <th className="px-3 py-2 text-left font-medium">Kode</th>
                <th className="px-3 py-2 text-left font-medium">Nama Akun</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-3 py-2 text-right font-medium">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                    Tidak ada akun. Buat Chart of Accounts atau jalankan Jurnal Umum dulu (COA akan di-seed otomatis).
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{r.code}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-right">{r.debit > 0 ? formatIdr(r.debit) : ""}</td>
                    <td className="px-3 py-2 text-right">{r.credit > 0 ? formatIdr(r.credit) : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] bg-[var(--muted)]/30 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right">{formatIdr(totalDebit)}</td>
                  <td className="px-3 py-2 text-right">{formatIdr(totalCredit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <p className={`text-sm ${Math.abs(totalDebit - totalCredit) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
          {Math.abs(totalDebit - totalCredit) < 0.01 ? "Neraca saldo seimbang." : `Selisih: ${formatIdr(totalDebit - totalCredit)}`}
        </p>
      )}
    </div>
  );
}

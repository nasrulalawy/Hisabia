import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { backfillAccounting, type BackfillResult } from "@/lib/accounting";
import { downloadCsv, printForPdf } from "@/lib/export";
import type { ChartOfAccount, JournalEntry, JournalEntryLine } from "@/lib/database.types";

interface EntryWithLines extends JournalEntry {
  journal_entry_lines: (JournalEntryLine & { chart_of_accounts: ChartOfAccount | null })[];
}

export function JurnalUmumPage() {
  const { orgId } = useOrg();
  const [entries, setEntries] = useState<EntryWithLines[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formNumber, setFormNumber] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLines, setFormLines] = useState<{ account_id: string; debit: number; credit: number; memo: string }[]>([
    { account_id: "", debit: 0, credit: 0, memo: "" },
    { account_id: "", debit: 0, credit: 0, memo: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<BackfillResult | null>(null);

  async function ensureCoa() {
    if (!orgId) return;
    const { data: existing } = await supabase.from("chart_of_accounts").select("id").eq("organization_id", orgId).limit(1);
    if (!existing?.length) {
      await supabase.rpc("seed_chart_of_accounts", { p_org_id: orgId });
    }
  }

  async function fetchAccounts() {
    if (!orgId) return;
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true });
    setAccounts(data ?? []);
  }

  async function fetchEntries() {
    if (!orgId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("journal_entries")
      .select(
        `
        *,
        journal_entry_lines(
          *,
          chart_of_accounts(*)
        )
      `
      )
      .eq("organization_id", orgId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (err) return;
    setEntries((data as EntryWithLines[]) ?? []);
  }

  useEffect(() => {
    if (!orgId) return;
    ensureCoa().then(() => {
      fetchAccounts();
      fetchEntries();
    });
  }, [orgId]);

  function openAdd() {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormNumber("");
    setFormDesc("");
    setFormLines([
      { account_id: "", debit: 0, credit: 0, memo: "" },
      { account_id: "", debit: 0, credit: 0, memo: "" },
    ]);
    setError(null);
    setModalOpen(true);
  }

  function addLine() {
    setFormLines((prev) => [...prev, { account_id: "", debit: 0, credit: 0, memo: "" }]);
  }

  function updateLine(i: number, field: string, value: string | number) {
    setFormLines((prev) => {
      const next = [...prev];
      (next[i] as Record<string, string | number>)[field] = value;
      return next;
    });
  }

  function removeLine(i: number) {
    if (formLines.length <= 2) return;
    setFormLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function getTotals() {
    let debit = 0,
      credit = 0;
    formLines.forEach((l) => {
      debit += Number(l.debit) || 0;
      credit += Number(l.credit) || 0;
    });
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const { balanced, debit } = getTotals();
    if (!balanced || debit <= 0) {
      setError("Total debit harus sama dengan total kredit dan lebih dari 0.");
      return;
    }
    const validLines = formLines.filter((l) => l.account_id && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0));
    if (validLines.length < 2) {
      setError("Minimal 2 akun dengan debit atau kredit.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    let journalNumber = formNumber.trim() || null;
    if (!journalNumber) {
      const { data: nextNum } = await supabase.rpc("get_next_journal_number", {
        p_org_id: orgId,
        p_entry_date: formDate,
      });
      journalNumber = (nextNum as string) || null;
    }
    const { data: entry, error: insertErr } = await supabase
      .from("journal_entries")
      .insert({
        organization_id: orgId,
        entry_date: formDate,
        number: journalNumber,
        description: formDesc.trim() || null,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (insertErr || !entry) {
      setSaving(false);
      setError(insertErr?.message ?? "Gagal simpan jurnal");
      return;
    }
    const lines = validLines.map((l) => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: Math.round((Number(l.debit) || 0) * 100) / 100,
      credit: Math.round((Number(l.credit) || 0) * 100) / 100,
      memo: l.memo.trim() || null,
    }));
    const { error: linesErr } = await supabase.from("journal_entry_lines").insert(lines);
    if (linesErr) {
      await supabase.from("journal_entries").delete().eq("id", entry.id);
      setSaving(false);
      setError(linesErr.message);
      return;
    }
    setSaving(false);
    setModalOpen(false);
    fetchEntries();
  }

  const { debit, credit, balanced } = getTotals();

  function exportCsv() {
    const rows: string[][] = [["Tanggal", "No", "Keterangan", "Akun", "Debit", "Kredit"]];
    entries.forEach((entry) => {
      const lines = entry.journal_entry_lines ?? [];
      lines.forEach((line, i) => {
        rows.push([
          i === 0 ? formatDate(entry.entry_date) : "",
          i === 0 ? (entry.number || "") : "",
          i === 0 ? (entry.description || "") : "",
          line.chart_of_accounts ? `${line.chart_of_accounts.code} — ${line.chart_of_accounts.name}` : "",
          String(Number(line.debit) || 0),
          String(Number(line.credit) || 0),
        ]);
      });
    });
    downloadCsv(rows, `jurnal-umum-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function handleSyncOldTransactions() {
    if (!orgId) return;
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await backfillAccounting(orgId);
      setSyncResult(res);
      await fetchEntries();
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Jurnal Umum</h2>
          <p className="text-[var(--muted-foreground)]">Catat transaksi akuntansi (debit = kredit).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={entries.length === 0}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={printForPdf}>
            Cetak
          </Button>
          <Button onClick={openAdd}>Tambah Jurnal</Button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-4">
        <h3 className="mb-2 font-medium text-[var(--foreground)]">Sinkronisasi transaksi lama</h3>
        <p className="mb-3 text-sm text-[var(--muted-foreground)]">
          Transaksi yang sudah ada (order, arus kas, piutang, hutang) tapi belum masuk ke jurnal akan diposting ke akuntansi. Aman dijalankan berkali kali—hanya yang belum punya jurnal yang akan ditambah.
        </p>
        <Button variant="outline" onClick={handleSyncOldTransactions} disabled={syncLoading || !orgId}>
          {syncLoading ? "Memproses..." : "Sinkronkan ke Jurnal"}
        </Button>
        {syncResult && (
          <div className="mt-3 text-sm">
            <p className="text-[var(--foreground)]">
              Ditambah: Order {syncResult.orders}, Arus kas {syncResult.cash_flows}, Piutang {syncResult.receivables}, Hutang {syncResult.payables}.
            </p>
            {syncResult.errors.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-amber-700">
                {syncResult.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {syncResult.errors.length > 5 && <li>… dan {syncResult.errors.length - 5} lainnya</li>}
              </ul>
            )}
          </div>
        )}
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
                <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                <th className="px-3 py-2 text-left font-medium">No / Keterangan</th>
                <th className="px-3 py-2 text-left font-medium">Akun</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-3 py-2 text-right font-medium">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted-foreground)]">
                    Belum ada jurnal. Klik Tambah Jurnal untuk mulai.
                  </td>
                </tr>
              ) : (
                entries.flatMap((entry) => {
                  const lines = entry.journal_entry_lines ?? [];
                  return lines.map((line, i) => (
                    <tr key={line.id} className="border-b border-[var(--border)]">
                      {i === 0 && (
                        <>
                          <td className="px-3 py-2 align-top" rowSpan={lines.length}>
                            {formatDate(entry.entry_date)}
                          </td>
                          <td className="px-3 py-2 align-top" rowSpan={lines.length}>
                            <div>{entry.number || "—"}</div>
                            <div className="text-xs text-[var(--muted-foreground)]">{entry.description || "—"}</div>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        {line.chart_of_accounts?.code} — {line.chart_of_accounts?.name}
                      </td>
                      <td className="w-28 px-3 py-2 text-right">{line.debit > 0 ? formatIdr(line.debit) : ""}</td>
                      <td className="w-28 px-3 py-2 text-right">{line.credit > 0 ? formatIdr(line.credit) : ""}</td>
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Jurnal Umum" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Tanggal</label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">No. Jurnal (opsional)</label>
              <Input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="JU-001" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Keterangan</label>
            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Deskripsi transaksi" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Detail (Debit = Kredit)</span>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                + Baris
              </Button>
            </div>
            <div className="space-y-2">
              {formLines.map((line, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] p-2">
                  <select
                    className="min-w-[180px] rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                    value={line.account_id}
                    onChange={(e) => updateLine(i, "account_id", e.target.value)}
                  >
                    <option value="">Pilih akun</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Debit"
                    className="w-28"
                    value={line.debit || ""}
                    onChange={(e) => {
                      updateLine(i, "debit", e.target.value ? parseFloat(e.target.value) : 0);
                      updateLine(i, "credit", 0);
                    }}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Kredit"
                    className="w-28"
                    value={line.credit || ""}
                    onChange={(e) => {
                      updateLine(i, "credit", e.target.value ? parseFloat(e.target.value) : 0);
                      updateLine(i, "debit", 0);
                    }}
                  />
                  <Input
                    placeholder="Memo"
                    className="flex-1 min-w-[100px]"
                    value={line.memo}
                    onChange={(e) => updateLine(i, "memo", e.target.value)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => removeLine(i)} disabled={formLines.length <= 2}>
                    Hapus
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Total Debit: {formatIdr(debit)} · Total Kredit: {formatIdr(credit)}
              {!balanced && <span className="text-red-600"> · Harus sama!</span>}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving || !balanced || debit <= 0}>
              {saving ? "Menyimpan..." : "Simpan Jurnal"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

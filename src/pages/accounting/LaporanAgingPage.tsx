import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";

type Tab = "piutang" | "hutang";

const BUCKETS = [
  { key: "belum", label: "Belum jatuh tempo", min: -99999, max: -1 },
  { key: "0-30", label: "1–30 hari terlambat", min: 0, max: 30 },
  { key: "31-60", label: "31–60 hari", min: 31, max: 60 },
  { key: "61-90", label: "61–90 hari", min: 61, max: 90 },
  { key: "90+", label: "> 90 hari", min: 91, max: 99999 },
  { key: "no_date", label: "Tanpa tanggal jatuh tempo", min: null, max: null },
];

function daysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

interface ReceivableRow {
  id: string;
  amount: number;
  paid: number;
  due_date: string | null;
  notes: string | null;
  customers: { name: string } | null;
}

interface PayableRow {
  id: string;
  amount: number;
  paid: number;
  due_date: string | null;
  notes: string | null;
  suppliers: { name: string } | null;
}

export function LaporanAgingPage() {
  const { orgId } = useOrg();
  const [tab, setTab] = useState<Tab>("piutang");
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (async () => {
      const [recRes, payRes] = await Promise.all([
        supabase.from("receivables").select("id, amount, paid, due_date, notes, customers(name)").eq("organization_id", orgId),
        supabase.from("payables").select("id, amount, paid, due_date, notes, suppliers(name)").eq("organization_id", orgId),
      ]);
      setReceivables((recRes.data as unknown as ReceivableRow[]) ?? []);
      setPayables((payRes.data as unknown as PayableRow[]) ?? []);
      setLoading(false);
    })();
  }, [orgId]);

  function buildAging<T extends { amount: number; paid: number; due_date: string | null }>(
    rows: T[],
    nameGetter: (r: T) => string
  ) {
    const byBucket: Record<string, { name: string; sisa: number }[]> = {};
    BUCKETS.forEach((b) => (byBucket[b.key] = []));
    let total = 0;
    for (const r of rows) {
      const sisa = Number(r.amount) - Number(r.paid ?? 0);
      if (sisa <= 0) continue;
      total += sisa;
      const overdue = daysOverdue(r.due_date);
      let bucketKey: string;
      if (r.due_date == null) bucketKey = "no_date";
      else if (overdue! < 0) bucketKey = "belum";
      else if (overdue! <= 30) bucketKey = "0-30";
      else if (overdue! <= 60) bucketKey = "31-60";
      else if (overdue! <= 90) bucketKey = "61-90";
      else bucketKey = "90+";
      byBucket[bucketKey].push({ name: nameGetter(r), sisa });
    }
    return { byBucket, total };
  }

  const recAging = buildAging(receivables, (r) => (r as ReceivableRow).customers?.name ?? "-");
  const payAging = buildAging(payables, (r) => (r as PayableRow).suppliers?.name ?? "-");

  const data = tab === "piutang" ? recAging : payAging;
  const title = tab === "piutang" ? "Umur Piutang" : "Umur Hutang";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Laporan Umur Piutang & Hutang</h2>
        <p className="text-[var(--muted-foreground)]">Pengelompokan sisa tagihan/utang menurut keterlambatan pembayaran.</p>
      </div>
      <div className="flex gap-2 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setTab("piutang")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "piutang" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted-foreground)]"}`}
        >
          Umur Piutang
        </button>
        <button
          type="button"
          onClick={() => setTab("hutang")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "hutang" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted-foreground)]"}`}
        >
          Umur Hutang
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--border)] p-4">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              Total {title}: {formatIdr(data.total)}
            </p>
          </div>
          <div className="space-y-6">
            {BUCKETS.map((b) => {
              const items = data.byBucket[b.key];
              const sum = items?.reduce((s, i) => s + i.sisa, 0) ?? 0;
              if (items?.length === 0) return null;
              return (
                <div key={b.key} className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <div className="bg-[var(--muted)]/50 px-4 py-2 flex justify-between items-center">
                    <span className="font-medium">{b.label}</span>
                    <span className="font-semibold">{formatIdr(sum)}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-4 py-2 text-left font-medium">{tab === "piutang" ? "Pelanggan" : "Supplier"}</th>
                        <th className="px-4 py-2 text-right font-medium">Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items?.map((i, idx) => (
                        <tr key={idx} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-4 py-2">{i.name}</td>
                          <td className="px-4 py-2 text-right">{formatIdr(i.sisa)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

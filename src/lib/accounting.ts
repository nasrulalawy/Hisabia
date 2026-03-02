/**
 * Posting transaksi ke Jurnal Umum (double-entry).
 * Dipanggil setelah: order paid, arus kas, piutang/hutang, pembelian.
 */

import { supabase } from "@/lib/supabase";

export interface JournalLine {
  code: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface PostJournalEntryParams {
  organization_id: string;
  entry_date: string; // YYYY-MM-DD
  description: string;
  number?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  lines: JournalLine[];
  created_by?: string | null;
}

/** Pastikan COA ada (seed jika kosong). */
export async function ensureCoa(orgId: string): Promise<void> {
  const { data } = await supabase.from("chart_of_accounts").select("id").eq("organization_id", orgId).limit(1);
  if (!data?.length) {
    await supabase.rpc("seed_chart_of_accounts", { p_org_id: orgId });
  }
}

/** Ambil map code -> account id untuk org. */
export async function getAccountIdsByCode(orgId: string): Promise<Record<string, string>> {
  await ensureCoa(orgId);
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("code, id")
    .eq("organization_id", orgId);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: { code: string; id: string }) => {
    map[r.code] = r.id;
  });
  return map;
}

/** Cek apakah sudah ada jurnal untuk reference ini (idempotent). */
async function hasJournalForReference(orgId: string, referenceType: string, referenceId: string): Promise<boolean> {
  const { data } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("organization_id", orgId)
    .eq("reference_type", referenceType)
    .eq("reference_id", referenceId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Post satu jurnal. Total debit harus sama dengan total kredit.
 * Jika reference_type + reference_id diberikan dan sudah ada jurnal, tidak insert lagi.
 */
export async function postJournalEntry(params: PostJournalEntryParams): Promise<string | null> {
  const {
    organization_id,
    entry_date,
    description,
    number,
    reference_type,
    reference_id,
    lines,
    created_by,
  } = params;

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) return null;

  if (reference_type && reference_id) {
    const exists = await hasJournalForReference(organization_id, reference_type, reference_id);
    if (exists) return null;
  }

  const accountIds = await getAccountIdsByCode(organization_id);
  const validLines = lines.filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);
  if (validLines.length === 0) return null;

  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .insert({
      organization_id,
      entry_date: entry_date.slice(0, 10),
      number: number?.trim() || null,
      description: description.trim() || null,
      reference_type: reference_type || null,
      reference_id: reference_id || null,
      created_by: created_by || null,
    })
    .select("id")
    .single();

  if (entryErr || !entry) return null;

  const lineRows = validLines
    .map((l) => {
      const accountId = accountIds[l.code];
      if (!accountId) return null;
      const debit = Math.round((Number(l.debit) || 0) * 100) / 100;
      const credit = Math.round((Number(l.credit) || 0) * 100) / 100;
      if (debit <= 0 && credit <= 0) return null;
      return {
        journal_entry_id: entry.id,
        account_id: accountId,
        debit,
        credit,
        memo: l.memo?.trim() || null,
      };
    })
    .filter(Boolean) as { journal_entry_id: string; account_id: string; debit: number; credit: number; memo: string | null }[];

  if (lineRows.length === 0) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return null;
  }

  const lineDebit = lineRows.reduce((s, r) => s + r.debit, 0);
  const lineCredit = lineRows.reduce((s, r) => s + r.credit, 0);
  if (Math.abs(lineDebit - lineCredit) > 0.01) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return null;
  }

  const { error: linesErr } = await supabase.from("journal_entry_lines").insert(lineRows);
  if (linesErr) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return null;
  }

  return entry.id;
}

/** Ringkasan hasil backfill. */
export interface BackfillResult {
  orders: number;
  cash_flows: number;
  receivables: number;
  payables: number;
  errors: string[];
}

/**
 * Sinkronisasi transaksi lama ke jurnal: order (paid), arus kas, piutang, hutang
 * yang belum punya jurnal. Idempotent: hanya yang belum ada ref-nya yang diposting.
 */
export async function backfillAccounting(orgId: string): Promise<BackfillResult> {
  const result: BackfillResult = { orders: 0, cash_flows: 0, receivables: 0, payables: 0, errors: [] };
  await ensureCoa(orgId);

  const { data: existingRefs } = await supabase
    .from("journal_entries")
    .select("reference_type, reference_id")
    .eq("organization_id", orgId)
    .not("reference_type", "is", null)
    .not("reference_id", "is", null);
  const posted = new Set<string>();
  (existingRefs ?? []).forEach((r: { reference_type: string; reference_id: string }) => {
    posted.add(`${r.reference_type}:${r.reference_id}`);
  });

  const hasJournal = (refType: string, refId: string) => posted.has(`${refType}:${refId}`);

  // --- Orders (paid) ---
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, created_at")
    .eq("organization_id", orgId)
    .eq("status", "paid");
  for (const order of orders ?? []) {
    if (hasJournal("order", order.id)) continue;
    try {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, unit_id, quantity")
        .eq("order_id", order.id)
        .not("product_id", "is", null);
      let cogsTotal = 0;
      if (items?.length) {
        const productIds = [...new Set(items.map((i: { product_id: string }) => i.product_id))];
        const { data: products } = await supabase
          .from("products")
          .select("id, cost_price")
          .in("id", productIds);
        const prodMap = new Map((products ?? []).map((p: { id: string; cost_price: number }) => [p.id, Number(p.cost_price ?? 0)]));
        const { data: units } = await supabase
          .from("product_units")
          .select("product_id, unit_id, conversion_to_base, is_base")
          .in("product_id", productIds);
        for (const it of items) {
          const cost = prodMap.get(it.product_id) ?? 0;
          const pu = (units as { product_id: string; unit_id: string | null; conversion_to_base: number; is_base: boolean }[]).find(
            (u) => u.product_id === it.product_id && (it.unit_id ? u.unit_id === it.unit_id : u.is_base)
          );
          const conv = pu?.conversion_to_base ?? 1;
          cogsTotal += cost * (Number(it.quantity) || 0) * conv;
        }
      }
      const finalTotal = Number(order.total) || 0;
      let amountPaidNow = 0;
      const { data: cf } = await supabase
        .from("cash_flows")
        .select("amount")
        .eq("organization_id", orgId)
        .eq("reference_type", "order")
        .eq("reference_id", order.id)
        .maybeSingle();
      if (cf) amountPaidNow = Number(cf.amount) || 0;
      else {
        const { data: rec } = await supabase
          .from("receivables")
          .select("paid")
          .eq("order_id", order.id)
          .maybeSingle();
        if (rec) amountPaidNow = Number(rec.paid) || 0;
        else amountPaidNow = finalTotal;
      }
      const lines: JournalLine[] = [];
      if (amountPaidNow > 0) lines.push({ code: "1-1", debit: amountPaidNow, credit: 0 });
      if (finalTotal - amountPaidNow > 0) lines.push({ code: "1-2", debit: finalTotal - amountPaidNow, credit: 0 });
      lines.push({ code: "4-1", debit: 0, credit: finalTotal });
      if (cogsTotal > 0) {
        lines.push({ code: "5-1", debit: cogsTotal, credit: 0 });
        lines.push({ code: "1-3", debit: 0, credit: cogsTotal });
      }
      if (lines.length > 0) {
        const id = await postJournalEntry({
          organization_id: orgId,
          entry_date: String(order.created_at).slice(0, 10),
          description: `Penjualan POS #${order.id.slice(0, 8)}`,
          reference_type: "order",
          reference_id: order.id,
          lines,
        });
        if (id) {
          result.orders++;
          posted.add(`order:${order.id}`);
        }
      }
    } catch (e) {
      result.errors.push(`Order ${order.id.slice(0, 8)}: ${(e as Error).message}`);
    }
  }

  // --- Cash flows (skip yang reference_type=order karena sudah masuk di backfill order) ---
  const { data: flows } = await supabase
    .from("cash_flows")
    .select("id, type, amount, description, reference_type, reference_id, created_at")
    .eq("organization_id", orgId);
  for (const cf of flows ?? []) {
    if ((cf.reference_type as string) === "order") continue;
    if (hasJournal("cash_flow", cf.id)) continue;
    const amount = Math.abs(Number(cf.amount) || 0);
    if (amount <= 0) continue;
    try {
      const refType = (cf.reference_type as string) || "";
      const entryDate = String(cf.created_at).slice(0, 10);
      const desc = (cf.description as string)?.trim() || (cf.type === "in" ? "Kas masuk" : "Kas keluar");
      let lines: JournalLine[];
      if (cf.type === "in") {
        if (refType === "receivable") {
          lines = [
            { code: "1-1", debit: amount, credit: 0 },
            { code: "1-2", debit: 0, credit: amount },
          ];
        } else {
          lines = [
            { code: "1-1", debit: amount, credit: 0 },
            { code: "4-2", debit: 0, credit: amount },
          ];
        }
      } else {
        if (refType === "payable") {
          lines = [
            { code: "2-1", debit: amount, credit: 0 },
            { code: "1-1", debit: 0, credit: amount },
          ];
        } else if (refType === "purchase") {
          lines = [
            { code: "1-3", debit: amount, credit: 0 },
            { code: "1-1", debit: 0, credit: amount },
          ];
        } else {
          lines = [
            { code: "5-2", debit: amount, credit: 0 },
            { code: "1-1", debit: 0, credit: amount },
          ];
        }
      }
      const id = await postJournalEntry({
        organization_id: orgId,
        entry_date: entryDate,
        description: desc,
        reference_type: "cash_flow",
        reference_id: cf.id,
        lines,
      });
      if (id) {
        result.cash_flows++;
        posted.add(`cash_flow:${cf.id}`);
      }
    } catch (e) {
      result.errors.push(`Arus kas ${cf.id.slice(0, 8)}: ${(e as Error).message}`);
    }
  }

  // --- Receivables ---
  const { data: recs } = await supabase
    .from("receivables")
    .select("id, amount, notes, created_at")
    .eq("organization_id", orgId);
  for (const r of recs ?? []) {
    if (hasJournal("receivable", r.id)) continue;
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    try {
      const id = await postJournalEntry({
        organization_id: orgId,
        entry_date: String(r.created_at).slice(0, 10),
        description: (r.notes as string)?.trim() || "Piutang usaha",
        reference_type: "receivable",
        reference_id: r.id,
        lines: [
          { code: "1-2", debit: amount, credit: 0 },
          { code: "4-1", debit: 0, credit: amount },
        ],
      });
      if (id) {
        result.receivables++;
        posted.add(`receivable:${r.id}`);
      }
    } catch (e) {
      result.errors.push(`Piutang ${r.id.slice(0, 8)}: ${(e as Error).message}`);
    }
  }

  // --- Payables ---
  const { data: pays } = await supabase
    .from("payables")
    .select("id, amount, notes, created_at")
    .eq("organization_id", orgId);
  for (const p of pays ?? []) {
    if (hasJournal("payable", p.id)) continue;
    const amount = Number(p.amount) || 0;
    if (amount <= 0) continue;
    try {
      const id = await postJournalEntry({
        organization_id: orgId,
        entry_date: String(p.created_at).slice(0, 10),
        description: (p.notes as string)?.trim() || "Hutang usaha",
        reference_type: "payable",
        reference_id: p.id,
        lines: [
          { code: "5-2", debit: amount, credit: 0 },
          { code: "2-1", debit: 0, credit: amount },
        ],
      });
      if (id) {
        result.payables++;
        posted.add(`payable:${p.id}`);
      }
    } catch (e) {
      result.errors.push(`Hutang ${p.id.slice(0, 8)}: ${(e as Error).message}`);
    }
  }

  return result;
}

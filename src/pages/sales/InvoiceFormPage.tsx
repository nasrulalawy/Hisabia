import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { parsePriceIdr } from "@/lib/utils";
import type { SalesInvoiceLine } from "@/lib/database.types";

type LineRow = { id?: string; description: string; quantity: string; unit_price: string; amount: number };

export function InvoiceFormPage() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const isEdit = !!invoiceId;

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [quotes, setQuotes] = useState<{ id: string; number: string; customer_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: "",
    sales_quote_id: "",
    customer_id: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    status: "draft" as "draft" | "sent" | "paid" | "overdue" | "canceled",
    notes: "",
  });
  const [lines, setLines] = useState<LineRow[]>([{ description: "", quantity: "1", unit_price: "0", amount: 0 }]);

  function recalcLine(idx: number, field: "quantity" | "unit_price", value: string) {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      const q = parsePriceIdr(next[idx].quantity) || 0;
      const p = parsePriceIdr(next[idx].unit_price) || 0;
      next[idx].amount = Math.round(q * p * 100) / 100;
      return next;
    });
  }

  function setLineDesc(idx: number, value: string) {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], description: value };
      return next;
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const total = subtotal;

  async function fetchOptions() {
    if (!orgId) return;
    const [custRes, quoteRes] = await Promise.all([
      supabase.from("customers").select("id, name").eq("organization_id", orgId).order("name"),
      supabase.from("sales_quotes").select("id, number, customer_id").eq("organization_id", orgId).eq("status", "accepted").order("quote_date", { ascending: false }),
    ]);
    setCustomers(custRes.data ?? []);
    setQuotes(quoteRes.data ?? []);
  }

  async function fetchInvoice() {
    if (!invoiceId || !orgId) return;
    const { data: inv, error: invErr } = await supabase
      .from("sales_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .single();
    if (invErr || !inv) {
      setError(invErr?.message ?? "Invoice tidak ditemukan");
      setLoading(false);
      return;
    }
    setForm({
      number: inv.number,
      sales_quote_id: inv.sales_quote_id ?? "",
      customer_id: inv.customer_id,
      invoice_date: (inv.invoice_date as string).slice(0, 10),
      due_date: inv.due_date ? (inv.due_date as string).slice(0, 10) : "",
      status: inv.status ?? "draft",
      notes: inv.notes ?? "",
    });
    const { data: lineRows } = await supabase
      .from("sales_invoice_lines")
      .select("*")
      .eq("sales_invoice_id", invoiceId)
      .order("sort_order");
    const fmt = (n: number) => (n % 1 === 0 ? String(Math.round(n)) : String(n));
    setLines(
      (lineRows as SalesInvoiceLine[]).length
        ? (lineRows as SalesInvoiceLine[]).map((l) => ({
            id: l.id,
            description: l.description,
            quantity: fmt(l.quantity),
            unit_price: fmt(l.unit_price),
            amount: Number(l.amount),
          }))
        : [{ description: "", quantity: "1", unit_price: "0", amount: 0 }]
    );
    setLoading(false);
  }

  useEffect(() => {
    if (!orgId) return;
    fetchOptions();
    if (isEdit) fetchInvoice();
    else setLoading(false);
  }, [orgId, invoiceId, isEdit]);

  function loadFromQuote(quoteId: string) {
    if (!quoteId) return;
    const q = quotes.find((x) => x.id === quoteId);
    if (q) setForm((f) => ({ ...f, customer_id: q.customer_id, sales_quote_id: quoteId }));
    supabase
      .from("sales_quote_lines")
      .select("description, quantity, unit_price, amount")
      .eq("sales_quote_id", quoteId)
      .order("sort_order")
      .then(({ data }) => {
        if (data?.length) {
          const fmt = (n: number) => (n % 1 === 0 ? String(Math.round(n)) : String(n));
          setLines(
            data.map((l) => ({
              description: l.description,
              quantity: fmt(l.quantity),
              unit_price: fmt(l.unit_price),
              amount: Number(l.amount),
            }))
          );
        }
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !form.customer_id.trim()) {
      setError("Pilih pelanggan.");
      return;
    }
    const validLines = lines.filter((l) => l.description.trim());
    if (!validLines.length) {
      setError("Minimal satu baris item.");
      return;
    }
    setSubmitLoading(true);
    setError(null);
    try {
      if (isEdit && invoiceId) {
        await supabase
          .from("sales_invoices")
          .update({
            sales_quote_id: form.sales_quote_id || null,
            customer_id: form.customer_id,
            invoice_date: form.invoice_date,
            due_date: form.due_date || null,
            status: form.status,
            subtotal,
            tax: 0,
            total,
            notes: form.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId)
          .eq("organization_id", orgId);
        await supabase.from("sales_invoice_lines").delete().eq("sales_invoice_id", invoiceId);
        for (let i = 0; i < validLines.length; i++) {
          const l = validLines[i];
          const q = parsePriceIdr(l.quantity) || 0;
          const p = parsePriceIdr(l.unit_price) || 0;
          await supabase.from("sales_invoice_lines").insert({
            sales_invoice_id: invoiceId,
            description: l.description.trim(),
            quantity: q,
            unit_price: p,
            amount: Math.round(q * p * 100) / 100,
            sort_order: i,
          });
        }
      } else {
        const { data: num } = await supabase.rpc("get_next_sales_doc_number", {
          p_org_id: orgId,
          p_doc_type: "invoice",
          p_date: form.invoice_date,
        });
        const { data: inserted, error: insErr } = await supabase
          .from("sales_invoices")
          .insert({
            organization_id: orgId,
            number: num ?? `INV-${form.invoice_date}-001`,
            sales_quote_id: form.sales_quote_id || null,
            customer_id: form.customer_id,
            invoice_date: form.invoice_date,
            due_date: form.due_date || null,
            status: form.status,
            subtotal,
            tax: 0,
            total,
            notes: form.notes.trim() || null,
          })
          .select("id")
          .single();
        if (insErr || !inserted) throw insErr ?? new Error("Insert failed");
        for (let i = 0; i < validLines.length; i++) {
          const l = validLines[i];
          const q = parsePriceIdr(l.quantity) || 0;
          const p = parsePriceIdr(l.unit_price) || 0;
          await supabase.from("sales_invoice_lines").insert({
            sales_invoice_id: inserted.id,
            description: l.description.trim(),
            quantity: q,
            unit_price: p,
            amount: Math.round(q * p * 100) / 100,
            sort_order: i,
          });
        }
      }
      navigate("../", { relative: "path" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSubmitLoading(false);
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unit_price: "0", amount: 0 }]);
  }

  function removeLine(idx: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">{isEdit ? "Edit Invoice" : "Tambah Invoice"}</h2>
        <p className="text-[var(--muted-foreground)]">Buat atau ubah faktur penjualan.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <Card>
        <CardHeader><CardTitle>Data Invoice</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isEdit && quotes.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium">Dari penawaran</label>
                <select
                  value={form.sales_quote_id}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, sales_quote_id: e.target.value }));
                    loadFromQuote(e.target.value);
                  }}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="">-- Buat manual --</option>
                  {quotes.map((q) => (
                    <option key={q.id} value={q.id}>{q.number}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {isEdit && (
                <div>
                  <label className="mb-2 block text-sm font-medium">No. Invoice</label>
                  <Input value={form.number} readOnly className="bg-[var(--muted)]" />
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium">Pelanggan *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="">Pilih pelanggan</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Tanggal</label>
                <Input type="date" value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Jatuh tempo</label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Terkirim</option>
                  <option value="paid">Lunas</option>
                  <option value="overdue">Jatuh tempo</option>
                  <option value="canceled">Dibatalkan</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Item</label>
              <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2">
                    <Input placeholder="Deskripsi" value={line.description} onChange={(e) => setLineDesc(idx, e.target.value)} className="min-w-[200px] flex-1" />
                    <Input placeholder="Qty" value={line.quantity} onChange={(e) => recalcLine(idx, "quantity", e.target.value)} className="w-20" />
                    <Input placeholder="Harga" value={line.unit_price} onChange={(e) => recalcLine(idx, "unit_price", e.target.value)} className="w-28" />
                    <span className="w-24 text-right text-sm">{new Intl.NumberFormat("id-ID").format(line.amount)}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeLine(idx)}>Hapus</Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Tambah baris</Button>
              </div>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Total</span>
              <span>{new Intl.NumberFormat("id-ID").format(total)}</span>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Catatan</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("../", { relative: "path" })}>Batal</Button>
              <Button type="submit" disabled={submitLoading}>{submitLoading ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Invoice"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

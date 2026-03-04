import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { parsePriceIdr } from "@/lib/utils";
import type { SalesQuoteLine } from "@/lib/database.types";

type LineRow = { id?: string; description: string; quantity: string; unit_price: string; amount: number };

export function PenawaranFormPage() {
  const { id: quoteId } = useParams<{ id: string }>();
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const isEdit = !!quoteId;

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: "",
    customer_id: "",
    quote_date: new Date().toISOString().slice(0, 10),
    valid_until: "",
    status: "draft" as "draft" | "sent" | "accepted" | "rejected",
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
  const tax = 0;
  const total = subtotal + tax;

  async function fetchCustomers() {
    if (!orgId) return;
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name");
    setCustomers(data ?? []);
  }

  async function fetchQuote() {
    if (!quoteId || !orgId) return;
    const { data: quote, error: qErr } = await supabase
      .from("sales_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("organization_id", orgId)
      .single();
    if (qErr || !quote) {
      setError(qErr?.message ?? "Penawaran tidak ditemukan");
      setLoading(false);
      return;
    }
    setForm({
      number: quote.number,
      customer_id: quote.customer_id,
      quote_date: (quote.quote_date as string).slice(0, 10),
      valid_until: quote.valid_until ? (quote.valid_until as string).slice(0, 10) : "",
      status: quote.status ?? "draft",
      notes: quote.notes ?? "",
    });
    const { data: lineRows } = await supabase
      .from("sales_quote_lines")
      .select("*")
      .eq("sales_quote_id", quoteId)
      .order("sort_order");
    const fmt = (n: number) => (n % 1 === 0 ? String(Math.round(n)) : String(n));
    setLines(
      (lineRows as SalesQuoteLine[]).length
        ? (lineRows as SalesQuoteLine[]).map((l) => ({
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
    fetchCustomers();
    if (isEdit) fetchQuote();
    else setLoading(false);
  }, [orgId, quoteId, isEdit]);

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
      if (isEdit && quoteId) {
        const { error: updErr } = await supabase
          .from("sales_quotes")
          .update({
            customer_id: form.customer_id,
            quote_date: form.quote_date,
            valid_until: form.valid_until || null,
            status: form.status,
            subtotal,
            tax,
            total,
            notes: form.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", quoteId)
          .eq("organization_id", orgId);
        if (updErr) throw updErr;
        await supabase.from("sales_quote_lines").delete().eq("sales_quote_id", quoteId);
        for (let i = 0; i < validLines.length; i++) {
          const l = validLines[i];
          const q = parsePriceIdr(l.quantity) || 0;
          const p = parsePriceIdr(l.unit_price) || 0;
          await supabase.from("sales_quote_lines").insert({
            sales_quote_id: quoteId,
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
          p_doc_type: "quote",
          p_date: form.quote_date,
        });
        const { data: inserted, error: insErr } = await supabase
          .from("sales_quotes")
          .insert({
            organization_id: orgId,
            number: num ?? `PQ-${form.quote_date}-001`,
            customer_id: form.customer_id,
            quote_date: form.quote_date,
            valid_until: form.valid_until || null,
            status: form.status,
            subtotal,
            tax,
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
          await supabase.from("sales_quote_lines").insert({
            sales_quote_id: inserted.id,
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
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          {isEdit ? "Edit Penawaran" : "Tambah Penawaran"}
        </h2>
        <p className="text-[var(--muted-foreground)]">Buat atau ubah penawaran harga.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Data Penawaran</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {isEdit && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">No. Penawaran</label>
                  <Input value={form.number} readOnly className="bg-[var(--muted)]" />
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Pelanggan *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="">Pilih pelanggan</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Tanggal</label>
                <Input
                  type="date"
                  value={form.quote_date}
                  onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Valid sampai</label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as "draft" | "sent" | "accepted" | "rejected" }))
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Terkirim</option>
                  <option value="accepted">Diterima</option>
                  <option value="rejected">Ditolak</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Item</label>
              <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2">
                    <Input
                      placeholder="Deskripsi"
                      value={line.description}
                      onChange={(e) => setLineDesc(idx, e.target.value)}
                      className="min-w-[200px] flex-1"
                    />
                    <Input
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => recalcLine(idx, "quantity", e.target.value)}
                      className="w-20"
                    />
                    <Input
                      placeholder="Harga satuan"
                      value={line.unit_price}
                      onChange={(e) => recalcLine(idx, "unit_price", e.target.value)}
                      className="w-28"
                    />
                    <span className="w-24 text-right text-sm text-[var(--muted-foreground)]">
                      {new Intl.NumberFormat("id-ID").format(line.amount)}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeLine(idx)}>
                      Hapus
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  + Tambah baris
                </Button>
              </div>
            </div>
            <div className="flex justify-between border-t pt-2 text-sm">
              <span className="text-[var(--muted-foreground)]">Subtotal</span>
              <span>{new Intl.NumberFormat("id-ID").format(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Total</span>
              <span>{new Intl.NumberFormat("id-ID").format(total)}</span>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("../", { relative: "path" })}>
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Penawaran"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

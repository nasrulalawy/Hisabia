import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { SalesInvoiceLine } from "@/lib/database.types";

type InvoiceLineRow = SalesInvoiceLine & { quantity_delivered: string };

export function PengirimanFormPage() {
  const { id: deliveryId } = useParams<{ id: string }>();
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const isEdit = !!deliveryId;

  const [invoices, setInvoices] = useState<{ id: string; number: string; customer_id: string }[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: "",
    sales_invoice_id: "",
    delivery_date: new Date().toISOString().slice(0, 10),
    status: "pending" as "pending" | "partial" | "delivered",
    notes: "",
  });

  async function fetchInvoices() {
    if (!orgId) return;
    const { data } = await supabase
      .from("sales_invoices")
      .select("id, number, customer_id")
      .eq("organization_id", orgId)
      .neq("status", "canceled")
      .order("invoice_date", { ascending: false });
    setInvoices(data ?? []);
  }

  function loadInvoiceLines(invId: string) {
    if (!invId) {
      setInvoiceLines([]);
      return;
    }
    supabase
      .from("sales_invoice_lines")
      .select("*")
      .eq("sales_invoice_id", invId)
      .order("sort_order")
      .then(({ data }) => {
        setInvoiceLines(
          (data ?? []).map((l) => ({
            ...l,
            quantity_delivered: String(l.quantity),
          }))
        );
      });
  }

  async function fetchDelivery() {
    if (!deliveryId || !orgId) return;
    const { data: del, error: delErr } = await supabase
      .from("sales_deliveries")
      .select("*")
      .eq("id", deliveryId)
      .eq("organization_id", orgId)
      .single();
    if (delErr || !del) {
      setError(delErr?.message ?? "Pengiriman tidak ditemukan");
      setLoading(false);
      return;
    }
    setForm({
      number: del.number,
      sales_invoice_id: del.sales_invoice_id,
      delivery_date: (del.delivery_date as string).slice(0, 10),
      status: del.status ?? "pending",
      notes: del.notes ?? "",
    });
    loadInvoiceLines(del.sales_invoice_id);
    const { data: lines } = await supabase
      .from("sales_delivery_lines")
      .select("sales_invoice_line_id, quantity_delivered")
      .eq("sales_delivery_id", deliveryId);
    const deliveredMap = new Map((lines ?? []).map((l) => [l.sales_invoice_line_id, Number(l.quantity_delivered)]));
    supabase
      .from("sales_invoice_lines")
      .select("*")
      .eq("sales_invoice_id", del.sales_invoice_id)
      .order("sort_order")
      .then(({ data: invLines }) => {
        setInvoiceLines(
          (invLines ?? []).map((l) => ({
            ...l,
            quantity_delivered: String(deliveredMap.get(l.id) ?? l.quantity),
          }))
        );
      });
    setLoading(false);
  }

  useEffect(() => {
    if (!orgId) return;
    fetchInvoices();
    if (isEdit) fetchDelivery();
    else setLoading(false);
  }, [orgId, deliveryId, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !form.sales_invoice_id) {
      setError("Pilih invoice.");
      return;
    }
    setSubmitLoading(true);
    setError(null);
    try {
      if (isEdit && deliveryId) {
        await supabase
          .from("sales_deliveries")
          .update({
            sales_invoice_id: form.sales_invoice_id,
            delivery_date: form.delivery_date,
            status: form.status,
            notes: form.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deliveryId)
          .eq("organization_id", orgId);
        await supabase.from("sales_delivery_lines").delete().eq("sales_delivery_id", deliveryId);
        for (const line of invoiceLines) {
          const qty = parseFloat(line.quantity_delivered) || 0;
          if (qty <= 0) continue;
          await supabase.from("sales_delivery_lines").insert({
            sales_delivery_id: deliveryId,
            sales_invoice_line_id: line.id,
            quantity_delivered: qty,
          });
        }
      } else {
        const { data: num } = await supabase.rpc("get_next_sales_doc_number", {
          p_org_id: orgId,
          p_doc_type: "delivery",
          p_date: form.delivery_date,
        });
        const { data: inserted, error: insErr } = await supabase
          .from("sales_deliveries")
          .insert({
            organization_id: orgId,
            number: num ?? `DO-${form.delivery_date}-001`,
            sales_invoice_id: form.sales_invoice_id,
            delivery_date: form.delivery_date,
            status: form.status,
            notes: form.notes.trim() || null,
          })
          .select("id")
          .single();
        if (insErr || !inserted) throw insErr ?? new Error("Insert failed");
        for (const line of invoiceLines) {
          const qty = parseFloat(line.quantity_delivered) || 0;
          if (qty <= 0) continue;
          await supabase.from("sales_delivery_lines").insert({
            sales_delivery_id: inserted.id,
            sales_invoice_line_id: line.id,
            quantity_delivered: qty,
          });
        }
      }
      navigate("../", { relative: "path" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    }
    setSubmitLoading(false);
  }

  function setDelivered(idx: number, value: string) {
    setInvoiceLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity_delivered: value };
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">{isEdit ? "Edit Pengiriman" : "Tambah Pengiriman"}</h2>
        <p className="text-[var(--muted-foreground)]">Surat jalan berdasarkan invoice.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <Card>
        <CardHeader><CardTitle>Data Pengiriman</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {isEdit && (
                <div>
                  <label className="mb-2 block text-sm font-medium">No. Surat Jalan</label>
                  <Input value={form.number} readOnly className="bg-[var(--muted)]" />
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium">Invoice *</label>
                <select
                  value={form.sales_invoice_id}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, sales_invoice_id: e.target.value }));
                    loadInvoiceLines(e.target.value);
                  }}
                  required
                  disabled={isEdit}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="">Pilih invoice</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Tanggal</label>
                <Input type="date" value={form.delivery_date} onChange={(e) => setForm((f) => ({ ...f, delivery_date: e.target.value }))} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="pending">Menunggu</option>
                  <option value="partial">Sebagian</option>
                  <option value="delivered">Terkirim</option>
                </select>
              </div>
            </div>
            {invoiceLines.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium">Qty dikirim per item</label>
                <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                  {invoiceLines.map((line, idx) => (
                    <div key={line.id} className="flex items-center gap-4">
                      <span className="flex-1 text-sm">{line.description} (max {line.quantity})</span>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={line.quantity_delivered}
                        onChange={(e) => setDelivered(idx, e.target.value)}
                        className="w-24"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium">Catatan</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("../", { relative: "path" })}>Batal</Button>
              <Button type="submit" disabled={submitLoading}>{submitLoading ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Pengiriman"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

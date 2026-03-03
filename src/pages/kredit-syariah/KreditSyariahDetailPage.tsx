import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import type { KreditSyariahAkad, KreditSyariahAngsuran, KreditSyariahAkadStatus, KreditSyariahAkadItem } from "@/lib/database.types";

const STATUS_LABELS: Record<KreditSyariahAkadStatus, string> = {
  draft: "Draft",
  aktif: "Aktif",
  lunas: "Lunas",
  macet: "Macet",
};

export function KreditSyariahDetailPage() {
  const { orgId, organizationFeatureGrants, currentOutletType } = useOrg();
  const { orgId: _routeOrgId, akadId } = useParams<{ orgId: string; akadId: string }>();
  const hasGrant = organizationFeatureGrants?.includes("kredit_syariah") ?? false;
  const isMart = currentOutletType === "mart";
  const [akad, setAkad] = useState<(KreditSyariahAkad & { customers?: { name: string; phone: string | null } | null }) | null>(null);
  const [akadItems, setAkadItems] = useState<KreditSyariahAkadItem[]>([]);
  const [angsuranList, setAngsuranList] = useState<KreditSyariahAngsuran[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentForm, setPaymentForm] = useState({
    jumlah_bayar: "",
    tanggal_bayar: new Date().toISOString().slice(0, 10),
    metode_bayar: "tunai",
    catatan: "",
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function fetchAkadAndAngsuran() {
    if (!orgId || !akadId) return;
    const { data: akadData, error: akadErr } = await supabase
      .from("kredit_syariah_akad")
      .select("*, customers(name, phone)")
      .eq("id", akadId)
      .eq("organization_id", orgId)
      .single();
    if (akadErr || !akadData) {
      setAkad(null);
      setLoading(false);
      return;
    }
    setAkad(akadData as KreditSyariahAkad & { customers?: { name: string; phone: string | null } | null });

    const [angsuranRes, itemsRes] = await Promise.all([
      supabase
        .from("kredit_syariah_angsuran")
        .select("*")
        .eq("akad_id", akadId)
        .order("tanggal_bayar", { ascending: false }),
      supabase
        .from("kredit_syariah_akad_items")
        .select("*")
        .eq("akad_id", akadId),
    ]);
    setAngsuranList((angsuranRes.data ?? []) as KreditSyariahAngsuran[]);
    setAkadItems((itemsRes.data ?? []) as KreditSyariahAkadItem[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAkadAndAngsuran();
  }, [orgId, akadId]);

  async function handleBayarAngsuran(e: React.FormEvent) {
    e.preventDefault();
    if (!akadId || !akad) return;
    const amount = parseFloat(paymentForm.jumlah_bayar);
    if (amount <= 0) {
      setPaymentError("Jumlah bayar harus lebih dari 0.");
      return;
    }
    setPaymentSaving(true);
    setPaymentError(null);
    const { error: insertErr } = await supabase.from("kredit_syariah_angsuran").insert({
      akad_id: akadId,
      jumlah_bayar: amount,
      tanggal_bayar: paymentForm.tanggal_bayar,
      metode_bayar: paymentForm.metode_bayar || "tunai",
      catatan: paymentForm.catatan.trim() || null,
    });
    if (insertErr) {
      setPaymentError(insertErr.message);
      setPaymentSaving(false);
      return;
    }
    const totalPaid = angsuranList.reduce((s, a) => s + Number(a.jumlah_bayar), 0) + amount;
    const totalAmount = Number(akad.total_amount);
    if (totalPaid >= totalAmount && akad.status !== "lunas") {
      await supabase
        .from("kredit_syariah_akad")
        .update({ status: "lunas", updated_at: new Date().toISOString() })
        .eq("id", akadId);
    }
    setPaymentForm({
      jumlah_bayar: "",
      tanggal_bayar: new Date().toISOString().slice(0, 10),
      metode_bayar: "tunai",
      catatan: "",
    });
    setPaymentSaving(false);
    fetchAkadAndAngsuran();
  }

  if (!hasGrant || !isMart) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-[var(--muted-foreground)]">
            Fitur Kredit Syariah hanya tersedia untuk usaha tipe Mart dan organisasi yang telah diberi izin oleh admin.
          </p>
          <Link to={`/org/${orgId}/kredit-syariah`} className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline">
            Kembali
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (loading && !akad) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!akad) {
    return (
      <div className="space-y-4">
        <Link to={`/org/${orgId}/kredit-syariah`} className="text-sm text-[var(--primary)] hover:underline">
          ← Kembali ke Daftar Akad
        </Link>
        <p className="text-[var(--muted-foreground)]">Akad tidak ditemukan.</p>
      </div>
    );
  }

  const totalPaid = angsuranList.reduce((s, a) => s + Number(a.jumlah_bayar), 0);
  const sisa = Math.max(0, Number(akad.total_amount) - totalPaid);

  const jadwalBulanan: { index: number; dueDate: string }[] = akad.tanggal_mulai
    ? Array.from({ length: akad.tenor_bulan }, (_, i) => {
        const start = new Date(akad.tanggal_mulai as unknown as string);
        const d = new Date(start);
        d.setMonth(start.getMonth() + i + 1);
        return {
          index: i + 1,
          dueDate: d.toISOString().slice(0, 10),
        };
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/org/${orgId}/kredit-syariah`} className="text-sm text-[var(--primary)] hover:underline">
          ← Kembali ke Daftar Akad
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Detail Akad</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{akad.customers?.name ?? "—"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
              Total Sudah Dibayar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatIdr(totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
              Sisa Tunggakan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${sisa > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatIdr(sisa)}
            </p>
          </CardContent>
        </Card>
      </div>

      {akadItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Produk yang Dibiayai</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-2 font-medium">Produk</th>
                  <th className="pb-2 text-right font-medium">Harga satuan</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {akadItems.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)]">
                    <td className="py-2">{item.product_name ?? "—"}</td>
                    <td className="py-2 text-right">{formatIdr(Number(item.unit_price))}</td>
                    <td className="py-2 text-right">{Number(item.quantity)}</td>
                    <td className="py-2 text-right">{formatIdr(Number(item.quantity) * Number(item.unit_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {jadwalBulanan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jadwal Jatuh Tempo Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-2 font-medium">Bulan ke-</th>
                  <th className="pb-2 font-medium">Tanggal Jatuh Tempo</th>
                  <th className="pb-2 text-right font-medium">Angsuran</th>
                </tr>
              </thead>
              <tbody>
                {jadwalBulanan.map((row) => (
                  <tr key={row.index} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2">{row.index}</td>
                    <td className="py-2">{formatDate(row.dueDate)}</td>
                    <td className="py-2 text-right">
                      {formatIdr(Number(akad.angsuran_per_bulan))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {akad.harga_barang != null && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Harga Barang</span>
              <span>{formatIdr(Number(akad.harga_barang))}</span>
            </div>
          )}
          {akad.margin_percent != null && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Margin keuntungan</span>
              <span>{Number(akad.margin_percent)}%</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Total Pembiayaan</span>
            <span className="font-medium">{formatIdr(Number(akad.total_amount))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Tenor</span>
            <span>{akad.tenor_bulan} bulan</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Angsuran per Bulan</span>
            <span>{formatIdr(Number(akad.angsuran_per_bulan))}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Sudah Dibayar</span>
            <span className="font-medium text-emerald-600">{formatIdr(totalPaid)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Sisa</span>
            <span className="font-medium">{formatIdr(sisa)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Status</span>
            <span>{STATUS_LABELS[akad.status]}</span>
          </div>
          {akad.tanggal_mulai && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Tanggal Mulai</span>
              <span>{formatDate(akad.tanggal_mulai)}</span>
            </div>
          )}
          {akad.tanggal_jatuh_tempo && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Jatuh Tempo</span>
              <span>{formatDate(akad.tanggal_jatuh_tempo)}</span>
            </div>
          )}
          {akad.catatan && (
            <div className="pt-2 text-sm text-[var(--muted-foreground)]">
              Catatan: {akad.catatan}
            </div>
          )}
        </CardContent>
      </Card>

      {akad.status !== "lunas" && (
        <Card>
          <CardHeader>
            <CardTitle>Catat Pembayaran Angsuran</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBayarAngsuran} className="space-y-4">
              {paymentError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {paymentError}
                </p>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Jumlah Bayar (Rp) *</label>
                <CurrencyInput
                  value={paymentForm.jumlah_bayar ? parseInt(paymentForm.jumlah_bayar, 10) || 0 : 0}
                  onChangeValue={(v) =>
                    setPaymentForm((f) => ({ ...f, jumlah_bayar: v ? String(v) : "" }))
                  }
                  placeholder="Contoh: 500000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tanggal Bayar</label>
                <Input
                  type="date"
                  value={paymentForm.tanggal_bayar}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, tanggal_bayar: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Metode Bayar</label>
                <select
                  value={paymentForm.metode_bayar}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, metode_bayar: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                >
                  <option value="tunai">Tunai</option>
                  <option value="transfer">Transfer</option>
                  <option value="qris">QRIS</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--muted-foreground)]">Catatan</label>
                <Input
                  value={paymentForm.catatan}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, catatan: e.target.value }))}
                  placeholder="Opsional"
                />
              </div>
              <Button type="submit" disabled={paymentSaving}>
                {paymentSaving ? "Menyimpan..." : "Simpan Pembayaran"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Angsuran</CardTitle>
        </CardHeader>
        <CardContent>
          {angsuranList.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
              Belum ada pembayaran angsuran.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">Tanggal</th>
                    <th className="pb-2 font-medium">Jumlah</th>
                    <th className="pb-2 font-medium">Metode</th>
                    <th className="pb-2 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {angsuranList.map((a) => (
                    <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2">{formatDate(a.tanggal_bayar)}</td>
                      <td className="py-2 font-medium">{formatIdr(Number(a.jumlah_bayar))}</td>
                      <td className="py-2">{a.metode_bayar ?? "—"}</td>
                      <td className="py-2 text-[var(--muted-foreground)]">{a.catatan ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

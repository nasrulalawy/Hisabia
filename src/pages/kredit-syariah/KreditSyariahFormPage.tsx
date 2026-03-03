import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

interface ProductOption {
  id: string;
  name: string;
  selling_price: number;
}

interface LineItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export function KreditSyariahFormPage() {
  const { orgId, currentOutletId, organizationFeatureGrants, currentOutletType } = useOrg();
  const { orgId: _routeOrgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const hasGrant = organizationFeatureGrants?.includes("kredit_syariah") ?? false;
  const isMart = currentOutletType === "mart";
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    tenor_bulan: "",
    margin_percent: "",
    catatan: "",
    aktifkan_sekarang: true,
  });

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [custRes, prodRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("name"),
        supabase
          .from("products")
          .select("id, name, selling_price")
          .eq("organization_id", orgId)
          .eq("is_available", true)
          .order("name"),
      ]);
      setCustomers(custRes.data ?? []);
      setProducts((prodRes.data ?? []) as ProductOption[]);
      setLoading(false);
    })();
  }, [orgId]);

  const filteredProducts = products.filter(
    (p) =>
      !lineItems.some((l) => l.product_id === p.id) &&
      (productSearch.trim() === "" ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const hargaBarang = lineItems.reduce(
    (sum, l) => sum + l.quantity * l.unit_price,
    0
  );
  const marginPercent = parseFloat(form.margin_percent) || 0;
  const tenor = parseInt(form.tenor_bulan, 10) || 0;
  const totalPembiayaan =
    tenor > 0 && lineItems.length > 0
      ? Math.round(hargaBarang * (1 + marginPercent / 100))
      : 0;
  const angsuranPerBulan = tenor > 0 && totalPembiayaan > 0 ? Math.round(totalPembiayaan / tenor) : 0;

  function addProduct(p: ProductOption) {
    setLineItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        unit_price: Number(p.selling_price ?? 0),
        quantity: 1,
      },
    ]);
    setProductSearch("");
  }

  function updateQuantity(index: number, qty: number) {
    const intQty = Number.isFinite(qty) ? Math.floor(qty) : 0;
    if (intQty < 1) return;
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: intQty } : item))
    );
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (!form.customer_id || lineItems.length === 0 || tenor <= 0) {
      setError("Pilih pelanggan, minimal satu produk, dan tenor.");
      return;
    }
    if (totalPembiayaan <= 0 || angsuranPerBulan <= 0) {
      setError("Total pembiayaan dan angsuran harus > 0. Cek margin % dan tenor.");
      return;
    }
    setSaving(true);
    setError(null);
    const now = new Date();
    let tanggal_mulai: string | null = null;
    let tanggal_jatuh_tempo: string | null = null;
    if (form.aktifkan_sekarang) {
      tanggal_mulai = now.toISOString().slice(0, 10);
      const due = new Date(now);
      due.setMonth(due.getMonth() + tenor);
      tanggal_jatuh_tempo = due.toISOString().slice(0, 10);
    }
    const status = form.aktifkan_sekarang ? "aktif" : "draft";
    const { data: inserted, error: err } = await supabase
      .from("kredit_syariah_akad")
      .insert({
        organization_id: orgId,
        outlet_id: currentOutletId,
        customer_id: form.customer_id,
        order_id: null,
        total_amount: totalPembiayaan,
        tenor_bulan: tenor,
        angsuran_per_bulan: angsuranPerBulan,
        harga_barang: hargaBarang,
        margin_percent: marginPercent,
        status,
        tanggal_mulai,
        tanggal_jatuh_tempo,
        catatan: form.catatan.trim() || null,
      })
      .select("id")
      .single();
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    if (!inserted?.id) {
      setSaving(false);
      return;
    }
    const itemsPayload = lineItems.map((l) => ({
      akad_id: inserted.id,
      product_id: l.product_id,
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
    }));
    const { error: itemsErr } = await supabase
      .from("kredit_syariah_akad_items")
      .insert(itemsPayload);
    if (itemsErr) {
      setError(itemsErr.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    navigate(`/org/${orgId}/kredit-syariah/${inserted.id}`);
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to={`/org/${orgId}/kredit-syariah`} className="text-sm text-[var(--primary)] hover:underline">
          ← Kembali ke Daftar Akad
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Buat Akad Baru</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Prinsip syariah (murabahah): pilih produk → tentukan tenor → tambah margin keuntungan. Total pembiayaan & angsuran dihitung otomatis, tanpa bunga.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pelanggan</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              required
              value={form.customer_id}
              onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
            >
              <option value="">— Pilih pelanggan —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>1. Pilih Produk yang Dikredit</CardTitle>
            <p className="text-sm font-normal text-[var(--muted-foreground)]">
              Harga per satuan mengikuti harga jual produk. Total harga barang = dasar perhitungan margin.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Cari & tambah produk</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Nama produk..."
                  className="flex-1"
                />
              </div>
              {filteredProducts.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  {filteredProducts.slice(0, 20).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--muted)]"
                      >
                        <span>{p.name}</span>
                        <span className="text-[var(--muted-foreground)]">{formatIdr(Number(p.selling_price ?? 0))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lineItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                      <th className="pb-2 font-medium">Produk</th>
                      <th className="pb-2 font-medium text-right">Harga satuan</th>
                      <th className="pb-2 font-medium text-right">Qty</th>
                      <th className="pb-2 font-medium text-right">Subtotal</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line, i) => (
                      <tr key={i} className="border-b border-[var(--border)]">
                        <td className="py-2">{line.product_name}</td>
                        <td className="py-2 text-right">{formatIdr(line.unit_price)}</td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={line.quantity}
                            onChange={(e) => updateQuantity(i, parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 text-right"
                          />
                        </td>
                        <td className="py-2 text-right font-medium">
                          {formatIdr(line.quantity * line.unit_price)}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="text-red-600 hover:underline"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-right font-medium">
                  Total Harga Barang: {formatIdr(hargaBarang)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Tenor & Margin (Keuntungan)</CardTitle>
            <p className="text-sm font-normal text-[var(--muted-foreground)]">
              Margin dalam % ditambah ke harga barang = total pembiayaan. Angsuran = total ÷ tenor. Tanpa bunga.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Tenor (bulan) <span className="text-red-500">*</span></label>
              <Input
                type="number"
                min={1}
                value={form.tenor_bulan}
                onChange={(e) => setForm((f) => ({ ...f, tenor_bulan: e.target.value }))}
                placeholder="Contoh: 6"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Margin keuntungan (%) <span className="text-red-500">*</span></label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={form.margin_percent}
                onChange={(e) => setForm((f) => ({ ...f, margin_percent: e.target.value }))}
                placeholder="Contoh: 20"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Total pembiayaan = Harga barang × (1 + margin%). Contoh: barang Rp 2.299.000 + 20% = Rp 2.758.800; 6 bulan → Rp 459.800/bulan.
              </p>
            </div>
            {lineItems.length > 0 && tenor > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Total Pembiayaan</span>
                  <span className="font-semibold">{formatIdr(totalPembiayaan)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Angsuran per bulan</span>
                  <span className="font-semibold text-[var(--primary)]">{formatIdr(angsuranPerBulan)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opsi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.aktifkan_sekarang}
                onChange={(e) => setForm((f) => ({ ...f, aktifkan_sekarang: e.target.checked }))}
                className="rounded border-[var(--border)]"
              />
              Aktifkan sekarang (tanggal mulai = hari ini)
            </label>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted-foreground)]">Catatan (opsional)</label>
              <textarea
                value={form.catatan}
                onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                placeholder="Keterangan akad..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || lineItems.length === 0 || tenor <= 0}>
            {saving ? "Menyimpan..." : "Simpan Akad"}
          </Button>
          <Link to={`/org/${orgId}/kredit-syariah`}>
            <Button type="button" variant="outline">Batal</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

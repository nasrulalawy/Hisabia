import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { parsePriceIdr } from "@/lib/utils";

export function ProdukFormPage() {
  const { orgId, id: productId } = useParams<{ orgId: string; id?: string }>();
  const { orgId: ctxOrgId } = useOrg();
  const navigate = useNavigate();
  const isEdit = !!productId;
  const baseOrgId = orgId ?? ctxOrgId;

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string; symbol: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category_id: "",
    supplier_id: "",
    default_unit_id: "",
    cost_price: "0",
    selling_price: "0",
    stock: "0",
    barcode: "",
    is_available: true,
  });

  async function fetchOptions() {
    if (!baseOrgId) return;
    const [catRes, unitRes, supRes] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name")
        .eq("organization_id", baseOrgId)
        .order("name"),
      supabase.from("units").select("id, name, symbol").eq("organization_id", baseOrgId).order("name"),
      supabase.from("suppliers").select("id, name").eq("organization_id", baseOrgId).order("name"),
    ]);
    setCategories(catRes.data ?? []);
    setUnits(unitRes.data ?? []);
    setSuppliers(supRes.data ?? []);
  }

  async function fetchProduct() {
    if (!productId) return;
    const { data, error: err } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();
    if (err || !data) {
      setError(err?.message ?? "Produk tidak ditemukan");
      return;
    }
    const fmt = (n: number | string) => {
      const x = Number(n);
      return isNaN(x) || x % 1 === 0 ? String(Math.round(x)) : String(x);
    };
    setForm({
      name: data.name,
      description: data.description ?? "",
      category_id: data.category_id ?? "",
      supplier_id: data.supplier_id ?? "",
      default_unit_id: data.default_unit_id ?? "",
      cost_price: fmt(data.cost_price ?? 0),
      selling_price: fmt(data.selling_price ?? 0),
      stock: fmt(data.stock ?? 0),
      barcode: data.barcode ?? "",
      is_available: data.is_available ?? true,
    });
  }

  useEffect(() => {
    async function init() {
      if (!baseOrgId) return;
      setLoading(true);
      await fetchOptions();
      if (productId) await fetchProduct();
      setLoading(false);
    }
    init();
  }, [baseOrgId, productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !baseOrgId) return;
    setSubmitLoading(true);
    setError(null);
    const payload = {
      organization_id: baseOrgId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      default_unit_id: form.default_unit_id || null,
      cost_price: parsePriceIdr(form.cost_price) || 0,
      selling_price: parsePriceIdr(form.selling_price) || 0,
      stock: parsePriceIdr(form.stock) || 0,
      barcode: form.barcode.trim() || null,
      is_available: form.is_available,
    };
    if (isEdit) {
      const { error: err } = await supabase
        .from("products")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", productId);
      if (err) setError(err.message);
      else navigate(`/org/${baseOrgId}/produk/${productId}`);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (insertErr) {
        setError(insertErr.message);
      } else if (inserted?.id) {
        if (payload.default_unit_id) {
          await supabase.from("product_units").insert({
            product_id: inserted.id,
            unit_id: payload.default_unit_id,
            conversion_to_base: 1,
            is_base: true,
          });
        }
        navigate(`/org/${baseOrgId}/produk/${inserted.id}`);
      } else {
        setError("Gagal menambah produk");
      }
    }
    setSubmitLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          {isEdit ? "Edit Produk" : "Tambah Produk"}
        </h2>
        <p className="text-[var(--muted-foreground)]">
          {isEdit ? "Ubah data produk" : "Tambah produk baru ke katalog"}
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Data Produk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama produk"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Deskripsi</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi produk"
                rows={2}
                className="h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Kategori</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Supplier</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Satuan Default</label>
                <select
                  value={form.default_unit_id}
                  onChange={(e) => setForm((f) => ({ ...f, default_unit_id: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">-- Pilih Satuan --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">HPP (Harga Beli)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.cost_price}
                  onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                  placeholder="0 atau 10.000"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Harga Jual</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.selling_price}
                  onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
                  placeholder="0 atau 10.000"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Barcode / SKU (untuk scan di POS)</label>
              <Input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="Kosongkan jika tidak pakai scan"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Isi barcode atau SKU produk. Unik per toko. Dipakai untuk scan kamera di POS.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Stok Awal</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  placeholder="0 atau 10.000"
                  disabled={isEdit}
                />
                {isEdit && (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Stok diubah via Gudang / Stock Movement
                  </p>
                )}
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_available}
                    onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  <span className="text-sm font-medium text-[var(--foreground)]">Produk aktif</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/org/${baseOrgId}/produk`)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

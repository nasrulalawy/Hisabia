import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

interface ProductUnitRow {
  id: string;
  unit_id: string;
  conversion_to_base: number;
  is_base: boolean;
  units?: { name: string; symbol: string } | null;
}

interface ProductPriceRow {
  id: string;
  unit_id: string | null;
  customer_id: string | null;
  price: number;
  price_type: string;
  units?: { name: string; symbol: string } | null;
  customers?: { name: string } | null;
}

const PRICE_TYPES = [
  { value: "retail", label: "Retail (ecer)" },
  { value: "grosir", label: "Grosir" },
  { value: "grosir_besar", label: "Grosir Besar" },
];

export function ProdukDetailPage() {
  const { orgId, id: productId } = useParams<{ orgId: string; id: string }>();
  const { orgId: ctxOrgId } = useOrg();
  const navigate = useNavigate();
  const baseOrgId = orgId ?? ctxOrgId;

  const [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  const [productUnits, setProductUnits] = useState<ProductUnitRow[]>([]);
  const [productPrices, setProductPrices] = useState<ProductPriceRow[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string; symbol: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitModal, setUnitModal] = useState(false);
  const [priceModal, setPriceModal] = useState(false);
  const [unitForm, setUnitForm] = useState({ unit_id: "", conversion: "1", is_base: false });
  const [priceForm, setPriceForm] = useState({
    unit_id: "",
    price_type: "retail",
    price: "",
    customer_id: "",
  });

  async function fetchData() {
    if (!baseOrgId || !productId) return;
    setLoading(true);
    const [prodRes, puRes, ppRes, unitRes, custRes] = await Promise.all([
      supabase.from("products").select("id, name").eq("id", productId).single(),
      supabase
        .from("product_units")
        .select("id, unit_id, conversion_to_base, is_base, units(name, symbol)")
        .eq("product_id", productId),
      supabase
        .from("product_prices")
        .select("id, unit_id, customer_id, price, price_type, units(name, symbol), customers(name)")
        .eq("product_id", productId),
      supabase.from("units").select("id, name, symbol").eq("organization_id", baseOrgId).order("name"),
      supabase.from("customers").select("id, name").eq("organization_id", baseOrgId).order("name"),
    ]);
    setProduct(prodRes.data ?? null);
    setProductUnits((puRes.data as unknown as ProductUnitRow[]) ?? []);
    setProductPrices((ppRes.data as unknown as ProductPriceRow[]) ?? []);
    setUnits(unitRes.data ?? []);
    setCustomers(custRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [baseOrgId, productId]);

  async function addUnit() {
    if (!productId || !unitForm.unit_id) return;
    const conv = parseFloat(unitForm.conversion) || 1;
    if (unitForm.is_base) {
      await supabase.from("product_units").insert({
        product_id: productId,
        unit_id: unitForm.unit_id,
        conversion_to_base: 1,
        is_base: true,
      });
      await supabase
        .from("product_units")
        .update({ is_base: false })
        .eq("product_id", productId)
        .neq("unit_id", unitForm.unit_id);
    } else {
      await supabase.from("product_units").insert({
        product_id: productId,
        unit_id: unitForm.unit_id,
        conversion_to_base: conv,
        is_base: false,
      });
    }
    setUnitModal(false);
    setUnitForm({ unit_id: "", conversion: "1", is_base: false });
    fetchData();
  }

  async function deleteUnit(id: string) {
    await supabase.from("product_units").delete().eq("id", id);
    fetchData();
  }

  async function addPrice() {
    if (!productId || !priceForm.price) return;
    await supabase.from("product_prices").insert({
      product_id: productId,
      unit_id: priceForm.unit_id || null,
      customer_id: priceForm.customer_id || null,
      price: parseFloat(priceForm.price) || 0,
      price_type: priceForm.price_type,
    });
    setPriceModal(false);
    setPriceForm({ unit_id: "", price_type: "retail", price: "", customer_id: "" });
    fetchData();
  }

  async function deletePrice(id: string) {
    await supabase.from("product_prices").delete().eq("id", id);
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        Produk tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">{product.name}</h2>
          <p className="text-[var(--muted-foreground)]">Multi satuan & multi harga</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/org/${baseOrgId}/produk/${productId as string}/edit`)}>
            Edit Data Dasar
          </Button>
          <Button variant="outline" onClick={() => navigate(`/org/${baseOrgId}/produk`)}>
            Kembali
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Multi Satuan</CardTitle>
          <Button size="sm" onClick={() => setUnitModal(true)}>
            + Tambah Satuan
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            Atur konversi satuan (misal: 1 dus = 12 pcs). Satuan dasar (is_base) dipakai untuk stok.
          </p>
          {productUnits.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">Belum ada multi satuan.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-2 font-medium">Satuan</th>
                  <th className="pb-2 font-medium">Konversi ke Dasar</th>
                  <th className="pb-2 font-medium">Dasar</th>
                  <th className="w-20 pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {productUnits.map((pu) => (
                  <tr key={pu.id} className="border-b border-[var(--border)]">
                    <td className="py-2">{pu.units?.name ?? "-"} ({pu.units?.symbol})</td>
                    <td className="py-2">
                      {pu.is_base ? "1" : `1 ${pu.units?.symbol ?? ""} = ${pu.conversion_to_base} (dasar)`}
                    </td>
                    <td className="py-2">{pu.is_base ? "✓" : "-"}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => deleteUnit(pu.id)}
                        className="text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Multi Harga</CardTitle>
          <Button size="sm" onClick={() => setPriceModal(true)}>
            + Tambah Harga
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            Harga per satuan (pcs/dus/dll), tipe (retail/grosir), atau harga khusus pelanggan.
          </p>
          {productPrices.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">Belum ada multi harga. Pakai Harga Jual default di data produk.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-2 font-medium">Satuan</th>
                  <th className="pb-2 font-medium">Tipe</th>
                  <th className="pb-2 font-medium">Pelanggan</th>
                  <th className="pb-2 font-medium">Harga</th>
                  <th className="w-20 pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {productPrices.map((pp) => (
                  <tr key={pp.id} className="border-b border-[var(--border)]">
                    <td className="py-2">{pp.units ? `${pp.units.name} (${pp.units.symbol})` : "Default"}</td>
                    <td className="py-2">{PRICE_TYPES.find((t) => t.value === pp.price_type)?.label ?? pp.price_type}</td>
                    <td className="py-2">{pp.customers?.name ?? "-"}</td>
                    <td className="py-2 font-medium">{formatIdr(pp.price)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => deletePrice(pp.id)}
                        className="text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Modal open={unitModal} onClose={() => setUnitModal(false)} title="Tambah Satuan">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Satuan *</label>
            <select
              value={unitForm.unit_id}
              onChange={(e) => setUnitForm((f) => ({ ...f, unit_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3"
            >
              <option value="">-- Pilih --</option>
              {units
                .filter((u) => !productUnits.some((pu) => pu.unit_id === u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={unitForm.is_base}
                onChange={(e) => setUnitForm((f) => ({ ...f, is_base: e.target.checked }))}
              />
              Satuan dasar (untuk stok)
            </label>
          </div>
          {!unitForm.is_base && (
            <div>
              <label className="mb-2 block text-sm font-medium">1 satuan ini = ... satuan dasar</label>
              <Input
                type="number"
                min="0.0001"
                step="0.01"
                value={unitForm.conversion}
                onChange={(e) => setUnitForm((f) => ({ ...f, conversion: e.target.value }))}
                placeholder="Contoh: 12 (1 dus = 12 pcs)"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUnitModal(false)}>Batal</Button>
            <Button onClick={addUnit}>Tambah</Button>
          </div>
        </div>
      </Modal>

      <Modal open={priceModal} onClose={() => setPriceModal(false)} title="Tambah Harga" size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Satuan (kosong = default)</label>
            <select
              value={priceForm.unit_id}
              onChange={(e) => setPriceForm((f) => ({ ...f, unit_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3"
            >
              <option value="">Default / Satuan dasar</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Tipe Harga</label>
            <select
              value={priceForm.price_type}
              onChange={(e) => setPriceForm((f) => ({ ...f, price_type: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3"
            >
              {PRICE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Pelanggan (kosong = harga umum)</label>
            <select
              value={priceForm.customer_id}
              onChange={(e) => setPriceForm((f) => ({ ...f, customer_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3"
            >
              <option value="">-- Umum --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Harga (Rp) *</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={priceForm.price}
              onChange={(e) => setPriceForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPriceModal(false)}>Batal</Button>
            <Button onClick={addPrice}>Tambah</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

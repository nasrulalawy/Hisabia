import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, parsePriceIdr } from "@/lib/utils";
import { printLabelNiimbot } from "@/lib/niimbot";
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

interface ProductIngredientRow {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredients?: { name: string; cost_per_unit: number; units?: { symbol: string } | null } | null;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  name: string;
  selling_price: number | null;
  cost_price: number | null;
  price_type: "replace" | "addon";
  show_on_label: boolean;
  sort_order: number;
  is_available: boolean;
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

  const [product, setProduct] = useState<{
    id: string;
    name: string;
    cost_price?: number;
    stock?: number;
    selling_price?: number;
    barcode?: string | null;
    use_ingredients_for_cost?: boolean;
  } | null>(null);
  const [productUnits, setProductUnits] = useState<ProductUnitRow[]>([]);
  const [productPrices, setProductPrices] = useState<ProductPriceRow[]>([]);
  const [productIngredients, setProductIngredients] = useState<ProductIngredientRow[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariantRow[]>([]);
  const [ingredients, setIngredients] = useState<{ id: string; name: string; units?: { symbol: string } | null }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string; symbol: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitModal, setUnitModal] = useState(false);
  const [priceModal, setPriceModal] = useState(false);
  const [ingredientModal, setIngredientModal] = useState(false);
  const [variantModal, setVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariantRow | null>(null);
  const [niimbotPrinting, setNiimbotPrinting] = useState(false);
  const [unitForm, setUnitForm] = useState({ unit_id: "", conversion: "1", is_base: false });
  const [priceForm, setPriceForm] = useState({
    unit_id: "",
    price_type: "retail",
    price: "",
    customer_id: "",
  });
  const [ingredientForm, setIngredientForm] = useState({ ingredient_id: "", quantity: "1" });
  const [variantForm, setVariantForm] = useState({
    name: "",
    selling_price: "",
    cost_price: "",
    price_type: "replace" as "replace" | "addon",
    show_on_label: true,
    is_available: true,
  });
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelSelections, setLabelSelections] = useState<{ product: boolean; variantIds: Set<string> }>({ product: true, variantIds: new Set() });

  async function fetchData() {
    if (!baseOrgId || !productId) return;
    setLoading(true);
    const [prodRes, puRes, ppRes, piRes, ingRes, unitRes, custRes] = await Promise.all([
      supabase.from("products").select("id, name, cost_price, stock, selling_price, barcode, use_ingredients_for_cost").eq("id", productId).single(),
      supabase
        .from("product_units")
        .select("id, unit_id, conversion_to_base, is_base, units(name, symbol)")
        .eq("product_id", productId),
      supabase
        .from("product_prices")
        .select("id, unit_id, customer_id, price, price_type, units(name, symbol), customers(name)")
        .eq("product_id", productId),
      supabase
        .from("product_ingredients")
        .select("id, product_id, ingredient_id, quantity, ingredients(name, cost_per_unit, units(symbol))")
        .eq("product_id", productId),
      supabase.from("ingredients").select("id, name, units(symbol)").eq("organization_id", baseOrgId).order("name"),
      supabase.from("units").select("id, name, symbol").eq("organization_id", baseOrgId).order("name"),
      supabase.from("customers").select("id, name").eq("organization_id", baseOrgId).order("name"),
    ]);
    setProduct(prodRes.data ?? null);
    setProductUnits((puRes.data as unknown as ProductUnitRow[]) ?? []);
    setProductPrices((ppRes.data as unknown as ProductPriceRow[]) ?? []);
    setProductIngredients((piRes.data as unknown as ProductIngredientRow[]) ?? []);
    setIngredients((ingRes.data as unknown as { id: string; name: string; units?: { symbol: string } | null }[]) ?? []);
    setUnits(unitRes.data ?? []);
    setCustomers(custRes.data ?? []);

    const pvResFull = await supabase
      .from("product_variants")
      .select("id, product_id, name, selling_price, cost_price, price_type, show_on_label, sort_order, is_available")
      .eq("product_id", productId)
      .order("sort_order");
    if (pvResFull.error) {
      const pvResBase = await supabase
        .from("product_variants")
        .select("id, product_id, name, selling_price, cost_price, sort_order, is_available")
        .eq("product_id", productId)
        .order("sort_order");
      const rows = (pvResBase.data ?? []) as ProductVariantRow[];
      setProductVariants(rows.map((r) => ({ ...r, price_type: "replace" as const, show_on_label: true })));
    } else {
      setProductVariants((pvResFull.data as unknown as ProductVariantRow[]) ?? []);
    }
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
      price: parsePriceIdr(priceForm.price) || 0,
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

  async function toggleUseIngredientsForCost() {
    if (!productId || !product) return;
    const next = !product.use_ingredients_for_cost;
    await supabase.from("products").update({ use_ingredients_for_cost: next, updated_at: new Date().toISOString() }).eq("id", productId);
    fetchData();
  }

  async function addProductIngredient() {
    if (!productId || !ingredientForm.ingredient_id) return;
    const qty = parseFloat(ingredientForm.quantity.replace(",", ".")) || 1;
    await supabase.from("product_ingredients").insert({ product_id: productId, ingredient_id: ingredientForm.ingredient_id, quantity: qty });
    setIngredientModal(false);
    setIngredientForm({ ingredient_id: "", quantity: "1" });
    fetchData();
  }

  async function deleteProductIngredient(id: string) {
    await supabase.from("product_ingredients").delete().eq("id", id);
    fetchData();
  }

  function openAddVariant() {
    setEditingVariant(null);
    setVariantForm({ name: "", selling_price: "", cost_price: "", price_type: "replace", show_on_label: true, is_available: true });
    setVariantModal(true);
  }

  function openEditVariant(v: ProductVariantRow) {
    setEditingVariant(v);
    setVariantForm({
      name: v.name,
      selling_price: v.selling_price != null ? String(v.selling_price) : "",
      cost_price: v.cost_price != null ? String(v.cost_price) : "",
      price_type: v.price_type ?? "replace",
      show_on_label: v.show_on_label ?? true,
      is_available: v.is_available,
    });
    setVariantModal(true);
  }

  async function saveVariant() {
    if (!productId || !variantForm.name.trim()) return;
    const selling = variantForm.selling_price ? parsePriceIdr(variantForm.selling_price) : null;
    const cost = variantForm.cost_price ? parsePriceIdr(variantForm.cost_price) : null;
    const priceType = variantForm.price_type || "replace";
    const showOnLabel = variantForm.show_on_label ?? true;
    const basePayload = {
      name: variantForm.name.trim(),
      selling_price: selling,
      cost_price: cost,
      is_available: variantForm.is_available,
    };
    if (editingVariant) {
      let err = await supabase
        .from("product_variants")
        .update({ ...basePayload, price_type: priceType, show_on_label: showOnLabel, updated_at: new Date().toISOString() })
        .eq("id", editingVariant.id);
      if (err.error) {
        await supabase.from("product_variants").update({ ...basePayload, updated_at: new Date().toISOString() }).eq("id", editingVariant.id);
      }
    } else {
      let err = await supabase.from("product_variants").insert({
        product_id: productId,
        ...basePayload,
        price_type: priceType,
        show_on_label: showOnLabel,
        sort_order: productVariants.length,
      });
      if (err.error) {
        await supabase.from("product_variants").insert({
          product_id: productId,
          ...basePayload,
          sort_order: productVariants.length,
        });
      }
    }
    setVariantModal(false);
    setEditingVariant(null);
    fetchData();
  }

  async function deleteVariant(id: string) {
    await supabase.from("product_variants").delete().eq("id", id);
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/org/${baseOrgId}/produk/${productId as string}/edit`)}>
            Edit Data Dasar
          </Button>
          <Button
            variant="outline"
            disabled={niimbotPrinting || !("bluetooth" in navigator && navigator.bluetooth)}
            onClick={() => {
              setLabelSelections({
                product: true,
                variantIds: new Set(productVariants.filter((v) => v.show_on_label !== false).map((v) => v.id)),
              });
              setLabelModalOpen(true);
            }}
          >
            {niimbotPrinting ? "Mencetak..." : "Cetak label NiiMBot"}
          </Button>
          <Button variant="outline" onClick={() => navigate(`/org/${baseOrgId}/produk`)}>
            Kembali
          </Button>
        </div>
      </div>

      {typeof product.cost_price === "number" && typeof product.stock === "number" && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Total Harga Modal: <span className="font-semibold text-[var(--foreground)]">{formatIdr(Number(product.cost_price) * Number(product.stock))}</span>
          {" "}(HPP × stok)
        </p>
      )}

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Resep (Bahan)</CardTitle>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!product?.use_ingredients_for_cost}
                onChange={toggleUseIngredientsForCost}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              HPP dari resep
            </label>
            <Button size="sm" onClick={() => setIngredientModal(true)}>
              + Tambah Bahan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            Lampirkan bahan (ingredients) untuk hitung HPP otomatis. Aktifkan &quot;HPP dari resep&quot; agar cost_price produk mengikuti total biaya bahan.
          </p>
          {productIngredients.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">Belum ada bahan. Klik Tambah Bahan dan pilih dari master Bahan.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">Bahan</th>
                    <th className="pb-2 font-medium">Jumlah</th>
                    <th className="pb-2 font-medium">Subtotal HPP</th>
                    <th className="w-20 pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {productIngredients.map((pi) => {
                    const cost = (pi.ingredients?.cost_per_unit ?? 0) * pi.quantity;
                    return (
                      <tr key={pi.id} className="border-b border-[var(--border)]">
                        <td className="py-2">{pi.ingredients?.name ?? "-"}</td>
                        <td className="py-2">
                          {pi.quantity} {pi.ingredients?.units?.symbol ?? ""}
                        </td>
                        <td className="py-2">{formatIdr(cost)}</td>
                        <td className="py-2">
                          <button type="button" onClick={() => deleteProductIngredient(pi.id)} className="text-red-600 hover:underline">
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {product?.use_ingredients_for_cost && (
                <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                  Total HPP (dari resep): {formatIdr(product.cost_price ?? 0)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Variant</CardTitle>
          <Button size="sm" onClick={openAddVariant}>
            + Tambah Variant
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            Variant produk (mis. Reguler, Less Sugar). Harga jual bisa ganti total atau add-on. HPP selalu tambahan (bisa + atau −).
          </p>
          {productVariants.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">Belum ada variant.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="pb-2 font-medium">Nama</th>
                  <th className="pb-2 font-medium">Jenis Harga</th>
                  <th className="pb-2 font-medium">Harga Jual</th>
                  <th className="pb-2 font-medium">Tambahan HPP</th>
                  <th className="pb-2 font-medium">Aktif</th>
                  <th className="pb-2 font-medium">Di label</th>
                  <th className="w-24 pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {productVariants.map((pv) => (
                  <tr key={pv.id} className="border-b border-[var(--border)]">
                    <td className="py-2">{pv.name}</td>
                    <td className="py-2">{(pv.price_type ?? "replace") === "addon" ? "Add-on" : "Ganti total"}</td>
                    <td className="py-2">
                      {(pv.price_type ?? "replace") === "addon"
                        ? (pv.selling_price != null ? `+ ${formatIdr(pv.selling_price)}` : "Default")
                        : (pv.selling_price != null ? formatIdr(pv.selling_price) : "Default")}
                    </td>
                    <td className="py-2">
                      {pv.cost_price != null
                        ? (pv.cost_price >= 0 ? `+ ${formatIdr(pv.cost_price)}` : `− ${formatIdr(-pv.cost_price)}`)
                        : "0"}
                    </td>
                    <td className="py-2">{pv.is_available ? "Ya" : "Tidak"}</td>
                    <td className="py-2">{pv.show_on_label !== false ? "Ya" : "Tidak"}</td>
                    <td className="py-2">
                      <button type="button" onClick={() => openEditVariant(pv)} className="mr-2 text-[var(--primary)] hover:underline">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteVariant(pv.id)} className="text-red-600 hover:underline">
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

      <Modal open={ingredientModal} onClose={() => setIngredientModal(false)} title="Tambah Bahan ke Resep">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Bahan *</label>
            <select
              value={ingredientForm.ingredient_id}
              onChange={(e) => setIngredientForm((f) => ({ ...f, ingredient_id: e.target.value }))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3"
            >
              <option value="">-- Pilih Bahan --</option>
              {ingredients
                .filter((i) => !productIngredients.some((pi) => pi.ingredient_id === i.id))
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.units?.symbol ?? ""})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Jumlah (dalam satuan bahan) *</label>
            <Input
              type="text"
              inputMode="decimal"
              value={ingredientForm.quantity}
              onChange={(e) => setIngredientForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIngredientModal(false)}>Batal</Button>
            <Button onClick={addProductIngredient}>Tambah</Button>
          </div>
        </div>
      </Modal>

      <Modal open={variantModal} onClose={() => { setVariantModal(false); setEditingVariant(null); }} title={editingVariant ? "Edit Variant" : "Tambah Variant"}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Nama variant *</label>
            <Input
              value={variantForm.name}
              onChange={(e) => setVariantForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Reguler, Less Sugar"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Jenis harga jual</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="price_type"
                  checked={variantForm.price_type === "replace"}
                  onChange={() => setVariantForm((f) => ({ ...f, price_type: "replace" }))}
                  className="h-4 w-4 border-[var(--border)]"
                />
                <span className="text-sm">Ganti total</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="price_type"
                  checked={variantForm.price_type === "addon"}
                  onChange={() => setVariantForm((f) => ({ ...f, price_type: "addon" }))}
                  className="h-4 w-4 border-[var(--border)]"
                />
                <span className="text-sm">Add-on (tambahan)</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {variantForm.price_type === "replace"
                ? "Harga jual variant menggantikan harga dasar produk."
                : "Nilai ditambah ke harga dasar produk (mis. + Rp 5.000)."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {variantForm.price_type === "addon" ? "Tambahan harga (Rp)" : "Harga jual (kosong = pakai dari produk)"}
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={variantForm.selling_price}
                onChange={(e) => setVariantForm((f) => ({ ...f, selling_price: e.target.value }))}
                placeholder={variantForm.price_type === "addon" ? "0" : "Opsional"}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Tambahan HPP (bisa negatif, kosong = 0)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={variantForm.cost_price}
                onChange={(e) => setVariantForm((f) => ({ ...f, cost_price: e.target.value }))}
                placeholder="Contoh: 2000 atau -1000"
              />
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Ditambah ke HPP produk. Isi negatif (mis. -1000) untuk pengurangan.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={variantForm.is_available}
                onChange={(e) => setVariantForm((f) => ({ ...f, is_available: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm">Variant aktif</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={variantForm.show_on_label}
                onChange={(e) => setVariantForm((f) => ({ ...f, show_on_label: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm">Tampil di label (cetak NiiMBot)</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setVariantModal(false); setEditingVariant(null); }}>Batal</Button>
            <Button onClick={saveVariant}>{editingVariant ? "Simpan" : "Tambah"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={labelModalOpen} onClose={() => setLabelModalOpen(false)} title="Cetak label NiiMBot" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Pilih yang akan dicetak. Variant yang &quot;Tampil di label&quot; muncul di sini.
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={labelSelections.product}
                onChange={(e) => setLabelSelections((s) => ({ ...s, product: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm">{product?.name ?? "Produk"} (harga default)</span>
            </label>
            {productVariants
              .filter((v) => v.show_on_label !== false)
              .map((pv) => {
                const effectivePrice =
                  (pv.price_type ?? "replace") === "addon"
                    ? (product?.selling_price ?? 0) + (pv.selling_price ?? 0)
                    : (pv.selling_price ?? product?.selling_price ?? 0);
                return (
                  <label key={pv.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={labelSelections.variantIds.has(pv.id)}
                      onChange={(e) => {
                        setLabelSelections((s) => {
                          const next = new Set(s.variantIds);
                          if (e.target.checked) next.add(pv.id);
                          else next.delete(pv.id);
                          return { ...s, variantIds: next };
                        });
                      }}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    <span className="text-sm">
                      {product?.name} – {pv.name} ({formatIdr(effectivePrice)})
                    </span>
                  </label>
                );
              })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLabelModalOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                niimbotPrinting ||
                (!labelSelections.product && labelSelections.variantIds.size === 0)
              }
              onClick={async () => {
                if (!product) return;
                setNiimbotPrinting(true);
                try {
                  if (labelSelections.product) {
                    await printLabelNiimbot({
                      name: product.name ?? "",
                      barcode: product.barcode ?? undefined,
                      price: product.selling_price,
                      sku: product.id,
                      stock: product.stock,
                    });
                  }
                  for (const variantId of labelSelections.variantIds) {
                    const pv = productVariants.find((v) => v.id === variantId);
                    if (!pv) continue;
                    const effectivePrice =
                      (pv.price_type ?? "replace") === "addon"
                        ? (product.selling_price ?? 0) + (pv.selling_price ?? 0)
                        : (pv.selling_price ?? product.selling_price ?? 0);
                    await printLabelNiimbot({
                      name: `${product.name} – ${pv.name}`,
                      barcode: product.barcode ?? undefined,
                      price: effectivePrice,
                      sku: product.id,
                      stock: product.stock,
                    });
                  }
                  setLabelModalOpen(false);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Gagal cetak label NiiMBot");
                } finally {
                  setNiimbotPrinting(false);
                }
              }}
            >
              {niimbotPrinting ? "Mencetak..." : "Cetak"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

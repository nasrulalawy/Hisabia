import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { parsePriceIdr } from "@/lib/utils";

export function FixedAssetFormPage() {
  const { id: assetId } = useParams<{ id: string }>();
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const isEdit = !!assetId;

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_value: "0",
    residual_value: "0",
    useful_life_months: "12",
    account_asset_code: "1-4",
    account_accumulated_code: "1-5",
    account_expense_code: "5-3",
    status: "active" as "active" | "sold" | "disposed",
    notes: "",
  });

  async function ensureCoa() {
    if (!orgId) return;
    const { data: existing } = await supabase
      .from("chart_of_accounts")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1);
    if (!existing?.length) {
      await supabase.rpc("seed_chart_of_accounts", { p_org_id: orgId });
    }
  }

  async function fetchAsset() {
    if (!assetId || !orgId) return;
    const { data, error: err } = await supabase
      .from("fixed_assets")
      .select("*")
      .eq("id", assetId)
      .eq("organization_id", orgId)
      .single();
    if (err || !data) {
      setError(err?.message ?? "Aset tidak ditemukan");
      setLoading(false);
      return;
    }
    const fmt = (n: number | string) => {
      const x = Number(n);
      return isNaN(x) || x % 1 === 0 ? String(Math.round(x)) : String(x);
    };
    setForm({
      code: data.code,
      name: data.name,
      purchase_date: (data.purchase_date as string).slice(0, 10),
      purchase_value: fmt(data.purchase_value ?? 0),
      residual_value: fmt(data.residual_value ?? 0),
      useful_life_months: String(data.useful_life_months ?? 12),
      account_asset_code: data.account_asset_code ?? "1-4",
      account_accumulated_code: data.account_accumulated_code ?? "1-5",
      account_expense_code: data.account_expense_code ?? "5-3",
      status: data.status ?? "active",
      notes: data.notes ?? "",
    });
    setLoading(false);
  }

  useEffect(() => {
    if (!orgId) return;
    if (isEdit) {
      fetchAsset();
    } else {
      ensureCoa().then(() => setLoading(false));
    }
  }, [orgId, assetId, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !form.code.trim() || !form.name.trim()) return;
    const purchaseValue = parsePriceIdr(form.purchase_value) ?? 0;
    const residualValue = parsePriceIdr(form.residual_value) ?? 0;
    const usefulLife = parseInt(form.useful_life_months, 10) || 12;
    if (usefulLife <= 0) {
      setError("Umur ekonomis (bulan) harus positif.");
      return;
    }
    setSubmitLoading(true);
    setError(null);
    const payload = {
      organization_id: orgId,
      code: form.code.trim(),
      name: form.name.trim(),
      purchase_date: form.purchase_date,
      purchase_value: purchaseValue,
      residual_value: residualValue,
      useful_life_months: usefulLife,
      account_asset_code: form.account_asset_code.trim() || "1-4",
      account_accumulated_code: form.account_accumulated_code.trim() || "1-5",
      account_expense_code: form.account_expense_code.trim() || "5-3",
      status: form.status,
      notes: form.notes.trim() || null,
    };
    if (isEdit && assetId) {
      const { error: err } = await supabase
        .from("fixed_assets")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", assetId)
        .eq("organization_id", orgId);
      if (err) setError(err.message);
      else navigate("../", { relative: "path" });
    } else {
      const { error: err } = await supabase.from("fixed_assets").insert(payload);
      if (err) setError(err.message);
      else navigate("../", { relative: "path" });
    }
    setSubmitLoading(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          {isEdit ? "Edit Aset Tetap" : "Tambah Aset Tetap"}
        </h2>
        <p className="text-[var(--muted-foreground)]">
          {isEdit ? "Ubah data aset tetap." : "Daftarkan aset tetap untuk penyusutan bulanan."}
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Data Aset</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Kode *</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="AT-001"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nama *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Laptop Kantor"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Tanggal Beli *</label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nilai Perolehan (Rp) *</label>
                <Input
                  value={form.purchase_value}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_value: e.target.value }))}
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Nilai Sisa (Rp)</label>
                <Input
                  value={form.residual_value}
                  onChange={(e) => setForm((f) => ({ ...f, residual_value: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Umur Ekonomis (bulan) *</label>
                <Input
                  type="number"
                  min={1}
                  value={form.useful_life_months}
                  onChange={(e) => setForm((f) => ({ ...f, useful_life_months: e.target.value }))}
                  placeholder="12"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Akun Aset (kode)</label>
                <Input
                  value={form.account_asset_code}
                  onChange={(e) => setForm((f) => ({ ...f, account_asset_code: e.target.value }))}
                  placeholder="1-4"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Akun Akumulasi (kode)</label>
                <Input
                  value={form.account_accumulated_code}
                  onChange={(e) => setForm((f) => ({ ...f, account_accumulated_code: e.target.value }))}
                  placeholder="1-5"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Akun Beban (kode)</label>
                <Input
                  value={form.account_expense_code}
                  onChange={(e) => setForm((f) => ({ ...f, account_expense_code: e.target.value }))}
                  placeholder="5-3"
                />
              </div>
            </div>
            {isEdit && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "sold" | "disposed" }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="active">Aktif</option>
                  <option value="sold">Dijual</option>
                  <option value="disposed">Dibuang</option>
                </select>
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Catatan</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Catatan tambahan"
                rows={2}
                className="h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("../", { relative: "path" })}>
                Batal
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

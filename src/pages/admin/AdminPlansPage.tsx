import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { SubscriptionPlan } from "@/lib/database.types";
import {
  OUTLET_FEATURE_LIST,
  type OutletFeatureKey,
  type OutletFeaturePermission,
} from "@/lib/outletFeatures";

type PlanForm = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number | "";
  outlet_limit: number;
  member_limit: number;
  features: string[];
  featurePermissions: Record<string, OutletFeaturePermission>;
  show_on_landing: boolean;
  sort_order: number;
  is_addon: boolean;
  addon_feature_keys: string[];
};

const emptyPlanForm: PlanForm = {
  name: "",
  slug: "",
  description: "",
  price_monthly: 0,
  price_yearly: "",
  outlet_limit: 1,
  member_limit: 2,
  features: [],
  featurePermissions: {},
  show_on_landing: true,
  sort_order: 0,
  is_addon: false,
  addon_feature_keys: [],
};

export function AdminPlansPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planDeletingId, setPlanDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setPlans((data ?? []) as SubscriptionPlan[]);
        setLoading(false);
      });
  }, []);

  function slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function openPlanForm(plan?: SubscriptionPlan) {
    if (plan) {
      const feat = plan.features;
      const features = Array.isArray(feat) ? (feat as string[]) : [];
      const rawPlanPerms = (plan as SubscriptionPlan & { feature_permissions?: Record<string, OutletFeaturePermission> | null })
        .feature_permissions;
      const featurePermissions: Record<string, OutletFeaturePermission> = rawPlanPerms ?? {};
      const planAddon = plan as SubscriptionPlan & { is_addon?: boolean; addon_feature_key?: string | null; addon_feature_keys?: string[] | null };
      const addonKeys =
        Array.isArray(planAddon.addon_feature_keys) && planAddon.addon_feature_keys.length > 0
          ? planAddon.addon_feature_keys
          : planAddon.addon_feature_key
            ? [planAddon.addon_feature_key]
            : [];
      setPlanForm({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description ?? "",
        price_monthly: plan.price_monthly ?? 0,
        price_yearly: plan.price_yearly ?? "",
        outlet_limit: plan.outlet_limit ?? 1,
        member_limit: plan.member_limit ?? 2,
        features,
        featurePermissions,
        show_on_landing: plan.show_on_landing ?? true,
        sort_order: plan.sort_order ?? 0,
        is_addon: planAddon.is_addon ?? false,
        addon_feature_keys: addonKeys,
      });
    } else {
      setPlanForm(emptyPlanForm);
    }
    setPlanModalOpen(true);
  }

  function closePlanForm() {
    setPlanModalOpen(false);
    setPlanForm(emptyPlanForm);
  }

  async function savePlanForm() {
    setPlanSaving(true);
    const isAddon = planForm.is_addon;
    const addonFeatureLabels = planForm.addon_feature_keys.length
      ? planForm.addon_feature_keys.map((key) => OUTLET_FEATURE_LIST.find((f) => f.key === key)?.label ?? key)
      : [];
    const payload = {
      name: planForm.name.trim(),
      slug: (planForm.slug || slugify(planForm.name)).trim() || "plan",
      description: planForm.description.trim() || null,
      price_monthly: Math.max(0, planForm.price_monthly),
      price_yearly: planForm.price_yearly === "" ? null : Math.max(0, Number(planForm.price_yearly)),
      outlet_limit: Math.max(1, planForm.outlet_limit),
      member_limit: Math.max(1, planForm.member_limit),
      features: isAddon ? addonFeatureLabels : planForm.features.filter((f) => f.trim()).length ? planForm.features : [],
      feature_permissions: isAddon ? {} : planForm.featurePermissions,
      show_on_landing: planForm.show_on_landing,
      sort_order: planForm.sort_order,
      is_addon: planForm.is_addon,
      addon_feature_keys: isAddon ? planForm.addon_feature_keys : null,
    };
    const sortPlans = (list: SubscriptionPlan[]) => [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (planForm.id) {
      const { error: err } = await supabase.from("subscription_plans").update(payload).eq("id", planForm.id);
      if (err) setError(err.message);
      else {
        setError(null);
        setPlans((prev) => sortPlans(prev.map((p) => (p.id === planForm.id ? { ...p, ...payload } : p))));
        closePlanForm();
      }
    } else {
      const { data, error: err } = await supabase.from("subscription_plans").insert(payload).select("id").single();
      if (err) setError(err.message);
      else if (data) {
        setError(null);
        setPlans((prev) => sortPlans([...prev, { ...payload, id: data.id, created_at: "", updated_at: "" }]));
        closePlanForm();
      }
    }
    setPlanSaving(false);
  }

  async function deletePlan(id: string) {
    if (!confirm("Hapus paket ini? Organisasi yang memakai paket ini bisa terganggu.")) return;
    setPlanDeletingId(id);
    const { error: err } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (err) setError(err.message);
    else setPlans((prev) => prev.filter((p) => p.id !== id));
    setPlanDeletingId(null);
  }

  function getPlanFeaturePerm(key: OutletFeatureKey): OutletFeaturePermission {
    return (
      planForm.featurePermissions[key] ?? {
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
      }
    );
  }

  function setPlanFeaturePerm(key: OutletFeatureKey, field: keyof OutletFeaturePermission, value: boolean) {
    setPlanForm((prev) => {
      const current =
        prev.featurePermissions[key] ?? {
          can_create: true,
          can_read: true,
          can_update: true,
          can_delete: true,
        };
      return {
        ...prev,
        featurePermissions: {
          ...prev.featurePermissions,
          [key]: { ...current, [field]: value },
        },
      };
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Paket Langganan</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Kelola paket subscription. Paket yang &quot;Tampil di landing&quot; akan muncul di section Harga di halaman beranda.
        </p>
      </div>

      <Card className="border-[var(--border)]">
        <CardHeader>
          <CardTitle>Paket Langganan</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Paket addon harganya ditambahkan ke paket utama per bulan per organisasi.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => openPlanForm()}>Tambah Paket</Button>
          </div>
          {plans.length === 0 ? (
            <p className="py-6 text-center text-[var(--muted-foreground)]">Belum ada paket. Klik Tambah Paket.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">Nama</th>
                    <th className="pb-2 font-medium">Slug</th>
                    <th className="pb-2 font-medium">Harga/bulan</th>
                    <th className="pb-2 font-medium">Outlet</th>
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Landing</th>
                    <th className="pb-2 font-medium">Urutan</th>
                    <th className="pb-2 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 font-medium">
                        {p.name}
                        {(p as SubscriptionPlan & { is_addon?: boolean }).is_addon && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Addon</span>
                        )}
                      </td>
                      <td className="py-2 font-mono text-xs">{p.slug}</td>
                      <td className="py-2">{formatIdr(p.price_monthly)}</td>
                      <td className="py-2">{p.outlet_limit}</td>
                      <td className="py-2">{p.member_limit}</td>
                      <td className="py-2">{p.show_on_landing ? "Ya" : "Tidak"}</td>
                      <td className="py-2">{p.sort_order ?? 0}</td>
                      <td className="py-2">
                        <Button size="sm" variant="outline" onClick={() => openPlanForm(p)} className="mr-2">
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={planDeletingId === p.id}
                          onClick={() => deletePlan(p.id)}
                        >
                          {planDeletingId === p.id ? "..." : "Hapus"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={planModalOpen}
        onClose={closePlanForm}
        title={planForm.id ? "Edit Paket" : "Tambah Paket"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Nama paket</label>
            <input
              type="text"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={planForm.name}
              onChange={(e) => {
                setPlanForm((prev) => ({ ...prev, name: e.target.value }));
                if (!planForm.id) setPlanForm((prev) => ({ ...prev, slug: slugify(e.target.value) }));
              }}
              placeholder="Contoh: Pro"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Slug (untuk URL)</label>
            <input
              type="text"
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
              value={planForm.slug}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="pro"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Deskripsi</label>
            <textarea
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              rows={2}
              value={planForm.description}
              onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Hingga 3 outlet, 5 user..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Harga per bulan (Rp)</label>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={planForm.price_monthly || ""}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, price_monthly: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Harga per tahun (Rp, opsional)</label>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={planForm.price_yearly === "" ? "" : planForm.price_yearly}
                onChange={(e) => {
                  const v = e.target.value;
                  setPlanForm((prev) => ({ ...prev, price_yearly: v === "" ? "" : Number(v) || 0 }));
                }}
                placeholder="Kosongkan = bulanan × 12"
              />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Limit outlet</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={planForm.outlet_limit}
                  onChange={(e) =>
                    setPlanForm((prev) => ({ ...prev, outlet_limit: Math.max(1, Number(e.target.value) || 1) }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Limit member</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={planForm.member_limit}
                  onChange={(e) =>
                    setPlanForm((prev) => ({ ...prev, member_limit: Math.max(1, Number(e.target.value) || 1) }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={planForm.is_addon}
                onChange={(e) =>
                  setPlanForm((prev) => ({
                    ...prev,
                    is_addon: e.target.checked,
                    addon_feature_keys: e.target.checked ? prev.addon_feature_keys : [],
                  }))
                }
              />
              <span className="text-sm">Paket addon (harga ditambahkan ke paket utama per bulan)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={planForm.show_on_landing}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, show_on_landing: e.target.checked }))}
              />
              <span className="text-sm">Tampil di landing page (section Harga)</span>
            </label>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Urutan tampilan</label>
              <input
                type="number"
                min={0}
                className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={planForm.sort_order}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          {planForm.is_addon ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Fitur addon</label>
              <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                Centang fitur yang dibuka oleh addon ini (bisa lebih dari satu).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {OUTLET_FEATURE_LIST.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={planForm.addon_feature_keys.includes(key)}
                      onChange={(e) => {
                        setPlanForm((prev) => {
                          const next = e.target.checked
                            ? [...prev.addon_feature_keys, key]
                            : prev.addon_feature_keys.filter((k) => k !== key);
                          return { ...prev, addon_feature_keys: next };
                        });
                      }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                  Fitur paket (tampil di landing & batasan fitur)
                </label>
                <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                  Centang fitur yang termasuk dalam paket ini. Dipakai untuk informasi di landing page dan pembatasan
                  fitur per outlet.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OUTLET_FEATURE_LIST.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={planForm.features.includes(label)}
                        onChange={(e) => {
                          setPlanForm((prev) => {
                            const has = prev.features.includes(label);
                            const nextFeatures = e.target.checked
                              ? has
                                ? prev.features
                                : [...prev.features, label]
                              : prev.features.filter((f) => f !== label);
                            return { ...prev, features: nextFeatures };
                          });
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                  CRUD fitur per paket (opsional)
                </label>
                <p className="mb-2 text-xs text-[var(--muted-foreground)]">
                  Default Create / Read / Update / Delete per fitur untuk paket ini (referensi).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                        <th className="pb-2 font-medium">Fitur</th>
                        <th className="pb-2 text-center font-medium">Create</th>
                        <th className="pb-2 text-center font-medium">Read</th>
                        <th className="pb-2 text-center font-medium">Update</th>
                        <th className="pb-2 text-center font-medium">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OUTLET_FEATURE_LIST.map(({ key, label }) => (
                        <tr key={key} className="border-b border-[var(--border)] last:border-0">
                          <td className="py-2 font-medium">{label}</td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getPlanFeaturePerm(key).can_create}
                              onChange={(e) => setPlanFeaturePerm(key, "can_create", e.target.checked)}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getPlanFeaturePerm(key).can_read}
                              onChange={(e) => setPlanFeaturePerm(key, "can_read", e.target.checked)}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getPlanFeaturePerm(key).can_update}
                              onChange={(e) => setPlanFeaturePerm(key, "can_update", e.target.checked)}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={getPlanFeaturePerm(key).can_delete}
                              onChange={(e) => setPlanFeaturePerm(key, "can_delete", e.target.checked)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closePlanForm}>
              Batal
            </Button>
            <Button
              disabled={
                planSaving ||
                !planForm.name.trim() ||
                (planForm.is_addon && planForm.addon_feature_keys.length === 0)
              }
              onClick={savePlanForm}
            >
              {planSaving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SubscriptionPlan } from "@/lib/database.types";
import {
  OUTLET_FEATURE_LIST,
  type OutletFeatureKey,
  type OutletFeaturePermission,
} from "@/lib/outletFeatures";

interface AdminStats {
  orgCount: number;
  userCount: number;
  activeSubscriptions: number;
  ordersToday: number;
  revenueMonth: number;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  outlet_count: number;
  sub_status: string | null;
  plan_name: string | null;
  plan_id: string | null;
}

interface AdminOutletRow {
  id: string;
  name: string;
  outlet_type: string;
  is_default: boolean;
  created_at: string;
}

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [planSelect, setPlanSelect] = useState<Record<string, string>>({});

  // Fitur per outlet (super admin)
  const [featureOrgId, setFeatureOrgId] = useState<string>("");
  const [adminOutlets, setAdminOutlets] = useState<AdminOutletRow[]>([]);
  const [featureOutletId, setFeatureOutletId] = useState<string>("");
  const [featurePerms, setFeaturePerms] = useState<Record<string, OutletFeaturePermission>>({});
  const [featurePermsLoading, setFeaturePermsLoading] = useState(false);
  const [featurePermsSaving, setFeaturePermsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [statsRes, orgsRes, plansRes] = await Promise.all([
        supabase.rpc("get_admin_stats"),
        supabase.rpc("get_admin_organizations"),
        supabase.from("subscription_plans").select("*").order("price_monthly"),
      ]);
      const statsData = statsRes.data as { error?: string } & AdminStats | null;
      const orgsData = orgsRes.data as { error?: string } | OrgRow[] | null;

      if (statsData?.error) {
        setError(statsData.error);
        setLoading(false);
        return;
      }
      if (Array.isArray(orgsData)) {
        setOrgs(orgsData);
        const initial: Record<string, string> = {};
        orgsData.forEach((o: OrgRow) => {
          initial[o.id] = o.plan_id ?? (plansRes.data?.[0]?.id ?? "");
        });
        setPlanSelect(initial);
      } else if (orgsData && typeof orgsData === "object" && "error" in orgsData) {
        setError((orgsData as { error?: string }).error ?? "Gagal memuat organisasi");
      }
      if (plansRes.data) setPlans(plansRes.data);
      if (statsData && !statsData.error) {
        setStats({
          orgCount: statsData.orgCount ?? 0,
          userCount: statsData.userCount ?? 0,
          activeSubscriptions: statsData.activeSubscriptions ?? 0,
          ordersToday: statsData.ordersToday ?? 0,
          revenueMonth: statsData.revenueMonth ?? 0,
        });
      }
      setLoading(false);
    })();
  }, []);

  async function handleSetPlan(orgId: string, planId: string) {
    setSavingOrgId(orgId);
    const { data } = await supabase.rpc("admin_set_org_plan", {
      p_org_id: orgId,
      p_plan_id: planId,
    });
    const res = data as { error?: string; success?: boolean } | null;
    setSavingOrgId(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    if (res?.success) {
      setOrgs((prev) =>
        prev.map((o) => {
          if (o.id !== orgId) return o;
          const plan = plans.find((p) => p.id === planId);
          return { ...o, plan_id: planId, plan_name: plan?.name ?? null, sub_status: "active" };
        })
      );
      setPlanSelect((prev) => ({ ...prev, [orgId]: planId }));
    }
  }

  // Load outlets when org selected for feature permissions
  useEffect(() => {
    if (!featureOrgId) {
      setAdminOutlets([]);
      setFeatureOutletId("");
      return;
    }
    (async () => {
      const { data } = await supabase.rpc("get_admin_outlets", { p_org_id: featureOrgId });
      const list = (data as AdminOutletRow[] | null) ?? [];
      setAdminOutlets(list);
      setFeatureOutletId(list[0]?.id ?? "");
    })();
  }, [featureOrgId]);

  // Load permissions when outlet selected
  useEffect(() => {
    if (!featureOutletId) {
      setFeaturePerms({});
      return;
    }
    setFeaturePermsLoading(true);
    (async () => {
      const { data } = await supabase
        .from("outlet_feature_permissions")
        .select("feature_key, can_create, can_read, can_update, can_delete")
        .eq("outlet_id", featureOutletId);
      const rows = (data ?? []) as { feature_key: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }[];
      const map: Record<string, OutletFeaturePermission> = {};
      for (const r of rows) {
        map[r.feature_key] = {
          can_create: r.can_create,
          can_read: r.can_read,
          can_update: r.can_update,
          can_delete: r.can_delete,
        };
      }
      setFeaturePerms(map);
      setFeaturePermsLoading(false);
    })();
  }, [featureOutletId]);

  function getFeaturePerm(key: OutletFeatureKey): OutletFeaturePermission {
    return (
      featurePerms[key] ?? {
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
      }
    );
  }

  function setFeaturePerm(key: OutletFeatureKey, field: keyof OutletFeaturePermission, value: boolean) {
    setFeaturePerms((prev) => ({
      ...prev,
      [key]: {
        ...getFeaturePerm(key),
        [field]: value,
      },
    }));
  }

  async function handleSaveFeaturePerms() {
    if (!featureOutletId) return;
    setFeaturePermsSaving(true);
    const rows = OUTLET_FEATURE_LIST.map(({ key }) => {
      const p = getFeaturePerm(key);
      return {
        outlet_id: featureOutletId,
        feature_key: key,
        can_create: p.can_create,
        can_read: p.can_read,
        can_update: p.can_update,
        can_delete: p.can_delete,
      };
    });
    await supabase.from("outlet_feature_permissions").upsert(rows, {
      onConflict: "outlet_id,feature_key",
    });
    setFeaturePermsSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--muted)] p-6">
        <p className="text-center text-lg text-red-600">{error}</p>
        <Link to="/" className="text-[var(--primary)] hover:underline">
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Hisabia Admin</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Ke Aplikasi
            </Link>
            <Link
              to="/logout"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              Keluar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Dashboard SaaS</h2>
          <p className="text-[var(--muted-foreground)]">Ringkasan platform Hisabia</p>
        </div>

        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Organisasi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.orgCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Pengguna
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.userCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Subscription Aktif
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {stats.activeSubscriptions}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Transaksi Hari Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--foreground)]">{stats.ordersToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  Revenue Bulan Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatIdr(stats.revenueMonth)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Daftar Organisasi</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Semua toko/organisasi. Anda bisa set paket untuk toko mana pun (tanpa bayar).
            </p>
          </CardHeader>
          <CardContent>
            {orgs.length === 0 ? (
              <p className="py-8 text-center text-[var(--muted-foreground)]">
                Belum ada organisasi
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                      <th className="pb-3 font-medium">Nama</th>
                      <th className="pb-3 font-medium">Slug</th>
                      <th className="pb-3 font-medium">Plan</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Member</th>
                      <th className="pb-3 font-medium">Outlet</th>
                      <th className="pb-3 font-medium">Dibuat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org) => (
                      <tr
                        key={org.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="py-3 font-medium">{org.name}</td>
                        <td className="py-3 font-mono text-xs">{org.slug}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                              value={planSelect[org.id] ?? org.plan_id ?? ""}
                              onChange={(e) =>
                                setPlanSelect((prev) => ({ ...prev, [org.id]: e.target.value }))
                              }
                            >
                              {plans.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingOrgId === org.id}
                              onClick={() => handleSetPlan(org.id, planSelect[org.id] ?? org.plan_id ?? plans[0]?.id ?? "")}
                            >
                              {savingOrgId === org.id ? "..." : "Set"}
                            </Button>
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              org.sub_status === "active" || org.sub_status === "trialing"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-[var(--muted)]"
                            }`}
                          >
                            {org.sub_status ?? "—"}
                          </span>
                        </td>
                        <td className="py-3">{org.member_count}</td>
                        <td className="py-3">{org.outlet_count}</td>
                        <td className="py-3 text-[var(--muted-foreground)]">
                          {formatDate(org.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Fitur per Outlet</CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              Atur fitur mana yang tampil dan CRUD (Create, Read, Update, Delete) per outlet. Kosong = semua diizinkan. Berlaku tanpa tergantung paket langganan.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Organisasi</label>
                <select
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={featureOrgId}
                  onChange={(e) => setFeatureOrgId(e.target.value)}
                >
                  <option value="">— Pilih organisasi —</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Outlet</label>
                <select
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  value={featureOutletId}
                  onChange={(e) => setFeatureOutletId(e.target.value)}
                  disabled={!featureOrgId || adminOutlets.length === 0}
                >
                  <option value="">— Pilih outlet —</option>
                  {adminOutlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.outlet_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {featureOutletId && (
              <>
                {featurePermsLoading ? (
                  <p className="text-sm text-[var(--muted-foreground)]">Memuat...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                          <th className="pb-2 font-medium">Fitur</th>
                          <th className="pb-2 text-center font-medium">Create</th>
                          <th className="pb-2 text-center font-medium">Read (tampil)</th>
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
                                checked={getFeaturePerm(key).can_create}
                                onChange={(e) => setFeaturePerm(key, "can_create", e.target.checked)}
                              />
                            </td>
                            <td className="py-2 text-center">
                              <input
                                type="checkbox"
                                checked={getFeaturePerm(key).can_read}
                                onChange={(e) => setFeaturePerm(key, "can_read", e.target.checked)}
                              />
                            </td>
                            <td className="py-2 text-center">
                              <input
                                type="checkbox"
                                checked={getFeaturePerm(key).can_update}
                                onChange={(e) => setFeaturePerm(key, "can_update", e.target.checked)}
                              />
                            </td>
                            <td className="py-2 text-center">
                              <input
                                type="checkbox"
                                checked={getFeaturePerm(key).can_delete}
                                onChange={(e) => setFeaturePerm(key, "can_delete", e.target.checked)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Button
                  onClick={handleSaveFeaturePerms}
                  disabled={featurePermsSaving || featurePermsLoading}
                  className="mt-4"
                >
                  {featurePermsSaving ? "Menyimpan..." : "Simpan fitur outlet ini"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

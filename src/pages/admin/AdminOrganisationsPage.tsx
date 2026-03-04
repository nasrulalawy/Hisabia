import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { SubscriptionPlan } from "@/lib/database.types";
import type { OrgRow } from "./adminTypes";

export function AdminOrganisationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [planSelect, setPlanSelect] = useState<Record<string, string>>({});
  const [orgAddonPlanIds, setOrgAddonPlanIds] = useState<Record<string, string[]>>({});
  const [addonModalOrgId, setAddonModalOrgId] = useState<string | null>(null);
  const [addonSaving, setAddonSaving] = useState(false);
  const [trialModalOrgId, setTrialModalOrgId] = useState<string | null>(null);
  const [trialForm, setTrialForm] = useState<{ status: string; period_end: string }>({ status: "trialing", period_end: "" });
  const [trialSaving, setTrialSaving] = useState(false);
  const [kreditSyariahGrantedIds, setKreditSyariahGrantedIds] = useState<Set<string>>(new Set());
  const [kreditSyariahToggling, setKreditSyariahToggling] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [orgsRes, plansRes] = await Promise.all([
        supabase.rpc("get_admin_organizations"),
        supabase.from("subscription_plans").select("*").order("sort_order", { ascending: true }),
      ]);
      const orgsData = orgsRes.data as { error?: string } | OrgRow[] | null;
      if (Array.isArray(orgsData)) {
        setOrgs(orgsData);
        const planList = (plansRes.data ?? []) as SubscriptionPlan[];
        const firstBasePlanId = planList.find((p) => !(p as SubscriptionPlan & { is_addon?: boolean }).is_addon)?.id ?? planList[0]?.id ?? "";
        const initial: Record<string, string> = {};
        orgsData.forEach((o: OrgRow) => {
          const planId = o.plan_id ?? firstBasePlanId;
          const isBase = planList.some((p) => p.id === planId && !(p as SubscriptionPlan & { is_addon?: boolean }).is_addon);
          initial[o.id] = isBase ? planId : firstBasePlanId;
        });
        setPlanSelect(initial);
      } else if (orgsData && typeof orgsData === "object" && "error" in orgsData) {
        setError((orgsData as { error?: string }).error ?? "Gagal memuat organisasi");
      }
      if (plansRes.data) setPlans(plansRes.data as SubscriptionPlan[]);
      const { data: grantsData } = await supabase
        .from("organization_feature_grants")
        .select("organization_id")
        .eq("feature_key", "kredit_syariah");
      setKreditSyariahGrantedIds(
        new Set((grantsData ?? []).map((r: { organization_id: string }) => r.organization_id))
      );
      const { data: addonsData } = await supabase
        .from("organization_addon_plans")
        .select("organization_id, plan_id");
      const addonsMap: Record<string, string[]> = {};
      (addonsData ?? []).forEach((r: { organization_id: string; plan_id: string }) => {
        if (!addonsMap[r.organization_id]) addonsMap[r.organization_id] = [];
        addonsMap[r.organization_id].push(r.plan_id);
      });
      setOrgAddonPlanIds(addonsMap);
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
      const plan = plans.find((p) => p.id === planId);
      setOrgs((prev) =>
        prev.map((o) =>
          o.id !== orgId ? o : { ...o, plan_id: planId, plan_name: plan?.name ?? null, sub_status: "active" }
        )
      );
      setPlanSelect((prev) => ({ ...prev, [orgId]: planId }));
    }
  }

  async function handleKreditSyariahToggle(orgId: string) {
    const hasGrant = kreditSyariahGrantedIds.has(orgId);
    setKreditSyariahToggling(orgId);
    if (hasGrant) {
      await supabase
        .from("organization_feature_grants")
        .delete()
        .eq("organization_id", orgId)
        .eq("feature_key", "kredit_syariah");
      setKreditSyariahGrantedIds((prev) => {
        const next = new Set(prev);
        next.delete(orgId);
        return next;
      });
    } else {
      await supabase.from("organization_feature_grants").insert({
        organization_id: orgId,
        feature_key: "kredit_syariah",
      });
      setKreditSyariahGrantedIds((prev) => new Set(prev).add(orgId));
    }
    setKreditSyariahToggling(null);
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

  const basePlans = plans.filter((p) => !(p as SubscriptionPlan & { is_addon?: boolean }).is_addon);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Organisasi</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Daftar toko/organisasi. Anda bisa set paket untuk toko mana pun (tanpa bayar).
        </p>
      </div>

      <Card className="border-[var(--border)]">
        <CardHeader>
          <CardTitle>Daftar Organisasi</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Set paket utama, addon, trial/period end, dan izin Kredit Syariah per organisasi.
          </p>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="py-8 text-center text-[var(--muted-foreground)]">Belum ada organisasi</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-3 font-medium">Nama</th>
                    <th className="pb-3 font-medium">Slug</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Addon</th>
                    <th className="pb-3 font-medium">Total/bulan</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Trial berakhir</th>
                    <th className="pb-3 font-medium">Member</th>
                    <th className="pb-3 font-medium">Outlet</th>
                    <th className="pb-3 font-medium">Kredit Syariah</th>
                    <th className="pb-3 font-medium">Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => {
                    const basePlanId = planSelect[org.id] ?? org.plan_id ?? basePlans[0]?.id ?? "";
                    const addonIds = orgAddonPlanIds[org.id] ?? [];
                    const basePlan = plans.find((p) => p.id === basePlanId);
                    const addonPlans = addonIds.map((id) => plans.find((p) => p.id === id)).filter(Boolean) as SubscriptionPlan[];
                    const totalMonthly = (basePlan?.price_monthly ?? 0) + addonPlans.reduce((s, p) => s + (p.price_monthly ?? 0), 0);
                    return (
                      <tr key={org.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-3 font-medium">{org.name}</td>
                        <td className="py-3 font-mono text-xs">{org.slug}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <select
                              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                              value={basePlanId}
                              onChange={(e) => setPlanSelect((prev) => ({ ...prev, [org.id]: e.target.value }))}
                            >
                              {basePlans.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingOrgId === org.id}
                              onClick={() => handleSetPlan(org.id, basePlanId || (basePlans[0]?.id ?? ""))}
                            >
                              {savingOrgId === org.id ? "..." : "Set"}
                            </Button>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="text-[var(--muted-foreground)]">
                            {addonPlans.length ? addonPlans.map((p) => p.name).join(", ") : "—"}
                          </span>
                          <Button size="sm" variant="ghost" className="ml-1" onClick={() => setAddonModalOrgId(org.id)}>
                            Atur
                          </Button>
                        </td>
                        <td className="py-3 font-medium">{formatIdr(totalMonthly)}</td>
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
                        <td className="py-3">
                          {org.sub_period_end ? formatDate(org.sub_period_end) : "—"}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-1"
                            onClick={() => {
                              const orgRow = orgs.find((o) => o.id === org.id);
                              const end = orgRow?.sub_period_end
                                ? new Date(orgRow.sub_period_end).toISOString().slice(0, 10)
                                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                              setTrialForm({
                                status: orgRow?.sub_status ?? "trialing",
                                period_end: end,
                              });
                              setTrialModalOrgId(org.id);
                            }}
                          >
                            Atur
                          </Button>
                        </td>
                        <td className="py-3">{org.member_count}</td>
                        <td className="py-3">{org.outlet_count}</td>
                        <td className="py-3">
                          <Button
                            size="sm"
                            variant={kreditSyariahGrantedIds.has(org.id) ? "outline" : "primary"}
                            disabled={kreditSyariahToggling === org.id}
                            onClick={() => handleKreditSyariahToggle(org.id)}
                            title={
                              kreditSyariahGrantedIds.has(org.id) ? "Cabut izin Kredit Syariah" : "Beri izin Kredit Syariah (hanya mart)"
                            }
                          >
                            {kreditSyariahToggling === org.id
                              ? "..."
                              : kreditSyariahGrantedIds.has(org.id)
                                ? "Cabut Izin"
                                : "Beri Izin"}
                          </Button>
                        </td>
                        <td className="py-3 text-[var(--muted-foreground)]">{formatDate(org.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={addonModalOrgId !== null} onClose={() => setAddonModalOrgId(null)} title="Atur addon organisasi" size="md">
        {addonModalOrgId && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Centang addon yang dipakai organisasi ini. Harga addon ditambahkan ke paket utama per bulan.
            </p>
            <div className="space-y-2">
              {plans
                .filter((p) => (p as SubscriptionPlan & { is_addon?: boolean }).is_addon)
                .map((p) => {
                  const selected = (orgAddonPlanIds[addonModalOrgId] ?? []).includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center justify-between gap-4 rounded border border-[var(--border)] px-3 py-2"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-sm text-[var(--muted-foreground)]">{formatIdr(p.price_monthly)}/bulan</span>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = orgAddonPlanIds[addonModalOrgId] ?? [];
                          const next = e.target.checked ? [...current, p.id] : current.filter((id) => id !== p.id);
                          setOrgAddonPlanIds((prev) => ({ ...prev, [addonModalOrgId]: next }));
                        }}
                      />
                    </label>
                  );
                })}
            </div>
            {plans.filter((p) => (p as SubscriptionPlan & { is_addon?: boolean }).is_addon).length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">
                Belum ada paket addon. Buat paket dan centang &quot;Paket addon&quot; di halaman Paket Langganan.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAddonModalOrgId(null)}>
                Batal
              </Button>
              <Button
                disabled={addonSaving}
                onClick={async () => {
                  setAddonSaving(true);
                  const nextIds = orgAddonPlanIds[addonModalOrgId] ?? [];
                  await supabase.from("organization_addon_plans").delete().eq("organization_id", addonModalOrgId);
                  if (nextIds.length) {
                    await supabase
                      .from("organization_addon_plans")
                      .insert(nextIds.map((plan_id) => ({ organization_id: addonModalOrgId, plan_id })));
                  }
                  setAddonSaving(false);
                  setAddonModalOrgId(null);
                }}
              >
                {addonSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={trialModalOrgId !== null} onClose={() => setTrialModalOrgId(null)} title="Atur trial & periode" size="sm">
        {trialModalOrgId && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Set status langganan dan tanggal berakhir periode (trial atau periode berbayar).
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Status</label>
              <select
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={trialForm.status}
                onChange={(e) => setTrialForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="trialing">Trialing (trial)</option>
                <option value="active">Active (aktif berbayar)</option>
                <option value="past_due">Past due</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Berakhir periode</label>
              <input
                type="date"
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={trialForm.period_end}
                onChange={(e) => setTrialForm((prev) => ({ ...prev, period_end: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTrialModalOrgId(null)}>
                Batal
              </Button>
              <Button
                disabled={trialSaving || !trialForm.period_end}
                onClick={async () => {
                  setTrialSaving(true);
                  const periodEnd = new Date(trialForm.period_end);
                  if (isNaN(periodEnd.getTime())) {
                    setTrialSaving(false);
                    return;
                  }
                  const { data } = await supabase.rpc("admin_set_subscription_trial", {
                    p_org_id: trialModalOrgId,
                    p_status: trialForm.status,
                    p_period_end: periodEnd.toISOString(),
                  });
                  const res = data as { error?: string; success?: boolean } | null;
                  if (res?.success) {
                    setOrgs((prev) =>
                      prev.map((o) =>
                        o.id === trialModalOrgId
                          ? { ...o, sub_status: trialForm.status, sub_period_end: periodEnd.toISOString() }
                          : o
                      )
                    );
                    setTrialModalOrgId(null);
                  } else if (res?.error) {
                    setError(res.error);
                  }
                  setTrialSaving(false);
                }}
              >
                {trialSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

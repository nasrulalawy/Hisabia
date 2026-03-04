import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SubscriptionPlan } from "@/lib/database.types";

interface SubscriptionWithPlan {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  subscription_plans: SubscriptionPlan | null;
}

export function SubscriptionPage() {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [addonPlans, setAddonPlans] = useState<SubscriptionPlan[]>([]);
  const [outletCount, setOutletCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase.from("subscription_plans").select("*").order("sort_order", { ascending: true }),
      supabase.from("outlets").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("organization_members").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("organization_addon_plans").select("plan_id").eq("organization_id", orgId),
    ]).then(([subRes, plansRes, outletsRes, membersRes, addonsRes]) => {
      setSubscription(subRes.data as SubscriptionWithPlan | null);
      const allPlans = (plansRes.data ?? []) as SubscriptionPlan[];
      setPlans(allPlans.filter((p) => !(p as SubscriptionPlan & { is_addon?: boolean }).is_addon));
      const addonIds = (addonsRes.data ?? []).map((r: { plan_id: string }) => r.plan_id);
      setAddonPlans(allPlans.filter((p) => addonIds.includes(p.id)));
      setOutletCount(outletsRes.count ?? 0);
      setMemberCount(membersRes.count ?? 0);
      setLoading(false);
    });
  }, [orgId]);

  const currentPlan = subscription?.subscription_plans;
  const outletLimit = currentPlan?.outlet_limit ?? 1;
  const memberLimit = currentPlan?.member_limit ?? 2;
  const canAddOutlet = outletCount < outletLimit;
  const canAddMember = memberCount < memberLimit;

  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const now = new Date();
  const periodExpired = !!(subscription && periodEnd && periodEnd < now) || subscription?.status === "canceled";
  const isTrialing = subscription?.status === "trialing";
  const trialExpired = periodExpired;

  const loadSubscription = useCallback(() => {
    if (!orgId) return;
    supabase
      .from("subscriptions")
      .select("*, subscription_plans(*)")
      .eq("organization_id", orgId)
      .maybeSingle()
      .then(({ data }) => setSubscription(data as SubscriptionWithPlan | null));
  }, [orgId]);

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
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Subscription</h2>
        <p className="text-[var(--muted-foreground)]">Kelola paket langganan organisasi.</p>
      </div>

      {trialExpired && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-6">
            <p className="text-lg font-semibold text-amber-800">Masa trial 14 hari telah berakhir</p>
            <p className="mt-2 text-sm text-amber-700">
              Untuk melanjutkan menggunakan Hisabia, berlangganan paket Basic (Rp 99.000/bulan).
            </p>
            <p className="mt-4 text-sm text-amber-600">
              Aplikasi gratis hanya selama 14 hari trial. Setelah itu wajib berlangganan.
            </p>
            {plans.length > 0 && Number(plans[0]?.price_monthly) >= 1 && (
              <Link to={`/org/${orgId}/subscription/pay/${plans[0].id}`}>
                <Button type="button" className="mt-4 cursor-pointer">
                  Bayar Paket Basic
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {subscription ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Paket Saat Ini</CardTitle>
            <Badge
              variant={
                periodExpired
                  ? "warning"
                  : subscription.status === "active" || subscription.status === "trialing"
                    ? "success"
                    : subscription.status === "past_due"
                      ? "warning"
                      : "default"
              }
            >
              {periodExpired
                ? "Masa berlaku habis"
                : subscription.status === "active"
                  ? "Aktif"
                  : subscription.status === "trialing"
                    ? "Trial"
                    : subscription.status === "past_due"
                      ? "Past Due"
                      : subscription.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{currentPlan?.name ?? "—"}</p>
              <p className="text-sm text-[var(--muted-foreground)]">{currentPlan?.description ?? ""}</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">Paket:</span>{" "}
                {currentPlan ? formatIdr(Number(currentPlan.price_monthly)) : "—"} / bulan
              </div>
              {addonPlans.length > 0 && (
                <>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Addon:</span>{" "}
                    {addonPlans.map((p) => p.name).join(", ")} ({addonPlans.map((p) => formatIdr(Number(p.price_monthly))).join(" + ")})
                  </div>
                  <div className="font-medium">
                    <span className="text-[var(--muted-foreground)]">Total:</span>{" "}
                    {formatIdr(
                      Number(currentPlan?.price_monthly ?? 0) + addonPlans.reduce((s, p) => s + Number(p.price_monthly ?? 0), 0)
                    )}{" "}
                    / bulan
                  </div>
                </>
              )}
              {addonPlans.length === 0 && (
                <div>
                  <span className="text-[var(--muted-foreground)]">Total:</span>{" "}
                  {currentPlan ? formatIdr(Number(currentPlan.price_monthly)) : "—"} / bulan
                </div>
              )}
              <div>
                <span className="text-[var(--muted-foreground)]">Limit Outlet:</span>{" "}
                {outletLimit === 999 ? "Unlimited" : outletLimit}
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Outlets digunakan:</span> {outletCount}
                {!canAddOutlet && outletLimit < 999 && (
                  <span className="ml-1 text-amber-600">(limit tercapai)</span>
                )}
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Limit User:</span>{" "}
                {memberLimit === 999 ? "Unlimited" : memberLimit}
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">User aktif:</span> {memberCount}
                {!canAddMember && memberLimit < 999 && (
                  <span className="ml-1 text-amber-600">(limit tercapai)</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)]">
              <div>
                Periode: {formatDate(subscription.current_period_start)} —{" "}
                {formatDate(subscription.current_period_end)}
              </div>
              {periodExpired && currentPlan && Number(currentPlan.price_monthly) >= 1 && (
                <Link to={`/org/${orgId}/subscription/pay/${currentPlan.id}`}>
                  <Button type="button" variant="primary" size="sm" className="cursor-pointer">
                    Perpanjang paket
                  </Button>
                </Link>
              )}
            </div>
            {Array.isArray(currentPlan?.features) && currentPlan.features.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">Fitur:</p>
                <ul className="flex flex-wrap gap-2">
                  {(currentPlan.features as string[]).map((f, i) => (
                    <li key={i}>
                      <Badge variant="default">{f}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-[var(--muted-foreground)]">
              Belum ada subscription. Hubungi admin untuk mengaktifkan paket.
            </p>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Paket Tersedia</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            return (
              <Card key={plan.id} className={isCurrent ? "border-[var(--primary)]" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrent && <Badge variant="success">Aktif</Badge>}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">{plan.description ?? ""}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {Number(plan.price_monthly) === 0 ? "Gratis" : formatIdr(Number(plan.price_monthly))}
                    <span className="text-sm font-normal text-[var(--muted-foreground)]">/bulan</span>
                  </p>
                  {addonPlans.length > 0 && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Total (paket + addon):{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        {formatIdr(
                          Number(plan.price_monthly ?? 0) + addonPlans.reduce((s, p) => s + Number(p.price_monthly ?? 0), 0)
                        )}
                        /bulan
                      </span>
                    </p>
                  )}
                  <p className="text-sm">
                    {plan.outlet_limit === 999 ? "Unlimited" : plan.outlet_limit} outlet
                    {" · "}
                    {(plan.member_limit ?? 2) === 999 ? "Unlimited" : (plan.member_limit ?? 2)} user
                  </p>
                  {Array.isArray(plan.features) && (
                    <ul className="space-y-1 text-sm text-[var(--muted-foreground)]">
                      {(plan.features as string[]).slice(0, 4).map((f, i) => (
                        <li key={i}>• {f}</li>
                      ))}
                    </ul>
                  )}
                  {isCurrent && periodExpired && Number(plan.price_monthly) >= 1 && (
                    <Link to={`/org/${orgId}/subscription/pay/${plan.id}`} className="block w-full">
                      <Button type="button" variant="primary" size="sm" className="w-full cursor-pointer">
                        Perpanjang paket
                      </Button>
                    </Link>
                  )}
                  {!isCurrent && Number(plan.price_monthly) > 0 && (
                    <Link to={`/org/${orgId}/subscription/pay/${plan.id}`} className="block w-full">
                      <Button type="button" variant="primary" size="sm" className="w-full cursor-pointer">
                        Bayar Sekarang
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

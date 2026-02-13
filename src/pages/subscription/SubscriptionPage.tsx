import { useEffect, useState } from "react";
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
      supabase.from("subscription_plans").select("*").order("price_monthly"),
      supabase.from("outlets").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("organization_members").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    ]).then(([subRes, plansRes, outletsRes, membersRes]) => {
      setSubscription(subRes.data as SubscriptionWithPlan | null);
      setPlans(plansRes.data ?? []);
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

  const isTrialing = subscription?.status === "trialing";
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const trialExpired = !!(isTrialing && periodEnd && periodEnd < new Date());

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
              Untuk melanjutkan menggunakan Hisabia, upgrade ke paket Pro minimal (Rp 99.000/bulan).
            </p>
            <p className="mt-4 text-sm text-amber-600">
              Paket Basic gratis hanya berlaku 14 hari untuk akun baru. Setelah itu wajib upgrade.
            </p>
          </CardContent>
        </Card>
      )}

      {subscription ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Paket Saat Ini</CardTitle>
            <Badge
              variant={
                trialExpired
                  ? "warning"
                  : subscription.status === "active" || subscription.status === "trialing"
                    ? "success"
                    : subscription.status === "past_due"
                      ? "warning"
                      : "default"
              }
            >
              {trialExpired
                ? "Trial Berakhir"
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
                <span className="text-[var(--muted-foreground)]">Harga:</span>{" "}
                {currentPlan ? formatIdr(Number(currentPlan.price_monthly)) : "—"} / bulan
              </div>
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
            <div className="flex gap-6 text-sm text-[var(--muted-foreground)]">
              <div>
                Periode: {formatDate(subscription.current_period_start)} —{" "}
                {formatDate(subscription.current_period_end)}
              </div>
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
                  {!isCurrent && (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Upgrade (coming soon)
                    </Button>
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

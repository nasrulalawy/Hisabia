import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { formatIdr } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SubscriptionPlan } from "@/lib/database.types";

declare global {
  interface Window {
    snap?: { pay: (token: string) => void };
  }
}

function loadSnapScript(env: "sandbox" | "production"): Promise<void> {
  const src =
    env === "production"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing && window.snap) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    const clientKey =
      env === "sandbox"
        ? (import.meta.env.VITE_MIDTRANS_CLIENT_KEY_SANDBOX || import.meta.env.VITE_MIDTRANS_CLIENT_KEY)
        : import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
    if (clientKey) script.setAttribute("data-client-key", clientKey);
    script.onload = () => {
      if (window.snap) resolve();
      else setTimeout(() => (window.snap ? resolve() : reject(new Error("Snap tidak tersedia"))), 300);
    };
    script.onerror = () => reject(new Error("Gagal memuat Snap"));
    document.body.appendChild(script);
  });
}

export function SubscriptionPayPage() {
  const { orgId, planId } = useParams<{ orgId: string; planId: string }>();
  const { orgId: contextOrgId } = useOrg();
  const effectiveOrgId = orgId ?? contextOrgId;

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [addonPlans, setAddonPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (!effectiveOrgId || !planId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from("subscription_plans").select("*").eq("id", planId).single(),
      supabase
        .from("organization_addon_plans")
        .select("plan_id")
        .eq("organization_id", effectiveOrgId),
    ]).then(([planRes, addonsRes]) => {
      const planData = planRes.data as SubscriptionPlan | null;
      const isAddon = (planData as SubscriptionPlan & { is_addon?: boolean })?.is_addon;
      if (planRes.error || !planData || isAddon) {
        setPlan(null);
        setAddonPlans([]);
      } else {
        setPlan(planData);
        const addonIds = (addonsRes.data ?? []).map((r: { plan_id: string }) => r.plan_id);
        if (addonIds.length > 0) {
          supabase
            .from("subscription_plans")
            .select("*")
            .in("id", addonIds)
            .then(({ data }) => setAddonPlans((data ?? []) as SubscriptionPlan[]));
        } else {
          setAddonPlans([]);
        }
      }
      setLoading(false);
    });
  }, [effectiveOrgId, planId]);

  const isYearly = billingInterval === "yearly";
  const planMonthly = plan ? Number(plan.price_monthly) : 0;
  const planYearly =
    plan && plan.price_yearly != null ? Number(plan.price_yearly) : planMonthly * 12;
  const planPrice = isYearly ? planYearly : planMonthly;
  const addonMonthly = addonPlans.reduce((s, p) => s + Number(p.price_monthly ?? 0), 0);
  const addonTotal = isYearly ? addonMonthly * 12 : addonMonthly;
  const totalAmount = planPrice + addonTotal;

  const openSnapPay = useCallback(
    async () => {
      if (!effectiveOrgId || !plan) return;
      if (totalAmount < 1) return;
      setPayLoading(true);
      try {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        const token = refreshedSession?.access_token;
        if (!token) {
          if (refreshError?.message) console.error("Auth refresh error:", refreshError.message);
          alert("Sesi habis. Silakan logout lalu login lagi.");
          return;
        }
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/create-subscription-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(anonKey ? { "apikey": anonKey } : {}),
          },
          body: JSON.stringify({
            organization_id: effectiveOrgId,
            plan_id: plan.id,
            billing_interval: billingInterval,
            addon_plan_ids: addonPlans.map((p) => p.id),
            use_sandbox: (() => {
              if (typeof window === "undefined") return false;
              if (import.meta.env.VITE_USE_MIDTRANS_SANDBOX === "true") return true;
              const h = window.location.hostname;
              return h === "localhost" || h === "127.0.0.1";
            })(),
          }),
        });
        const json = (await res.json()) as {
          orderId?: string;
          snapToken?: string;
          midtrans_env?: "sandbox" | "production";
          error?: string;
          code?: number;
          message?: string;
        };
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("Sesi habis atau token tidak valid. Silakan logout lalu login ulang.");
          }
          throw new Error(json?.message || json?.error || "Gagal membuat transaksi");
        }
        if (json?.error) throw new Error(json.error);
        const snapToken = json.snapToken;
        const env = json.midtrans_env ?? "sandbox";
        if (!snapToken) throw new Error("Token pembayaran tidak diterima.");
        await loadSnapScript(env);
        if (!window.snap) throw new Error("Snap tidak dapat dimuat. Coba lagi.");
        window.snap.pay(snapToken);
      } catch (err) {
        const msg = (err as Error).message;
        if (
          msg.includes("Failed to send") ||
          msg.includes("Failed to fetch") ||
          msg.includes("NetworkError") ||
          msg.includes("Load failed")
        ) {
          alert(
            "Tidak dapat terhubung ke server. Pastikan koneksi internet aktif dan Edge Function create-subscription-order sudah di-deploy."
          );
        } else {
          alert(msg);
        }
      } finally {
        setPayLoading(false);
      }
    },
    [effectiveOrgId, plan, totalAmount, billingInterval, addonPlans]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!plan || !effectiveOrgId) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--muted-foreground)]">Paket tidak ditemukan.</p>
        <Link to={`/org/${effectiveOrgId}/subscription`}>
          <Button variant="outline">Kembali ke Langganan</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to={`/org/${effectiveOrgId}/subscription`}
          className="rounded-lg p-1 hover:bg-[var(--muted)]"
          aria-label="Kembali"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Pembayaran Langganan</h2>
          <p className="text-sm text-[var(--muted-foreground)]">Bayar dengan Midtrans Snap</p>
        </div>
      </div>

      {/* Periode: Bulanan / Tahunan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Periode Langganan</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">Pilih bayar per bulan atau per tahun</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 rounded-lg border border-[var(--border)] p-1">
            <button
              type="button"
              onClick={() => setBillingInterval("monthly")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                billingInterval === "monthly"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("yearly")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                billingInterval === "yearly"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              Tahunan
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Detail pembayaran */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detail Pembayaran</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Paket</span>
            <span className="font-medium text-[var(--foreground)]">{plan.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Harga paket</span>
            <span>{formatIdr(planPrice)} / {isYearly ? "tahun" : "bulan"}</span>
          </div>
          {addonPlans.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Addon ({addonPlans.map((p) => p.name).join(", ")})</span>
              <span>{formatIdr(addonTotal)} / {isYearly ? "tahun" : "bulan"}</span>
            </div>
          )}
          <div className="border-t border-[var(--border)] pt-3">
            <div className="flex justify-between">
              <span className="font-medium text-[var(--foreground)]">Total</span>
              <span className="text-xl font-bold text-[var(--foreground)]">
                {formatIdr(totalAmount)}{" "}
                <span className="text-sm font-normal text-[var(--muted-foreground)]">
                  / {isYearly ? "tahun" : "bulan"}
                </span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tombol Bayar dengan Midtrans Snap */}
      <Card>
        <CardContent className="pt-6">
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            Pilih metode pembayaran (QRIS, transfer bank, e-wallet, dll.) di halaman Midtrans.
          </p>
          <Button
            type="button"
            onClick={openSnapPay}
            disabled={payLoading || totalAmount < 1}
            className="w-full"
          >
            {payLoading ? "Memproses..." : "Bayar dengan Midtrans"}
          </Button>
          <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
            Setelah bayar, langganan akan aktif otomatis. Anda bisa menutup popup dan kembali ke halaman Langganan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

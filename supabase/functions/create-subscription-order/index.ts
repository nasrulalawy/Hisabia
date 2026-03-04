import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SNAP_URL_PRODUCTION = "https://app.midtrans.com/snap/v1/transactions";
const SNAP_URL_SANDBOX = "https://app.sandbox.midtrans.com/snap/v1/transactions";

// CORS: wajib sama dengan yang dipakai Supabase client (authorization, x-client-info, apikey, content-type)
function getCorsHeaders(req: Request): Record<string, string> {
  let origin = req.headers.get("Origin");
  if (!origin && req.headers.get("Referer")) {
    try {
      const u = new URL(req.headers.get("Referer")!);
      origin = u.origin;
    } catch {
      // ignore
    }
  }
  const allowOrigin = origin && (origin.startsWith("http://") || origin.startsWith("https://")) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Preflight: harus return 200 + body "ok" sesuai doc Supabase
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON tidak valid" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const {
      organization_id: orgId,
      plan_id: planId,
      billing_interval: billingInterval = "monthly",
      addon_plan_ids: addonPlanIds = [],
      use_sandbox: useSandbox = false,
    } = body;
    if (!orgId || !planId) {
      return new Response(JSON.stringify({ error: "organization_id dan plan_id wajib" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();
    if (!member) {
      return new Response(JSON.stringify({ error: "Akses ditolak" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: plan } = await admin
      .from("subscription_plans")
      .select("id, name, price_monthly, price_yearly")
      .eq("id", planId)
      .single();
    if (!plan) {
      return new Response(JSON.stringify({ error: "Paket tidak ditemukan" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const isYearly = billingInterval === "yearly";
    const planMonthly = Number(plan.price_monthly) || 0;
    const planYearly = plan.price_yearly != null ? Number(plan.price_yearly) : planMonthly * 12;
    let planAmount = isYearly ? planYearly : planMonthly;
    let addonAmount = 0;
    const addonIds = Array.isArray(addonPlanIds) ? addonPlanIds.filter((id): id is string => typeof id === "string") : [];
    if (addonIds.length > 0) {
      const { data: addonPlans } = await admin
        .from("subscription_plans")
        .select("id, price_monthly")
        .in("id", addonIds)
        .eq("is_addon", true);
      for (const ap of addonPlans ?? []) {
        const m = Number(ap.price_monthly) || 0;
        addonAmount += isYearly ? m * 12 : m;
      }
    }
    const amount = Math.round(planAmount + addonAmount);
    if (amount < 1) {
      return new Response(JSON.stringify({ error: "Paket gratis tidak perlu dibayar" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const orderId = `sub-${orgId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = user.email || "";
    const nameParts = (user.user_metadata?.full_name || email.split("@")[0] || "Customer").split(" ");

    const isSandbox = useSandbox === true || useSandbox === "true";
    const serverKey = isSandbox
      ? Deno.env.get("MIDTRANS_SANDBOX_SERVER_KEY")
      : Deno.env.get("MIDTRANS_SERVER_KEY");
    const snapUrl = isSandbox ? SNAP_URL_SANDBOX : SNAP_URL_PRODUCTION;
    if (!serverKey) {
      return new Response(JSON.stringify({
        error: isSandbox ? "Midtrans sandbox tidak dikonfigurasi (MIDTRANS_SANDBOX_SERVER_KEY)" : "Midtrans tidak dikonfigurasi (MIDTRANS_SERVER_KEY)",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const snapBody = {
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: planId, name: `Langganan ${plan.name}${isYearly ? " (1 tahun)" : " (1 bulan)"}`, price: amount, quantity: 1 }],
      customer_details: {
        first_name: nameParts[0] || "Customer",
        last_name: nameParts.slice(1).join(" ") || "",
        email: email || "customer@hisabia.app",
        phone: user.phone || "",
      },
    };

    const auth = btoa(serverKey + ":");
    const snapRes = await fetch(snapUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(snapBody),
    });

    const snapData = await snapRes.json();
    if (!snapRes.ok) {
      console.error("Midtrans Snap error:", snapData);
      const errMsg = Array.isArray(snapData.error_messages) ? snapData.error_messages.join(". ") : snapData.error_message || "Gagal membuat transaksi";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const snapToken = snapData.token;
    if (!snapToken) {
      return new Response(JSON.stringify({ error: "Token Snap tidak diterima dari Midtrans" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const billingIntervalVal = billingInterval === "yearly" ? "yearly" : "monthly";
    await admin.from("subscription_payments").insert({
      organization_id: orgId,
      plan_id: planId,
      order_id: orderId,
      amount,
      status: "pending",
      billing_interval: billingIntervalVal,
    });

    return new Response(JSON.stringify({
      orderId,
      snapToken,
      midtrans_env: isSandbox ? "sandbox" : "production",
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

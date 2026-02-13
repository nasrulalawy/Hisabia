import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MIDTRANS_URL = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true"
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!serverKey) {
      return new Response(JSON.stringify({ error: "Midtrans tidak dikonfigurasi" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { organization_id: orgId, plan_id: planId } = await req.json();
    if (!orgId || !planId) {
      return new Response(JSON.stringify({ error: "organization_id dan plan_id wajib" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { data: plan } = await admin
      .from("subscription_plans")
      .select("id, name, price_monthly")
      .eq("id", planId)
      .single();
    if (!plan) {
      return new Response(JSON.stringify({ error: "Paket tidak ditemukan" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const amount = Math.round(Number(plan.price_monthly) || 0);
    if (amount < 1) {
      return new Response(JSON.stringify({ error: "Paket gratis tidak perlu dibayar" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const orderId = `sub-${orgId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = user.email || "";
    const nameParts = (user.user_metadata?.full_name || email.split("@")[0] || "Customer").split(" ");

    const midtransBody = {
      transaction_details: { order_id: orderId, gross_amount: amount },
      item_details: [{ id: planId, name: `Langganan ${plan.name}`, price: amount, quantity: 1 }],
      customer_details: {
        first_name: nameParts[0] || "Customer",
        last_name: nameParts.slice(1).join(" ") || "",
        email: email || "customer@hisabia.app",
      },
    };

    const auth = btoa(serverKey + ":");
    const midRes = await fetch(MIDTRANS_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(midtransBody),
    });

    const midtransData = await midRes.json();
    if (!midRes.ok || !midtransData.token) {
      console.error("Midtrans error:", midtransData);
      return new Response(JSON.stringify({ error: midtransData.error_message || "Gagal membuat order" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    await admin.from("subscription_payments").insert({
      organization_id: orgId,
      plan_id: planId,
      order_id: orderId,
      amount,
      status: "pending",
    });

    return new Response(JSON.stringify({ snapToken: midtransData.token, orderId }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

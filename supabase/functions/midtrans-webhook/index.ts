import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const orderId = body?.order_id;
    const status = body?.transaction_status;
    const fraudStatus = body?.fraud_status;

    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { data: payment, error: payErr } = await admin
      .from("subscription_payments")
      .select("id, organization_id, plan_id, amount")
      .eq("order_id", orderId)
      .single();

    if (payErr || !payment) {
      console.warn("Webhook: payment not found", orderId);
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const isSuccess = status === "capture" && (fraudStatus === "accept" || !fraudStatus);

    if (isSuccess) {
      await admin.from("subscription_payments").update({
        status: "paid",
        midtrans_transaction_id: body.transaction_id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("order_id", orderId);

      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await admin.from("subscriptions").upsert({
        organization_id: payment.organization_id,
        plan_id: payment.plan_id,
        status: "active",
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });
    }

    return new Response(JSON.stringify({ received: true }), {
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

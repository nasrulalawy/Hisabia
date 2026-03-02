import dotenv from "dotenv";
import crypto from "crypto";
// Load .env.local first (VITE_* or NEXT_PUBLIC_* for Supabase URL/keys)
dotenv.config({ path: ".env.local" });
dotenv.config();
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appOrigin = process.env.VITE_APP_ORIGIN || process.env.APP_ORIGIN || "http://localhost:3000";

const FREE_PLAN_ID = "11111111-1111-1111-1111-111111111101";

if (!supabaseUrl || !supabaseAnon) {
  console.warn("Missing Supabase URL or anon key");
}
if (!serviceRoleKey) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY missing - create organization will fail");
}

const admin = serviceRoleKey && supabaseUrl
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

function generateShopToken() {
  return crypto.randomBytes(16).toString("base64url").slice(0, 24);
}

// --- Invite pelanggan: info by token (public) ---
app.get("/api/invite/:token", async (req, res) => {
  try {
    const token = (req.params.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token diperlukan" });
    if (!admin) return res.status(503).json({ error: "Server not configured" });

    const { data: customer, error: custErr } = await admin
      .from("customers")
      .select("id, email, organization_id, invite_expires_at, user_id")
      .eq("invite_token", token)
      .single();

    if (custErr || !customer) return res.status(404).json({ error: "Link undangan tidak valid atau sudah kadaluarsa" });
    if (customer.user_id) return res.status(400).json({ error: "Akun untuk pelanggan ini sudah terhubung" });
    if (!customer.email?.trim()) return res.status(400).json({ error: "Data pelanggan tidak memiliki email" });
    const expiresAt = customer.invite_expires_at ? new Date(customer.invite_expires_at) : null;
    if (expiresAt && expiresAt < new Date()) return res.status(400).json({ error: "Link undangan sudah kadaluarsa" });

    const { data: org } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", customer.organization_id)
      .single();

    const catalogUrl = `${appOrigin}/katalog/${customer.organization_id}`;
    return res.json({
      email: customer.email.trim(),
      orgName: org?.name ?? "Toko",
      catalogUrl,
      orgId: customer.organization_id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- Invite pelanggan: link akun setelah daftar/login (auth) ---
app.post("/api/invite/:token/link", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!bearerToken) return res.status(401).json({ error: "Unauthorized" });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(bearerToken);
    if (userError || !user) return res.status(401).json({ error: "Invalid token" });

    const token = req.params.token;
    if (!token) return res.status(400).json({ error: "Token diperlukan" });
    if (!admin) return res.status(503).json({ error: "Server not configured" });

    const { data: customer, error: custErr } = await admin
      .from("customers")
      .select("id, email, organization_id, invite_expires_at, user_id")
      .eq("invite_token", token)
      .single();

    if (custErr || !customer) return res.status(404).json({ error: "Link undangan tidak valid" });
    if (customer.user_id) return res.json({ linked: true, catalogUrl: `${appOrigin}/katalog/${customer.organization_id}` });
    const expiresAt = customer.invite_expires_at ? new Date(customer.invite_expires_at) : null;
    if (expiresAt && expiresAt < new Date()) return res.status(400).json({ error: "Link undangan sudah kadaluarsa" });

    const emailMatch = (customer.email || "").trim().toLowerCase() === (user.email || "").toLowerCase();
    if (!emailMatch) return res.status(403).json({ error: "Email akun harus sama dengan email pelanggan yang diundang" });

    const { error: updErr } = await admin
      .from("customers")
      .update({
        user_id: user.id,
        invite_token: null,
        invite_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id);

    if (updErr) return res.status(500).json({ error: "Gagal menghubungkan akun" });

    const catalogUrl = `${appOrigin}/katalog/${customer.organization_id}`;
    return res.json({ linked: true, catalogUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/create-organization", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (!admin) {
      return res.status(503).json({ error: "Server not configured for create organization" });
    }

    const { name, slug: slugRaw, outletName: outletNameRaw } = req.body || {};
    const nameTrim = typeof name === "string" ? name.trim() : "";
    if (!nameTrim) {
      return res.status(400).json({ error: "Nama usaha wajib diisi." });
    }

    const slug =
      (typeof slugRaw === "string" ? slugRaw.trim() : "") ||
      nameTrim
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const outletName = (typeof outletNameRaw === "string" ? outletNameRaw.trim() : "") || nameTrim || "Outlet Utama";

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: nameTrim, slug, plan_id: FREE_PLAN_ID })
      .select("id")
      .single();

    if (orgError) {
      return res.status(400).json({ error: orgError.message });
    }

    await admin.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
    });

    await admin.from("outlets").insert({
      organization_id: org.id,
      name: outletName,
      is_default: true,
    });

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 14); // Trial 14 hari
    await admin.from("subscriptions").insert({
      organization_id: org.id,
      plan_id: FREE_PLAN_ID,
      status: "trialing",
      current_period_end: periodEnd.toISOString(),
    });

    return res.json({ organizationId: org.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- Generate shop link (auth required) ---
app.post("/api/customers/:id/generate-shop-link", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid token" });

    const customerId = req.params.id;
    if (!customerId) return res.status(400).json({ error: "Customer ID required" });

    const orgId = req.body?.organization_id || null;
    if (!orgId) return res.status(400).json({ error: "Organization ID diperlukan. Muat ulang halaman." });

    if (!admin) return res.status(503).json({ error: "Server not configured" });

    const { data: membership } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!membership) return res.status(403).json({ error: "Anda tidak memiliki akses ke organisasi ini." });

    const { data: customer, error: custErr } = await admin
      .from("customers")
      .select("id, shop_token, organization_id")
      .eq("id", customerId)
      .eq("organization_id", orgId)
      .single();

    if (custErr || !customer) return res.status(404).json({ error: "Pelanggan tidak ditemukan" });

    let shopToken = customer.shop_token;
    if (!shopToken) {
      shopToken = generateShopToken();
      const { error: updErr } = await admin
        .from("customers")
        .update({ shop_token: shopToken, updated_at: new Date().toISOString() })
        .eq("id", customerId);
      if (updErr) return res.status(500).json({ error: "Gagal membuat link" });
    }

    const shopUrl = `${appOrigin}/shop/${shopToken}`;
    return res.json({ shopUrl, shopToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- Shop: validate token & get info (public) ---
app.get("/api/shop/:token", async (req, res) => {
  if (!admin) return res.status(503).json({ error: "Server not configured" });
  const token = req.params.token;
  if (!token) return res.status(400).json({ error: "Token required" });

  const { data: customer, error: custErr } = await admin
    .from("customers")
    .select("id, name, organization_id")
    .eq("shop_token", token)
    .single();

  if (custErr || !customer) return res.status(404).json({ error: "Link tidak valid atau sudah tidak aktif" });

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, phone")
    .eq("id", customer.organization_id)
    .single();

  const { data: outlet } = await admin
    .from("outlets")
    .select("id, name")
    .eq("organization_id", customer.organization_id)
    .eq("is_default", true)
    .limit(1)
    .single();

  return res.json({
    customer: { id: customer.id, name: customer.name },
    organization: org ? { id: org.id, name: org.name, phone: org.phone || null } : null,
    outlet: outlet ? { id: outlet.id, name: outlet.name } : null,
  });
});

// --- Shop: catalog (products + stock + prices for customer) ---
app.get("/api/shop/:token/catalog", async (req, res) => {
  if (!admin) return res.status(503).json({ error: "Server not configured" });
  const token = req.params.token;
  if (!token) return res.status(400).json({ error: "Token required" });

  const { data: customer, error: custErr } = await admin
    .from("customers")
    .select("id, organization_id")
    .eq("shop_token", token)
    .single();

  if (custErr || !customer) return res.status(404).json({ error: "Link tidak valid" });

  const orgId = customer.organization_id;
  const customerId = customer.id;

  const { data: products } = await admin
    .from("products")
    .select("id, name, stock, selling_price, is_available, default_unit_id, category_id, image_url")
    .eq("organization_id", orgId)
    .eq("is_available", true)
    .order("name");

  if (!products || products.length === 0) return res.json({ products: [], categories: [] });

  const productIds = products.map((p) => p.id);
  const [puRes, ppRes, catRes] = await Promise.all([
    admin.from("product_units").select("id, product_id, unit_id, conversion_to_base, is_base, units(name, symbol)")
      .in("product_id", productIds),
    admin.from("product_prices").select("id, product_id, unit_id, customer_id, price, price_type")
      .in("product_id", productIds),
    admin.from("menu_categories").select("id, name, sort_order")
      .eq("organization_id", orgId)
      .order("sort_order")
      .order("name"),
  ]);

  const productUnits = puRes.data || [];
  const productPrices = ppRes.data || [];
  const categories = catRes.data || [];

  function resolvePrice(product, unitId, meta) {
    const prices = meta.prices.filter((p) => p.product_id === product.id);
    const units = meta.units.filter((u) => u.product_id === product.id);
    const unitRow = units.find((u) => u.unit_id === unitId);
    if (!unitRow) return Number(product.selling_price);

    const custPrice = prices.find((p) => p.unit_id === unitId && p.customer_id === customerId);
    if (custPrice) return Number(custPrice.price);

    const retailPrice = prices.find((p) => p.unit_id === unitId && !p.customer_id && p.price_type === "retail");
    if (retailPrice) return Number(retailPrice.price);

    const anyPrice = prices.find((p) => p.unit_id === unitId && !p.customer_id);
    if (anyPrice) return Number(anyPrice.price);

    if (unitRow.is_base) return Number(product.selling_price);
    return Number(product.selling_price) * (unitRow.conversion_to_base || 1);
  }

  const meta = { units: productUnits, prices: productPrices };

  const catalog = products.map((p) => {
    const units = productUnits.filter((u) => u.product_id === p.id);
    const unitsWithSymbol = units.map((u) => ({
      id: u.id,
      unit_id: u.unit_id,
      conversion_to_base: u.conversion_to_base,
      is_base: u.is_base,
      symbol: u.units?.symbol || "pcs",
      name: u.units?.name || "Pcs",
      price: resolvePrice(p, u.unit_id, meta),
    }));
    if (unitsWithSymbol.length === 0) {
      const defUnit = {
        id: "default",
        unit_id: p.default_unit_id,
        conversion_to_base: 1,
        is_base: true,
        symbol: "pcs",
        name: "Pcs",
        price: resolvePrice(p, p.default_unit_id, meta),
      };
      unitsWithSymbol.push(defUnit);
    }
    const firstUnit = unitsWithSymbol[0];
    const price = firstUnit.price;

    return {
      id: p.id,
      name: p.name,
      stock: Number(p.stock),
      image_url: p.image_url,
      category_id: p.category_id,
      default_unit_id: p.default_unit_id,
      units: unitsWithSymbol,
      default_price: price,
      default_unit: firstUnit,
    };
  });

  return res.json({ products: catalog, categories });
});

// --- Katalog: create order (auth required, pelanggan login) ---
app.post("/api/katalog/:orgId/order", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid token" });

    const orgId = req.params.orgId;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    if (!admin) return res.status(503).json({ error: "Server not configured" });

    const { data: org } = await admin
      .from("organizations")
      .select("id, catalog_public, phone")
      .eq("id", orgId)
      .single();
    if (!org || !org.catalog_public) return res.status(403).json({ error: "Katalog tidak tersedia" });

    let customerId = null;
    const { data: custByUser } = await admin
      .from("customers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (custByUser) {
      customerId = custByUser.id;
    } else if (user.email) {
      const { data: custByEmail } = await admin
        .from("customers")
        .select("id")
        .eq("organization_id", orgId)
        .eq("email", user.email)
        .maybeSingle();
      if (custByEmail) customerId = custByEmail.id;
    }

    const { data: outlet } = await admin
      .from("outlets")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .limit(1)
      .single();
    if (!outlet) return res.status(400).json({ error: "Outlet tidak ditemukan" });

    const { items, notes } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Keranjang kosong" });
    }

    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
    const { data: products } = await admin
      .from("products")
      .select("id, name, stock, selling_price, default_unit_id")
      .in("id", productIds)
      .eq("organization_id", orgId);

    const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));

    const { data: productUnits } = await admin
      .from("product_units")
      .select("id, product_id, unit_id, conversion_to_base, is_base, units(symbol)")
      .in("product_id", productIds);

    const { data: productPrices } = await admin
      .from("product_prices")
      .select("product_id, unit_id, customer_id, price")
      .in("product_id", productIds);

    const puMap = {};
    (productUnits || []).forEach((u) => {
      if (!puMap[u.product_id]) puMap[u.product_id] = [];
      puMap[u.product_id].push(u);
    });

    function resolvePrice(product, unitId) {
      const custPrice = (productPrices || []).find(
        (p) => p.product_id === product.id && p.unit_id === unitId && p.customer_id === customerId
      );
      if (custPrice) return Number(custPrice.price);
      const units = puMap[product.id] || [];
      const unitRow = units.find((u) => u.unit_id === unitId);
      if (unitRow?.is_base) return Number(product.selling_price);
      if (unitRow) return Number(product.selling_price) * (unitRow.conversion_to_base || 1);
      return Number(product.selling_price);
    }

    const orderItems = [];
    let subtotal = 0;

    for (const it of items) {
      const product = productMap[it.product_id];
      if (!product) continue;
      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitId = it.unit_id || product.default_unit_id;
      const units = puMap[product.id] || [];
      const unitRow = unitId ? units.find((u) => u.unit_id === unitId) : units.find((u) => u.is_base) || units[0];
      const sym = unitRow?.units?.symbol || "pcs";
      const conv = unitRow?.conversion_to_base ?? 1;
      const price = resolvePrice(product, unitId || unitRow?.unit_id);

      const qtyBase = qty * conv;
      const stock = Number(product.stock ?? 0);
      if (stock < qtyBase) {
        return res.status(400).json({
          error: `Stok "${product.name}" tidak mencukupi. Tersedia: ${stock} (dalam satuan dasar)`,
        });
      }

      orderItems.push({
        product_id: product.id,
        unit_id: unitId || unitRow?.unit_id,
        name: `${product.name} (${sym})`,
        price,
        quantity: qty,
        conversion_to_base: conv,
      });
      subtotal += price * qty;
    }

    if (orderItems.length === 0) return res.status(400).json({ error: "Tidak ada item valid" });

    const discount = Math.min(Math.max(0, Number(req.body.discount) || 0), subtotal);
    const total = Math.max(0, subtotal - discount);

    const orderToken = crypto.randomBytes(16).toString("base64url").slice(0, 24);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        organization_id: orgId,
        outlet_id: outlet.id,
        created_by: user.id,
        customer_id: customerId,
        status: "pending",
        subtotal,
        tax: 0,
        discount,
        total,
        payment_method: null,
        notes: (notes && String(notes).trim()) || null,
        order_token: orderToken,
      })
      .select("id, order_token")
      .single();

    if (orderErr || !order) {
      console.error(orderErr);
      return res.status(500).json({ error: "Gagal membuat pesanan" });
    }

    const orderDetailUrl = `${appOrigin}/order/${order.order_token || order.id}`;
    const whatsappPhone = org?.phone ? String(org.phone).replace(/\D/g, "").replace(/^0/, "62") : null;

    const toInsert = orderItems.map((it) => ({
      order_id: order.id,
      menu_item_id: null,
      product_id: it.product_id,
      unit_id: it.unit_id || null,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      notes: null,
    }));

    const { error: itemsErr } = await admin.from("order_items").insert(toInsert);
    if (itemsErr) {
      await admin.from("orders").delete().eq("id", order.id);
      return res.status(500).json({ error: "Gagal menyimpan item pesanan" });
    }

    for (const it of orderItems) {
      const product = productMap[it.product_id];
      if (!product) continue;
      const qtyBase = it.quantity * it.conversion_to_base;
      const newStock = Math.max(0, Number(product.stock ?? 0) - qtyBase);
      await admin.from("products").update({ stock: newStock, updated_at: new Date().toISOString() }).eq("id", it.product_id);
      await admin.from("stock_movements").insert({
        organization_id: orgId,
        warehouse_id: null,
        product_id: it.product_id,
        type: "out",
        quantity: qtyBase,
        notes: `Pesanan katalog #${order.id.slice(0, 8)} (${it.quantity} ${it.name.split("(")[1]?.replace(")", "") || "pcs"})`,
      });
    }

    return res.json({
      orderId: order.id,
      orderToken: order.order_token,
      orderDetailUrl,
      whatsappPhone,
      total,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- Shop: create order (public) ---
app.post("/api/shop/:token/order", async (req, res) => {
  if (!admin) return res.status(503).json({ error: "Server not configured" });
  const token = req.params.token;
  if (!token) return res.status(400).json({ error: "Token required" });

  const { data: customer, error: custErr } = await admin
    .from("customers")
    .select("id, organization_id")
    .eq("shop_token", token)
    .single();

  if (custErr || !customer) return res.status(404).json({ error: "Link tidak valid" });

  const { items, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Keranjang kosong" });
  }

  const orgId = customer.organization_id;
  const customerId = customer.id;

  const { data: outlet } = await admin
    .from("outlets")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .limit(1)
    .single();

  if (!outlet) return res.status(400).json({ error: "Outlet tidak ditemukan" });

  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
  const { data: products } = await admin
    .from("products")
    .select("id, name, stock, selling_price, default_unit_id")
    .in("id", productIds)
    .eq("organization_id", orgId);

  const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));

  const { data: productUnits } = await admin
    .from("product_units")
    .select("id, product_id, unit_id, conversion_to_base, is_base, units(symbol)")
    .in("product_id", productIds);

  const { data: productPrices } = await admin
    .from("product_prices")
    .select("product_id, unit_id, customer_id, price")
    .in("product_id", productIds);

  const puMap = {};
  (productUnits || []).forEach((u) => {
    if (!puMap[u.product_id]) puMap[u.product_id] = [];
    puMap[u.product_id].push(u);
  });

  function resolvePrice(product, unitId) {
    const custPrice = (productPrices || []).find(
      (p) => p.product_id === product.id && p.unit_id === unitId && p.customer_id === customerId
    );
    if (custPrice) return Number(custPrice.price);
    const units = puMap[product.id] || [];
    const unitRow = units.find((u) => u.unit_id === unitId);
    if (unitRow?.is_base) return Number(product.selling_price);
    if (unitRow) return Number(product.selling_price) * (unitRow.conversion_to_base || 1);
    return Number(product.selling_price);
  }

  const orderItems = [];
  let subtotal = 0;

  for (const it of items) {
    const product = productMap[it.product_id];
    if (!product) continue;
    const qty = Math.max(1, Number(it.quantity) || 1);
    const unitId = it.unit_id || product.default_unit_id;
    const units = puMap[product.id] || [];
    const unitRow = unitId ? units.find((u) => u.unit_id === unitId) : units.find((u) => u.is_base) || units[0];
    const sym = unitRow?.units?.symbol || "pcs";
    const conv = unitRow?.conversion_to_base ?? 1;
    const price = resolvePrice(product, unitId || unitRow?.unit_id);

    const qtyBase = qty * conv;
    const stock = Number(product.stock ?? 0);
    if (stock < qtyBase) {
      return res.status(400).json({
        error: `Stok "${product.name}" tidak mencukupi. Tersedia: ${stock} (dalam satuan dasar)`,
      });
    }

    orderItems.push({
      product_id: product.id,
      unit_id: unitId || unitRow?.unit_id,
      name: `${product.name} (${sym})`,
      price,
      quantity: qty,
      conversion_to_base: conv,
    });
    subtotal += price * qty;
  }

  if (orderItems.length === 0) return res.status(400).json({ error: "Tidak ada item valid" });

  const discount = Math.min(Math.max(0, Number(req.body.discount) || 0), subtotal);
  const total = Math.max(0, subtotal - discount);

  const orderToken = crypto.randomBytes(16).toString("base64url").slice(0, 24);

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      organization_id: orgId,
      outlet_id: outlet.id,
      created_by: null,
      customer_id: customerId,
      status: "pending",
      subtotal,
      tax: 0,
      discount,
      total,
      payment_method: null,
      notes: (notes && String(notes).trim()) || null,
      order_token: orderToken,
    })
    .select("id, order_token")
    .single();

  if (orderErr || !order) {
    console.error(orderErr);
    return res.status(500).json({ error: "Gagal membuat pesanan" });
  }

  const { data: org } = await admin
    .from("organizations")
    .select("phone")
    .eq("id", orgId)
    .single();

  const orderDetailUrl = `${appOrigin}/order/${order.order_token || order.id}`;
  const whatsappPhone = org?.phone ? String(org.phone).replace(/\D/g, "").replace(/^0/, "62") : null;

  const toInsert = orderItems.map((it) => ({
    order_id: order.id,
    menu_item_id: null,
    product_id: it.product_id,
    unit_id: it.unit_id || null,
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    notes: null,
  }));

  const { error: itemsErr } = await admin.from("order_items").insert(toInsert);
  if (itemsErr) {
    await admin.from("orders").delete().eq("id", order.id);
    return res.status(500).json({ error: "Gagal menyimpan item pesanan" });
  }

  for (const it of orderItems) {
    const product = productMap[it.product_id];
    if (!product) continue;
    const qtyBase = it.quantity * it.conversion_to_base;
    const newStock = Math.max(0, Number(product.stock ?? 0) - qtyBase);
    await admin.from("products").update({ stock: newStock, updated_at: new Date().toISOString() }).eq("id", it.product_id);
    await admin.from("stock_movements").insert({
      organization_id: orgId,
      warehouse_id: null,
      product_id: it.product_id,
      type: "out",
      quantity: qtyBase,
      notes: `Pesanan toko online #${order.id.slice(0, 8)} (${it.quantity} ${it.name.split("(")[1]?.replace(")", "") || "pcs"})`,
    });
  }

  return res.json({
    orderId: order.id,
    orderToken: order.order_token,
    orderDetailUrl,
    whatsappPhone,
    total,
  });
});

// ========== Integrasi n8n ==========
// Middleware: validasi API key untuk route /api/n8n/*
async function n8nApiKeyAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"] || (req.headers.authorization && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (!apiKey || !admin) {
    return res.status(401).json({ error: "X-API-Key atau Authorization: Bearer <api_key> diperlukan" });
  }
  const { data: row, error } = await admin
    .from("organization_integrations")
    .select("organization_id")
    .eq("api_key", apiKey.trim())
    .maybeSingle();
  if (error || !row) return res.status(401).json({ error: "API key tidak valid" });
  req.orgIdForN8n = row.organization_id;
  next();
}

// GET /api/n8n/orders - daftar order (query: since, until, limit)
app.get("/api/n8n/orders", n8nApiKeyAuth, async (req, res) => {
  try {
    const orgId = req.orgIdForN8n;
    const since = req.query.since || null;
    const until = req.query.until || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    let q = admin.from("orders").select("id, status, subtotal, discount, total, payment_method, notes, created_at, customer_id, outlet_id").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lte("created_at", until);
    const { data: orders, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const ids = (orders || []).map((o) => o.id);
    if (ids.length === 0) return res.json({ orders: [] });
    const { data: items } = await admin.from("order_items").select("order_id, product_id, name, price, quantity").in("order_id", ids);
    const byOrder = {};
    (items || []).forEach((i) => {
      if (!byOrder[i.order_id]) byOrder[i.order_id] = [];
      byOrder[i.order_id].push(i);
    });
    const result = (orders || []).map((o) => ({ ...o, items: byOrder[o.id] || [] }));
    return res.json({ orders: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// GET /api/n8n/products
app.get("/api/n8n/products", n8nApiKeyAuth, async (req, res) => {
  try {
    const orgId = req.orgIdForN8n;
    const { data, error } = await admin.from("products").select("id, name, code, barcode, stock, cost_price, selling_price, is_available, created_at").eq("organization_id", orgId).order("name");
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ products: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// GET /api/n8n/customers
app.get("/api/n8n/customers", n8nApiKeyAuth, async (req, res) => {
  try {
    const orgId = req.orgIdForN8n;
    const { data, error } = await admin.from("customers").select("id, name, email, phone, created_at").eq("organization_id", orgId).order("name");
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ customers: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// GET /api/n8n/cash-flows (arus kas)
app.get("/api/n8n/cash-flows", n8nApiKeyAuth, async (req, res) => {
  try {
    const orgId = req.orgIdForN8n;
    const since = req.query.since || null;
    const until = req.query.until || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    let q = admin.from("cash_flows").select("id, type, amount, description, reference_type, reference_id, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lte("created_at", until);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ cash_flows: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- App (auth): dapatkan/simpan pengaturan n8n ---
app.get("/api/integrations/n8n", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid token" });
    const orgId = req.query.organization_id;
    if (!orgId) return res.status(400).json({ error: "organization_id diperlukan" });
    if (!admin) return res.status(503).json({ error: "Server not configured" });
    const { data: membership } = await admin.from("organization_members").select("organization_id").eq("user_id", user.id).eq("organization_id", orgId).maybeSingle();
    if (!membership) return res.status(403).json({ error: "Akses ditolak" });
    const { data: row } = await admin.from("organization_integrations").select("n8n_webhook_url, api_key").eq("organization_id", orgId).maybeSingle();
    return res.json({
      n8n_webhook_url: row?.n8n_webhook_url || "",
      has_api_key: !!(row?.api_key),
      api_key_prefix: row?.api_key ? row.api_key.slice(-4) : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/integrations/n8n", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid token" });
    const { organization_id: orgId, n8n_webhook_url: url } = req.body || {};
    if (!orgId) return res.status(400).json({ error: "organization_id diperlukan" });
    if (!admin) return res.status(503).json({ error: "Server not configured" });
    const { data: membership } = await admin.from("organization_members").select("organization_id").eq("user_id", user.id).eq("organization_id", orgId).maybeSingle();
    if (!membership) return res.status(403).json({ error: "Akses ditolak" });
    const webhookUrl = typeof url === "string" ? url.trim() || null : null;
    const { data: existing } = await admin.from("organization_integrations").select("organization_id").eq("organization_id", orgId).maybeSingle();
    const now = new Date().toISOString();
    if (existing) {
      const { error: updErr } = await admin.from("organization_integrations").update({ n8n_webhook_url: webhookUrl, updated_at: now }).eq("organization_id", orgId);
      if (updErr) return res.status(500).json({ error: updErr.message });
    } else {
      const { error: insErr } = await admin.from("organization_integrations").insert({ organization_id: orgId, n8n_webhook_url: webhookUrl, updated_at: now });
      if (insErr) return res.status(500).json({ error: insErr.message });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

app.post("/api/integrations/n8n/api-key", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid token" });
    const { organization_id: orgId } = req.body || {};
    if (!orgId) return res.status(400).json({ error: "organization_id diperlukan" });
    if (!admin) return res.status(503).json({ error: "Server not configured" });
    const { data: membership } = await admin.from("organization_members").select("organization_id").eq("user_id", user.id).eq("organization_id", orgId).maybeSingle();
    if (!membership) return res.status(403).json({ error: "Akses ditolak" });
    const apiKey = "hisabia_" + crypto.randomBytes(24).toString("base64url");
    const now = new Date().toISOString();
    const { data: existing } = await admin.from("organization_integrations").select("organization_id").eq("organization_id", orgId).maybeSingle();
    if (existing) {
      const { error: updErr } = await admin.from("organization_integrations").update({ api_key: apiKey, updated_at: now }).eq("organization_id", orgId);
      if (updErr) return res.status(500).json({ error: updErr.message });
    } else {
      const { error: insErr } = await admin.from("organization_integrations").insert({ organization_id: orgId, api_key: apiKey, updated_at: now });
      if (insErr) return res.status(500).json({ error: insErr.message });
    }
    return res.json({ api_key: apiKey });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Notify n8n webhook (dipanggil dari app setelah event, mis. order created)
app.post("/api/integrations/n8n/notify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon).auth;
    const { data: { user }, error: userError } = await supabaseAuth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid token" });
    const { organization_id: orgId, event, payload } = req.body || {};
    if (!orgId || !event) return res.status(400).json({ error: "organization_id dan event diperlukan" });
    if (!admin) return res.status(503).json({ error: "Server not configured" });
    const { data: membership } = await admin.from("organization_members").select("organization_id").eq("user_id", user.id).eq("organization_id", orgId).maybeSingle();
    if (!membership) return res.status(403).json({ error: "Akses ditolak" });
    const { data: row } = await admin.from("organization_integrations").select("n8n_webhook_url").eq("organization_id", orgId).maybeSingle();
    const webhookUrl = row?.n8n_webhook_url?.trim();
    if (!webhookUrl) return res.json({ ok: true, sent: false });
    const body = JSON.stringify({ event, payload: payload || {}, timestamp: new Date().toISOString() });
    const fetchRes = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
    return res.json({ ok: true, sent: true, status: fetchRes?.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- Public: order detail by token ---
app.get("/api/order/:token", async (req, res) => {
  if (!admin) return res.status(503).json({ error: "Server not configured" });
  const token = req.params.token;
  if (!token) return res.status(400).json({ error: "Token required" });

  const { data: byToken } = await admin
    .from("orders")
    .select("id, customer_id, organization_id, status, subtotal, discount, total, notes, created_at, order_token")
    .eq("order_token", token)
    .maybeSingle();

  let order = byToken;
  if (!order) {
    const { data: byId } = await admin
      .from("orders")
      .select("id, customer_id, organization_id, status, subtotal, discount, total, notes, created_at, order_token")
      .eq("id", token)
      .maybeSingle();
    order = byId;
  }

  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });

  const { data: items } = await admin
    .from("order_items")
    .select("name, price, quantity")
    .eq("order_id", order.id)
    .order("created_at");

  const { data: customer } = await admin
    .from("customers")
    .select("name")
    .eq("id", order.customer_id)
    .single();

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", order.organization_id)
    .single();

  return res.json({
    id: order.id,
    order_token: order.order_token,
    status: order.status,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount || 0),
    total: Number(order.total),
    notes: order.notes,
    created_at: order.created_at,
    customer_name: customer?.name || null,
    organization_name: org?.name || null,
    items: (items || []).map((i) => ({
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
    })),
  });
});

// Jalan sebagai server hanya di luar Vercel (lokal / Railway / Render)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default app;

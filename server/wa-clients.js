/**
 * WhatsApp Web clients per outlet (whatsapp-web.js)
 * Setiap outlet dapat mengoneksikan WA sendiri via scan QR
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let Client = null;
let LocalAuth = null;
let loaded = false;

async function loadLib() {
  if (loaded) return;
  try {
    const wweb = await import("whatsapp-web.js");
    Client = wweb.Client;
    LocalAuth = wweb.LocalAuth;
  } catch (e) {
    console.warn("whatsapp-web.js not installed. Run: npm install whatsapp-web.js");
  }
  loaded = true;
}

loadLib().catch(() => {});

const clients = new Map();
const qrStore = new Map();
const statusStore = new Map();

function getClientId(outletId) {
  return String(outletId).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getStatus(outletId) {
  return statusStore.get(outletId) || { status: "disconnected" };
}

function setStatus(outletId, status, data = {}) {
  statusStore.set(outletId, { status, ...data });
}

async function connect(outletId) {
  await loadLib();
  if (!Client || !LocalAuth) {
    throw new Error("whatsapp-web.js tidak terpasang. Jalankan: npm install whatsapp-web.js");
  }
  if (clients.has(outletId)) {
    const st = getStatus(outletId);
    if (st.status === "connected") return { status: "connected" };
    if (st.status === "connecting") return st;
  }

  const clientId = getClientId(outletId);
  const dataPath = path.join(process.cwd(), ".wwebjs_auth");

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath,
    }),
    puppeteer: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
      ],
      headless: true,
    },
  });

  clients.set(outletId, client);
  setStatus(outletId, "connecting");

  client.on("qr", (qr) => {
    qrStore.set(outletId, { qr, ts: Date.now() });
    setStatus(outletId, "qr_pending", { qr });
  });

  client.on("ready", () => {
    qrStore.delete(outletId);
    setStatus(outletId, "connected");
  });

  client.on("auth_failure", () => {
    setStatus(outletId, "auth_failure");
    clients.delete(outletId);
  });

  client.on("disconnected", () => {
    setStatus(outletId, "disconnected");
    clients.delete(outletId);
  });

  await client.initialize();
  return getStatus(outletId);
}

async function disconnect(outletId) {
  const client = clients.get(outletId);
  if (client) {
    try {
      await client.destroy();
    } catch (e) {
      console.error("WA disconnect error:", e);
    }
    clients.delete(outletId);
  }
  qrStore.delete(outletId);
  setStatus(outletId, "disconnected");
}

function getStatusForApi(outletId) {
  const st = getStatus(outletId);
  const qr = qrStore.get(outletId);
  if (qr && Date.now() - qr.ts < 60000) {
    return { ...st, qr: qr.qr };
  }
  return { ...st, qr: st.qr || null };
}

async function sendMessage(outletId, phoneNumber, message) {
  const client = clients.get(outletId);
  if (!client) {
    throw new Error("WhatsApp outlet belum terhubung");
  }
  const status = getStatus(outletId);
  if (status.status !== "connected") {
    throw new Error("WhatsApp outlet belum siap");
  }

  let phone = String(phoneNumber).replace(/\D/g, "");
  if (phone.startsWith("0")) {
    phone = "62" + phone.slice(1);
  } else if (!phone.startsWith("62")) {
    phone = "62" + phone;
  }
  const chatId = phone + "@c.us";
  await client.sendMessage(chatId, message);
  return { success: true };
}

export {
  connect,
  disconnect,
  getStatus: getStatusForApi,
  sendMessage,
};
export function isAvailable() {
  return !!Client;
}

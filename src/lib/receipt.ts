/**
 * Struk cetak: untuk dialog print (USB/Bluetooth sebagai printer sistem)
 * dan ESC/POS untuk thermal Bluetooth (Web Bluetooth).
 */

export const RECEIPT_PRINTER_STORAGE_KEY = "hisabia-receipt-printer-type";
export const RECEIPT_LOCAL_URL_STORAGE_KEY = "hisabia-receipt-local-url";
export type ReceiptPrinterType = "dialog" | "bluetooth" | "local";

export function getReceiptPrinterType(): ReceiptPrinterType {
  try {
    const v = localStorage.getItem(RECEIPT_PRINTER_STORAGE_KEY);
    if (v === "dialog" || v === "bluetooth" || v === "local") return v;
  } catch {}
  return "dialog";
}

export function setReceiptPrinterType(value: ReceiptPrinterType): void {
  try {
    localStorage.setItem(RECEIPT_PRINTER_STORAGE_KEY, value);
  } catch {}
}

export function getReceiptLocalUrl(): string {
  try {
    return localStorage.getItem(RECEIPT_LOCAL_URL_STORAGE_KEY) ?? "http://localhost:3999";
  } catch {}
  return "http://localhost:3999";
}

export function setReceiptLocalUrl(url: string): void {
  try {
    localStorage.setItem(RECEIPT_LOCAL_URL_STORAGE_KEY, url.trim() || "http://localhost:3999");
  } catch {}
}

export interface ReceiptItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
  lineTotal: number;
}

export interface ReceiptData {
  orderId: string;
  outletName: string;
  date: Date;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  notes?: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Tunai",
  credit: "Hutang",
  transfer: "Transfer",
  qris: "QRIS",
  ewallet: "E-Wallet",
};

function formatIdrReceipt(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** HTML untuk print dialog (browser) — cocok thermal 80mm jika user pilih printer thermal. */
export function buildReceiptHtml(data: ReceiptData): string {
  const width = "80mm";
  const dateStr = data.date.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;

  const rows = data.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:2px 0;border-bottom:1px dotted #999">${escapeHtml(i.name)}</td>
          <td style="text-align:right;white-space:nowrap;padding:2px 0;border-bottom:1px dotted #999">${i.qty} ${escapeHtml(i.unit)} × ${formatIdrReceipt(i.price)}</td>
        </tr>
        <tr>
          <td colspan="2" style="text-align:right;padding:0 0 4px 0;border-bottom:1px dotted #999">${formatIdrReceipt(i.lineTotal)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Struk ${escapeHtml(data.orderId)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace, 'Courier New', sans-serif; font-size: 12px; line-height: 1.35; padding: 8px; max-width: ${width}; margin: 0 auto; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .mt { margin-top: 6px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="margin-bottom:6px">${escapeHtml(data.outletName)}</div>
  <div class="center" style="font-size:10px">${escapeHtml(dateStr)}</div>
  <div class="center" style="font-size:10px;margin-top:2px">#${escapeHtml(data.orderId)}</div>
  <div class="divider"></div>
  <table>
    ${rows}
  </table>
  <div class="divider"></div>
  <table style="font-size:11px">
    <tr><td>Subtotal</td><td style="text-align:right">${formatIdrReceipt(data.subtotal)}</td></tr>
    ${data.discount > 0 ? `<tr><td>Diskon</td><td style="text-align:right">-${formatIdrReceipt(data.discount)}</td></tr>` : ""}
    <tr class="bold"><td>Total</td><td style="text-align:right">${formatIdrReceipt(data.total)}</td></tr>
    <tr><td>Bayar</td><td style="text-align:right">${escapeHtml(paymentLabel)}</td></tr>
  </table>
  ${data.notes ? `<div class="mt" style="font-size:10px">${escapeHtml(data.notes)}</div>` : ""}
  <div class="divider"></div>
  <div class="center" style="font-size:11px;margin-top:8px">Terima kasih</div>
  <div class="no-print" style="margin-top:16px;text-align:center">
    <button type="button" onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer">Cetak</button>
    <button type="button" onclick="window.close()" style="padding:8px 16px;font-size:14px;margin-left:8px;cursor:pointer">Tutup</button>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ESC/POS bytes untuk thermal Bluetooth (Web Bluetooth). */
export function buildEscPosBytes(data: ReceiptData): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;
  const lines: number[] = [];

  function addBytes(...arr: number[]) {
    lines.push(...arr);
  }
  function addStr(s: string) {
    const enc = new TextEncoder().encode(s);
    for (let i = 0; i < enc.length; i++) lines.push(enc[i]);
  }
  function addLine(s: string) {
    addStr(s);
    addBytes(LF);
  }

  addBytes(ESC, 0x40);
  addBytes(ESC, 0x61, 1);
  addLine(data.outletName);
  addBytes(ESC, 0x61, 0);
  addLine(data.date.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }));
  addLine("#" + data.orderId);
  addLine("--------------------------------");
  addBytes(ESC, 0x61, 0);
  for (const i of data.items) {
    addLine(i.name.length > 28 ? i.name.slice(0, 25) + "..." : i.name);
    addStr(`  ${i.qty} ${i.unit} x ${formatIdrReceipt(i.price)}`);
    addBytes(LF);
    addStr("  " + formatIdrReceipt(i.lineTotal));
    addBytes(LF);
  }
  addLine("--------------------------------");
  addLine(`Subtotal   ${formatIdrReceipt(data.subtotal)}`);
  if (data.discount > 0) addLine(`Diskon     -${formatIdrReceipt(data.discount)}`);
  addBytes(ESC, 0x45, 1);
  addLine(`TOTAL      ${formatIdrReceipt(data.total)}`);
  addBytes(ESC, 0x45, 0);
  addLine(`Bayar      ${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}`);
  addBytes(LF);
  addBytes(ESC, 0x61, 1);
  addLine("Terima kasih");
  addBytes(ESC, 0x61, 0);
  addBytes(LF, LF, LF);
  addBytes(GS, 0x56, 0);
  return new Uint8Array(lines);
}

/** Buka jendela print (untuk USB/Bluetooth thermal yang terpasang sebagai printer sistem). */
export function printReceiptInWindow(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const w = window.open("", "_blank", "width=400,height=600,scrollbars=yes");
  if (!w) {
    alert("Izinkan pop-up untuk cetak struk.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

const BLE_PRINTER_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Nordic UART
];

const CHUNK_SIZE = 100;

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: { filters: unknown[]; optionalServices: string[] }): Promise<{ gatt: { connect(): Promise<BluetoothGATTServer> } }>;
    };
  }
}
interface BluetoothGATTServer {
  getPrimaryService(uuid: string): Promise<{
    getCharacteristics(): Promise<{ properties: { writeWithoutResponse: boolean; write: boolean }; writeValueWithoutResponse(data: BufferSource): Promise<void>; writeValueWithResponse(data: BufferSource): Promise<void> }[]>;
  }>;
  disconnect(): void;
}

/** Cetak struk ke printer thermal Bluetooth via Web Bluetooth API. */
export async function printReceiptBluetooth(data: ReceiptData): Promise<void> {
  if (!navigator.bluetooth) {
    throw new Error("Browser tidak mendukung Bluetooth. Gunakan Chrome/Edge dan pastikan HTTPS.");
  }
  const bytes = buildEscPosBytes(data);
  const device = await navigator.bluetooth.requestDevice({
    filters: [],
    optionalServices: BLE_PRINTER_SERVICES,
  });
  const server = await device.gatt!.connect();
  type Char = { properties: { writeWithoutResponse: boolean; write: boolean }; writeValueWithoutResponse(data: BufferSource): Promise<void>; writeValueWithResponse(data: BufferSource): Promise<void> };
  let characteristic: Char | null = null;
  for (const uuid of BLE_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find(
        (c: Char) => c.properties.writeWithoutResponse || c.properties.write
      );
      if (writable) {
        characteristic = writable;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!characteristic) {
    server.disconnect();
    throw new Error("Tidak menemukan karakteristik tulis pada printer.");
  }
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValueWithResponse(chunk);
    }
  }
  server.disconnect();
}

/** Kirim data struk ke app lokal (localhost) untuk cetak direct tanpa dialog. */
export async function printReceiptLocal(data: ReceiptData, baseUrl: string): Promise<void> {
  const url = baseUrl.replace(/\/+$/, "") + "/print";
  const body = {
    orderId: data.orderId,
    outletName: data.outletName,
    date: data.date.toISOString(),
    items: data.items,
    subtotal: data.subtotal,
    discount: data.discount,
    total: data.total,
    paymentMethod: data.paymentMethod,
    notes: data.notes,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Cetak gagal (${res.status})`);
  }
}

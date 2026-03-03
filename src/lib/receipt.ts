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

/** Id blok struk (konsep canvas). */
export type ReceiptBlockId =
  | "header"
  | "address"
  | "dateCashier"
  | "status"
  | "items"
  | "total"
  | "notes"
  | "footer";

export type ReceiptAlignment = "left" | "center";

/** Layout per blok: alignment, garis pemisah, jarak sebelum & setelah. */
export interface ReceiptBlockLayout {
  alignment: ReceiptAlignment;
  separatorBefore: boolean;
  separatorAfter: boolean;
  linesBefore: 0 | 1 | 2;
  linesAfter: 0 | 1 | 2;
}

export const DEFAULT_BLOCK_LAYOUT: Record<ReceiptBlockId, ReceiptBlockLayout> = {
  header: { alignment: "center", separatorBefore: false, separatorAfter: true, linesBefore: 0, linesAfter: 0 },
  address: { alignment: "left", separatorBefore: false, separatorAfter: true, linesBefore: 0, linesAfter: 0 },
  dateCashier: { alignment: "left", separatorBefore: false, separatorAfter: true, linesBefore: 0, linesAfter: 0 },
  status: { alignment: "center", separatorBefore: false, separatorAfter: true, linesBefore: 0, linesAfter: 0 },
  items: { alignment: "left", separatorBefore: false, separatorAfter: true, linesBefore: 0, linesAfter: 0 },
  total: { alignment: "left", separatorBefore: false, separatorAfter: true, linesBefore: 0, linesAfter: 0 },
  notes: { alignment: "left", separatorBefore: false, separatorAfter: true, linesBefore: 0, linesAfter: 0 },
  footer: { alignment: "center", separatorBefore: true, separatorAfter: false, linesBefore: 0, linesAfter: 0 },
};

/** Pengaturan template struk (konsep canvas). Disimpan per outlet di localStorage. */
export interface ReceiptSettings {
  storeName: string;
  address: string;
  showDate: boolean;
  showTime: boolean;
  dateTimeFormatLong: boolean;
  cashierLabel: string;
  showCashier: boolean;
  statusPaidText: string;
  showPaymentMethodLine: boolean;
  showTotalBayar: boolean;
  showKembalian: boolean;
  footerInstagram: string;
  footerWifi: string;
  /** Layout per blok (alignment, pemisah, jarak). Kosong = pakai default. */
  blockLayout?: Partial<Record<ReceiptBlockId, Partial<ReceiptBlockLayout>>>;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  storeName: "",
  address: "",
  showDate: true,
  showTime: true,
  dateTimeFormatLong: true,
  cashierLabel: "Kasir",
  showCashier: true,
  statusPaidText: "# LUNAS #",
  showPaymentMethodLine: true,
  showTotalBayar: true,
  showKembalian: true,
  footerInstagram: "",
  footerWifi: "",
};

function getBlockLayout(opt: ReceiptSettings, blockId: ReceiptBlockId): ReceiptBlockLayout {
  const custom = opt.blockLayout?.[blockId];
  return { ...DEFAULT_BLOCK_LAYOUT[blockId], ...custom };
}

const RECEIPT_SETTINGS_PREFIX = "hisabia-receipt-settings-";

export function getReceiptSettings(outletId: string): ReceiptSettings {
  try {
    const raw = localStorage.getItem(RECEIPT_SETTINGS_PREFIX + outletId);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const { footerPoweredBy: _drop, notesLabel: _drop2, ...rest } = parsed;
      return { ...DEFAULT_RECEIPT_SETTINGS, ...rest } as ReceiptSettings;
    }
  } catch {}
  return { ...DEFAULT_RECEIPT_SETTINGS };
}

export function setReceiptSettings(outletId: string, s: Partial<ReceiptSettings>): void {
  try {
    const merged = { ...getReceiptSettings(outletId), ...s };
    localStorage.setItem(RECEIPT_SETTINGS_PREFIX + outletId, JSON.stringify(merged));
  } catch {}
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
  /** Nama kasir (untuk baris Kasir ... di struk). */
  cashierName?: string;
  /** Uang diterima (tunai) untuk hitung kembalian. */
  cashReceived?: number;
  /** Pengaturan template struk (dari Pengaturan Struk). Jika ada, layout ala Kelana. */
  receiptSettings?: ReceiptSettings;
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

/** Format nominal untuk ESC/POS: hanya ASCII "Rp" + angka (tanpa karakter unik dari locale). */
function formatIdrEscPos(n: number): string {
  const num = Math.round(n);
  const s = num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return "Rp" + s.replace(/\s/g, "");
}

function buildReceiptHtmlKelana(data: ReceiptData): string {
  const width = "80mm";
  const opt = data.receiptSettings!;
  const L = (id: ReceiptBlockId) => getBlockLayout(opt, id);
  const storeName = opt.storeName.trim() || data.outletName;
  const dateStr = opt.dateTimeFormatLong
    ? data.date.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " +
      data.date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : data.date.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;
  const cashReceived = data.cashReceived ?? data.total;
  const kembalian = data.paymentMethod === "cash" ? Math.max(0, cashReceived - data.total) : 0;

  const itemRows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:2px 0">${escapeHtml(i.name)}</td><td style="text-align:right;white-space:nowrap;padding:2px 0">${formatIdrReceipt(i.lineTotal)}</td></tr>
        <tr><td style="padding:0 0 4px 8px;font-size:10px" colspan="2">${i.qty} x ${formatIdrReceipt(i.price)}</td></tr>`
    )
    .join("");

  const footerLines: string[] = [];
  if (opt.footerInstagram.trim()) footerLines.push(escapeHtml(opt.footerInstagram.trim()));
  if (opt.footerWifi.trim()) footerLines.push(escapeHtml(opt.footerWifi.trim()));
  footerLines.push("Powered By Hisabia");

  const sep = '<div class="divider"></div>';
  const align = (a: ReceiptAlignment) => (a === "center" ? "text-align:center" : "text-align:left");
  const space = (n: number) => (n > 0 ? `<div style="height:${n * 4}px"></div>` : "");

  let body = "";
  const wrap = (blockId: ReceiptBlockId, content: string) => {
    const lay = L(blockId);
    body += space(lay.linesBefore);
    if (lay.separatorBefore) body += sep;
    body += content;
    if (lay.separatorAfter) body += sep;
    body += space(lay.linesAfter);
  };

  wrap("header", `<div class="block" style="${align(L("header").alignment)}"><span class="bold" style="font-size:14px">${escapeHtml(storeName)}</span></div>`);

  if (opt.address.trim()) {
    wrap("address", `<div class="block" style="font-size:10px;line-height:1.4;${align(L("address").alignment)}">${escapeHtml(opt.address.trim()).replace(/\n/g, "<br>")}</div>`);
  }
  if (opt.showDate || opt.showTime || (opt.showCashier && data.cashierName)) {
    let dateCashierContent = "";
    if (opt.showDate || opt.showTime) dateCashierContent += `<div style="font-size:11px">${escapeHtml(dateStr)}</div>`;
    if (opt.showCashier && data.cashierName) dateCashierContent += `<div style="display:flex;justify-content:space-between;font-size:11px"><span>${escapeHtml(opt.cashierLabel)}</span><span>${escapeHtml(data.cashierName)}</span></div>`;
    wrap("dateCashier", `<div class="block" style="${align(L("dateCashier").alignment)}">${dateCashierContent}</div>`);
  }
  wrap("status", `<div class="block" style="${align(L("status").alignment)}"><span class="bold" style="font-size:13px">${escapeHtml(opt.statusPaidText)}</span></div>`);
  wrap("items", `<div class="block"><table>${itemRows}</table></div>`);
  wrap(
    "total",
    `<div class="block"><table style="font-size:11px;width:100%">
    <tr><td>TOTAL</td><td style="text-align:right" class="bold">${formatIdrReceipt(data.total)}</td></tr>
    ${opt.showPaymentMethodLine ? `<tr><td>Pembayaran ${escapeHtml(paymentLabel)}</td><td style="text-align:right">${formatIdrReceipt(data.paymentMethod === "cash" ? cashReceived : data.total)}</td></tr>` : ""}
    ${opt.showTotalBayar ? `<tr><td>Total Bayar</td><td style="text-align:right">${formatIdrReceipt(data.paymentMethod === "cash" ? cashReceived : data.total)}</td></tr>` : ""}
    ${opt.showKembalian ? `<tr><td>Kembalian</td><td style="text-align:right">${formatIdrReceipt(kembalian)}</td></tr>` : ""}
  </table></div>`
  );
  if (data.notes) wrap("notes", `<div class="block" style="font-size:10px;${align(L("notes").alignment)}">Keterangan: ${escapeHtml(data.notes)}</div>`);
  wrap("footer", `<div class="block" style="font-size:10px;line-height:1.4;${align(L("footer").alignment)}">${footerLines.join("<br>")}</div>`);

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Struk ${escapeHtml(data.orderId)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace, 'Courier New', sans-serif; font-size: 12px; line-height: 1.4; padding: 8px; max-width: ${width}; margin: 0 auto; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    .divider { border-top: 1px dashed #000; margin: 0; }
    .block { margin: 0; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  ${body}
  <div class="no-print" style="margin-top:16px;text-align:center">
    <button type="button" onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer">Cetak</button>
    <button type="button" onclick="window.close()" style="padding:8px 16px;font-size:14px;margin-left:8px;cursor:pointer">Tutup</button>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

/** HTML untuk print dialog (browser) — cocok thermal 80mm jika user pilih printer thermal. */
export function buildReceiptHtml(data: ReceiptData): string {
  if (data.receiptSettings) return buildReceiptHtmlKelana(data);

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

const ESC_POS_WIDTH = 32;

/** ESC/POS: satu baris teks kiri + teks kanan (padding di tengah). */
function escPosLineLR(_lines: number[], addStr: (s: string) => void, addBytes: (...arr: number[]) => void, left: string, right: string) {
  const LF = 0x0a;
  const pad = Math.max(0, ESC_POS_WIDTH - left.length - right.length);
  addStr(left);
  for (let i = 0; i < pad; i++) addStr(" ");
  addStr(right);
  addBytes(LF);
}

/** ESC/POS bytes layout Kelana: pakai blockLayout (alignment, separator, linesAfter) sama seperti preview. */
function buildEscPosBytesKelana(data: ReceiptData): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;
  const lines: number[] = [];
  const addBytes = (...arr: number[]) => lines.push(...arr);
  const addStr = (s: string) => {
    const enc = new TextEncoder().encode(s);
    for (let i = 0; i < enc.length; i++) lines.push(enc[i]);
  };
  const addLine = (s: string) => {
    addStr(s);
    addBytes(LF);
  };
  const opt = data.receiptSettings!;
  const L = (id: ReceiptBlockId) => getBlockLayout(opt, id);
  const storeName = opt.storeName.trim() || data.outletName;
  const dateStr = opt.dateTimeFormatLong
    ? data.date.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " +
      data.date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : data.date.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;
  const cashReceived = data.cashReceived ?? data.total;
  const kembalian = data.paymentMethod === "cash" ? Math.max(0, cashReceived - data.total) : 0;
  const sep = "--------------------------------";

  const wrap = (blockId: ReceiptBlockId, fn: () => void) => {
    const lay = L(blockId);
    for (let i = 0; i < lay.linesBefore; i++) addBytes(LF);
    if (lay.separatorBefore) {
      addLine(sep);
      addBytes(LF);
    }
    addBytes(ESC, 0x61, lay.alignment === "center" ? 1 : 0);
    fn();
    addBytes(ESC, 0x61, 0);
    if (lay.separatorAfter) {
      addLine(sep);
      addBytes(LF);
    }
    for (let i = 0; i < lay.linesAfter; i++) addBytes(LF);
  };

  addBytes(ESC, 0x40);
  wrap("header", () => addLine(storeName.length > ESC_POS_WIDTH ? storeName.slice(0, ESC_POS_WIDTH - 3) + "..." : storeName));

  if (opt.address.trim()) {
    wrap("address", () => opt.address.trim().split("\n").forEach((line) => addLine(line.slice(0, ESC_POS_WIDTH))));
  }
  if (opt.showDate || opt.showTime || (opt.showCashier && data.cashierName)) {
    wrap("dateCashier", () => {
      if (opt.showDate || opt.showTime) addLine(dateStr);
      if (opt.showCashier && data.cashierName) escPosLineLR(lines, addStr, addBytes, opt.cashierLabel, data.cashierName);
    });
  }
  wrap("status", () => addLine(opt.statusPaidText));

  wrap("items", () => {
    for (const i of data.items) {
      const name = i.name.length > 20 ? i.name.slice(0, 17) + "..." : i.name;
      addBytes(ESC, 0x61, 0);
      escPosLineLR(lines, addStr, addBytes, name, formatIdrEscPos(i.lineTotal));
      addStr("  " + i.qty + " x " + formatIdrEscPos(i.price));
      addBytes(LF);
    }
  });

  wrap("total", () => {
    escPosLineLR(lines, addStr, addBytes, "TOTAL", formatIdrEscPos(data.total));
    if (opt.showPaymentMethodLine) escPosLineLR(lines, addStr, addBytes, "Pembayaran " + paymentLabel, formatIdrEscPos(data.paymentMethod === "cash" ? cashReceived : data.total));
    if (opt.showTotalBayar) escPosLineLR(lines, addStr, addBytes, "Total Bayar", formatIdrEscPos(data.paymentMethod === "cash" ? cashReceived : data.total));
    if (opt.showKembalian) escPosLineLR(lines, addStr, addBytes, "Kembalian", formatIdrEscPos(kembalian));
  });

  if (data.notes) wrap("notes", () => addLine("Keterangan: " + data.notes));

  wrap("footer", () => {
    if (opt.footerInstagram.trim()) addLine(opt.footerInstagram.trim());
    if (opt.footerWifi.trim()) addLine(opt.footerWifi.trim());
    addLine("Powered By Hisabia");
  });

  addBytes(LF, LF, LF);
  addBytes(GS, 0x56, 0);
  return new Uint8Array(lines);
}

/** ESC/POS bytes untuk thermal Bluetooth (Web Bluetooth). */
export function buildEscPosBytes(data: ReceiptData): Uint8Array {
  if (data.receiptSettings) return buildEscPosBytesKelana(data);

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
    addStr(`  ${i.qty} ${i.unit} x ${formatIdrEscPos(i.price)}`);
    addBytes(LF);
    addStr("  " + formatIdrEscPos(i.lineTotal));
    addBytes(LF);
  }
  addLine("--------------------------------");
  addLine(`Subtotal   ${formatIdrEscPos(data.subtotal)}`);
  if (data.discount > 0) addLine(`Diskon     -${formatIdrEscPos(data.discount)}`);
  addBytes(ESC, 0x45, 1);
  addLine(`TOTAL      ${formatIdrEscPos(data.total)}`);
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

/** Service UUID yang umum dipakai printer thermal BLE (ESC/POS). */
export const BLE_PRINTER_SERVICES = [
  "0000ae30-0000-1000-8000-00805f9b34fb", // RPP02N, RPP02N sejenis, banyak printer thermal BLE (char write: ae01)
  "0000ae3a-0000-1000-8000-00805f9b34fb", // Varian lain printer thermal BLE
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Nordic UART
];

const CHUNK_SIZE = 100;

type WritableCharacteristic = {
  properties: { writeWithoutResponse: boolean; write: boolean };
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
  writeValueWithResponse(data: BufferSource): Promise<void>;
};

/** Koneksi BLE printer struk yang dihubungkan sekali di Pengaturan Toko. */
let receiptBleCache: {
  server: BluetoothRemoteGATTServer;
  characteristic: WritableCharacteristic;
} | null = null;

function clearReceiptBleCache() {
  receiptBleCache = null;
}

/** Cek apakah printer struk BLE sudah terhubung (dari Pengaturan). */
export function getReceiptBluetoothConnection(): boolean {
  if (!receiptBleCache?.server?.connected) return false;
  return true;
}

const BLE_CONNECT_TIMEOUT_MS = 20000;

/**
 * Hubungkan printer struk thermal BLE (dipanggil dari Pengaturan Toko).
 * Pilih device dari dialog, lalu koneksi disimpan untuk cetak dari POS.
 */
export async function connectReceiptBluetooth(): Promise<void> {
  if (!navigator.bluetooth) {
    throw new Error("Browser tidak mendukung Bluetooth. Gunakan Chrome/Edge dan pastikan HTTPS.");
  }
  if (receiptBleCache?.server?.connected) return;

  // Filter by service UUID agar hanya perangkat yang mengiklankan service printer yang muncul.
  // Jika printer tidak muncul, gunakan acceptAllDevices (lihat blok catch di bawah).
  let device: BluetoothDevice;
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: BLE_PRINTER_SERVICES.map((uuid) => ({ services: [uuid] })),
      optionalServices: BLE_PRINTER_SERVICES,
    });
  } catch (filterErr) {
    // Banyak printer thermal tidak mengiklankan service UUID; tampilkan semua perangkat.
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_PRINTER_SERVICES,
    });
  }
  device.addEventListener("gattserverdisconnected", () => clearReceiptBleCache());

  const connectWithTimeout = (): Promise<BluetoothRemoteGATTServer> => {
    const gatt = device.gatt;
    if (!gatt) return Promise.reject(new Error("Perangkat tidak mendukung GATT."));
    return Promise.race([
      gatt.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Koneksi timeout. Pastikan printer menyala, dalam jangkauan, dan tidak terhubung ke perangkat lain.")),
          BLE_CONNECT_TIMEOUT_MS
        )
      ),
    ]);
  };

  let server: BluetoothRemoteGATTServer;
  try {
    server = await connectWithTimeout();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection attempt failed.";
    if (/timeout|attempt failed|failed|refused|unreachable/i.test(msg)) {
      throw new Error(
        "Gagal menghubungkan ke printer. Pastikan: (1) printer menyala, (2) dalam jangkauan, (3) belum terhubung ke aplikasi lain, (4) Bluetooth perangkat Anda aktif. Coba lagi."
      );
    }
    throw err;
  }

  let characteristic: WritableCharacteristic | null = null;
  for (const uuid of BLE_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find(
        (c: BluetoothRemoteGATTCharacteristic) =>
          c.properties.writeWithoutResponse || c.properties.write
      ) as WritableCharacteristic | undefined;
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
    throw new Error("Tidak menemukan karakteristik tulis pada printer. Pastikan ini printer thermal ESC/POS Bluetooth.");
  }
  receiptBleCache = { server, characteristic };
}

/** Putus koneksi printer struk BLE dan hapus cache. */
export function disconnectReceiptBluetooth(): void {
  if (receiptBleCache?.server?.connected) {
    receiptBleCache.server.disconnect();
  }
  clearReceiptBleCache();
}

/** Cetak struk ke printer thermal Bluetooth. Gunakan koneksi yang sudah dihubungkan di Pengaturan Toko. */
export async function printReceiptBluetooth(data: ReceiptData): Promise<void> {
  if (!navigator.bluetooth) {
    throw new Error("Browser tidak mendukung Bluetooth. Gunakan Chrome/Edge dan pastikan HTTPS.");
  }
  if (!receiptBleCache?.server?.connected || !receiptBleCache.characteristic) {
    throw new Error(
      "Printer struk thermal belum terhubung. Buka Pengaturan Toko → Printer struk thermal (BLE) → Hubungkan perangkat."
    );
  }
  const bytes = buildEscPosBytes(data);
  const characteristic = receiptBleCache.characteristic;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValueWithResponse(chunk);
    }
  }
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

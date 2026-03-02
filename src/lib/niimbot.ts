/**
 * NiiMBot label printer via Web Bluetooth (BLE).
 * Menggunakan @mmote/niimbluelib untuk B1 (protocol & Connect sudah di-handle library).
 */

import {
  NiimbotBluetoothClient,
  ImageEncoder,
} from "@mmote/niimbluelib";

export const NIIMBOT_SERVICE_UUID = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
export const NIIMBOT_CHAR_UUID = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

/** Client BLE yang sudah connect (dihubungkan sekali di Pengaturan). */
let cachedClient: NiimbotBluetoothClient | null = null;

/** Mengembalikan client NiiMBot yang aktif (jika sudah dihubungkan dari Pengaturan). */
export function getNiimbotConnection(): NiimbotBluetoothClient | null {
  if (cachedClient?.isConnected()) return cachedClient;
  cachedClient = null;
  return null;
}

/** Putus koneksi dan hapus cache. Dipanggil dari halaman Pengaturan. */
export function disconnectNiimbot(): void {
  if (cachedClient) {
    cachedClient.disconnect();
    cachedClient = null;
  }
}

/**
 * Hubungkan printer NiiMBot via Bluetooth (hanya dipanggil dari Pengaturan).
 * Menggunakan NiimBlueLib: Connect (0xc1) dan negosiasi dilakukan di dalam library.
 */
export async function connectNiimbot(): Promise<NiimbotBluetoothClient> {
  const existing = getNiimbotConnection();
  if (existing) return existing;

  if (!navigator.bluetooth) {
    throw new Error("Browser tidak mendukung Bluetooth. Gunakan Chrome/Edge dan pastikan HTTPS.");
  }

  const client = new NiimbotBluetoothClient();
  client.on("disconnect", () => {
    if (cachedClient === client) cachedClient = null;
  });
  await client.connect();
  cachedClient = client;
  return client;
}

export const LABEL_WIDTH_PX = 384;
export const LABEL_HEIGHT_PX = 128;

const formatIdrForLabel = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.round(n));

function getFieldText(fieldId: NiimbotLabelFieldId, product: NiimbotLabelProductData): string {
  switch (fieldId) {
    case "name": return product.name || "-";
    case "barcode": return product.barcode ? `Barcode: ${product.barcode}` : "Barcode: -";
    case "price": return product.price != null ? formatIdrForLabel(product.price) : "Harga: -";
    case "sku": return product.sku ? `SKU: ${product.sku}` : "SKU: -";
    case "stock": return product.stock != null ? `Stok: ${product.stock}` : "Stok: -";
    default: return "-";
  }
}

/** Render satu elemen ke ctx; mengembalikan tinggi yang dipakai (px). */
function drawLabelElement(
  ctx: CanvasRenderingContext2D,
  el: LabelElement,
  product: NiimbotLabelProductData,
  y: number,
  width: number,
  padding: number
): number {
  const fontSize = (el.type !== "line" ? (el.fontSize ?? DEFAULT_FONT_SIZE) : 0);
  const bold = el.type !== "line" && (el.fontBold ?? true);
  const align = el.type !== "line" ? (el.align ?? "left") : "left";

  if (el.type === "line") {
    const thickness = el.thickness ?? DEFAULT_LINE_THICKNESS;
    ctx.fillStyle = "black";
    ctx.fillRect(padding, y, width - padding * 2, thickness);
    return thickness + 4;
  }

  let text = "";
  if (el.type === "field") text = getFieldText(el.fieldId, product);
  else if (el.type === "static_text") text = el.text || "";

  ctx.fillStyle = "black";
  ctx.font = `${bold ? "bold " : ""}${fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  const lineHeight = fontSize + 4;
  const maxW = width - padding * 2;
  const textSlice = text.slice(0, 28);
  let x = padding;
  if (align === "center") x = padding + (maxW - ctx.measureText(textSlice).width) / 2;
  else if (align === "right") x = width - padding - ctx.measureText(textSlice).width;
  ctx.fillText(textSlice, x, y, maxW);
  return lineHeight;
}

/** Buat canvas dari desain label + data produk. */
export function buildLabelCanvasFromDesign(
  design: LabelDesign,
  product: NiimbotLabelProductData
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_WIDTH_PX;
  canvas.height = LABEL_HEIGHT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Gagal membuat context canvas.");

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, LABEL_WIDTH_PX, LABEL_HEIGHT_PX);
  const padding = 6;
  let y = padding;
  for (const el of design.elements) {
    const h = drawLabelElement(ctx, el, product, y, LABEL_WIDTH_PX, padding);
    y += h;
    if (y >= LABEL_HEIGHT_PX - padding) break;
  }
  return canvas;
}

/** Legacy: canvas dari list baris (untuk fallback). */
function buildLabelCanvasFromLines(lines: string[], fontSize: number = 20): HTMLCanvasElement {
  const design: LabelDesign = {
    elements: lines.map((line, i) => ({
      id: "legacy-" + i,
      type: "static_text" as const,
      text: line ?? "",
      fontSize,
      fontBold: true,
      align: "left" as const,
    })),
  };
  return buildLabelCanvasFromDesign(design, { name: "Label" });
}

const NIIMBOT_NOT_CONNECTED_MSG =
  "Printer NiiMBot belum terhubung. Hubungkan di Pengaturan Toko terlebih dahulu.";

const NIIMBOT_GATT_DISCONNECTED_MSG =
  "Koneksi printer putus (GATT disconnected). Silakan hubungkan lagi di Pengaturan Toko.";

function isGattDisconnectedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /GATT Server is disconnected|disconnected|gatt\.connect/i.test(msg);
}

/**
 * Cetak label ke NiiMBot B1 via NiimBlueLib.
 * Isi label mengikuti desain yang diatur di Pengaturan Toko (drag-drop, font, line).
 */
export async function printLabelNiimbot(productData: NiimbotLabelProductData): Promise<void> {
  const client = getNiimbotConnection();
  if (!client) throw new Error(NIIMBOT_NOT_CONNECTED_MSG);

  try {
    const design = getNiimbotLabelDesign();
    const canvas = design.elements.length > 0
      ? buildLabelCanvasFromDesign(design, productData)
      : buildLabelCanvasFromLines(buildNiimbotLabelLines(productData));
    const encoded = ImageEncoder.encodeCanvas(canvas, "top");

    const task = client.abstraction.newPrintTask("B1", { totalPages: 1 });
    await task.printInit();
    await task.printPage(encoded, 1);
    await task.waitForFinished();
    await client.abstraction.printEnd();
  } catch (err) {
    if (isGattDisconnectedError(err)) {
      cachedClient = null;
      throw new Error(NIIMBOT_GATT_DISCONNECTED_MSG);
    }
    throw err;
  }
}

// --- Label design (drag-and-drop, font, line, seperti app NiiMBot) ---

export const NIIMBOT_LABEL_STORAGE_KEY = "hisabia-niimbot-label-fields";
export const NIIMBOT_LABEL_DESIGN_KEY = "hisabia-niimbot-label-design";

export type NiimbotLabelFieldId = "name" | "barcode" | "price" | "sku" | "stock";

export interface NiimbotLabelFieldOption {
  id: NiimbotLabelFieldId;
  label: string;
}

export const NIIMBOT_LABEL_FIELD_OPTIONS: NiimbotLabelFieldOption[] = [
  { id: "name", label: "Nama produk" },
  { id: "barcode", label: "Barcode" },
  { id: "price", label: "Harga jual" },
  { id: "sku", label: "Kode / SKU" },
  { id: "stock", label: "Stok" },
];

export type LabelElementType = "field" | "static_text" | "line";

export interface LabelElementBase {
  id: string;
  type: LabelElementType;
}

export interface LabelElementField extends LabelElementBase {
  type: "field";
  fieldId: NiimbotLabelFieldId;
  fontSize?: number;
  fontBold?: boolean;
  align?: "left" | "center" | "right";
}

export interface LabelElementStaticText extends LabelElementBase {
  type: "static_text";
  text: string;
  fontSize?: number;
  fontBold?: boolean;
  align?: "left" | "center" | "right";
}

export interface LabelElementLine extends LabelElementBase {
  type: "line";
  thickness?: number;
}

export type LabelElement = LabelElementField | LabelElementStaticText | LabelElementLine;

export interface LabelDesign {
  elements: LabelElement[];
}

const DEFAULT_FONT_SIZE = 18;
const DEFAULT_LINE_THICKNESS = 2;

export function nextLabelElementId(): string {
  return "el-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/** Migrasi: dari list field lama ke LabelDesign. */
function designFromLegacyFields(fieldIds: NiimbotLabelFieldId[]): LabelDesign {
  return {
    elements: fieldIds.map((fieldId) => ({
      id: nextLabelElementId(),
      type: "field" as const,
      fieldId,
      fontSize: DEFAULT_FONT_SIZE,
      fontBold: true,
      align: "left" as const,
    })),
  };
}

export function getNiimbotLabelDesign(): LabelDesign {
  try {
    const raw = localStorage.getItem(NIIMBOT_LABEL_DESIGN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as LabelDesign).elements)) {
        const d = parsed as LabelDesign;
        if (d.elements.length > 0) return d;
      }
    }
  } catch {}
  const legacy = getNiimbotLabelFields();
  return designFromLegacyFields(legacy);
}

export function setNiimbotLabelDesign(design: LabelDesign): void {
  try {
    localStorage.setItem(NIIMBOT_LABEL_DESIGN_KEY, JSON.stringify(design));
  } catch {}
}

export function getNiimbotLabelFields(): NiimbotLabelFieldId[] {
  try {
    const raw = localStorage.getItem(NIIMBOT_LABEL_STORAGE_KEY);
    if (!raw) return ["name", "barcode", "price"];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      const valid = parsed.filter((x) =>
        NIIMBOT_LABEL_FIELD_OPTIONS.some((o) => o.id === x)
      ) as NiimbotLabelFieldId[];
      return valid.length ? valid : ["name", "barcode", "price"];
    }
  } catch {}
  return ["name", "barcode", "price"];
}

export function setNiimbotLabelFields(fields: NiimbotLabelFieldId[]): void {
  try {
    localStorage.setItem(NIIMBOT_LABEL_STORAGE_KEY, JSON.stringify(fields));
  } catch {}
}

export interface NiimbotLabelProductData {
  name: string;
  barcode?: string | null;
  price?: number;
  sku?: string | null;
  stock?: number;
}

const formatIdrLabel = (n: number): string =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.round(n));

/** Build label lines from product data using current label field settings. */
export function buildNiimbotLabelLines(product: NiimbotLabelProductData): string[] {
  const fields = getNiimbotLabelFields();
  const lines: string[] = [];
  for (const id of fields) {
    switch (id) {
      case "name":
        lines.push(product.name || "-");
        break;
      case "barcode":
        lines.push(product.barcode ? `Barcode: ${product.barcode}` : "Barcode: -");
        break;
      case "price":
        lines.push(product.price != null ? formatIdrLabel(product.price) : "Harga: -");
        break;
      case "sku":
        lines.push(product.sku ? `SKU: ${product.sku}` : "SKU: -");
        break;
      case "stock":
        lines.push(product.stock != null ? `Stok: ${product.stock}` : "Stok: -");
        break;
      default:
        break;
    }
  }
  return lines.length ? lines : [product.name || "Label"];
}

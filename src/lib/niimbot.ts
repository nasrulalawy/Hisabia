/**
 * NiiMBot label printer via Web Bluetooth (BLE).
 * Protocol: https://printers.niim.blue/interfacing/proto/
 * Service UUID: e7810a71-73ae-499d-8c15-faa9aef0c3f2
 * Characteristic: bef8d6c9-9c21-4c9e-b632-bd58c1009f9f
 */

export const NIIMBOT_SERVICE_UUID = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
export const NIIMBOT_CHAR_UUID = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

const HEAD = [0x55, 0x55];
const TAIL = [0xaa, 0xaa];

function buildPacket(cmd: number, data: number[]): Uint8Array {
  const dataLen = data.length;
  const arr = [...HEAD, cmd, dataLen & 0xff, ...data];
  let xor = cmd ^ (dataLen & 0xff);
  for (let i = 0; i < data.length; i++) xor ^= data[i];
  arr.push(xor & 0xff);
  arr.push(...TAIL);
  return new Uint8Array(arr);
}

/** Render text lines to 1-bit bitmap rows (each row = widthPx/8 bytes, MSB first = left pixel). */
function renderLabelToBitmap(
  lines: string[],
  widthPx: number,
  heightPx: number,
  fontSize: number = 20
): Uint8Array[] {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = "black";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  const lineHeight = Math.min(fontSize + 4, Math.floor(heightPx / Math.max(1, lines.length)));
  const padding = 4;
  lines.forEach((line, i) => {
    const y = padding + i * lineHeight;
    ctx.fillText(line.slice(0, 32), padding, y, widthPx - padding * 2);
  });

  const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
  const rowBytes = Math.ceil(widthPx / 8);
  const rows: Uint8Array[] = [];

  for (let row = 0; row < heightPx; row++) {
    const rowBuf = new Uint8Array(rowBytes);
    for (let col = 0; col < widthPx; col++) {
      const idx = (row * widthPx + col) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const isBlack = r + g + b < 384;
      if (isBlack) {
        const byteIdx = Math.floor(col / 8);
        const bitIdx = 7 - (col % 8);
        rowBuf[byteIdx] |= 1 << bitIdx;
      }
    }
    rows.push(rowBuf);
  }
  return rows;
}

function countBits(bytes: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    let b = bytes[i];
    while (b) {
      n += b & 1;
      b >>= 1;
    }
  }
  return n;
}

export interface NiimbotConnection {
  write(data: Uint8Array): Promise<void>;
  disconnect(): void;
}

export async function connectNiimbot(): Promise<NiimbotConnection> {
  if (!navigator.bluetooth) {
    throw new Error("Browser tidak mendukung Bluetooth. Gunakan Chrome/Edge dan pastikan HTTPS.");
  }
  // acceptAllDevices: true agar semua perangkat BLE tampil di scan (nama NiiMBot bisa beda: B21, D11, atau tidak diiklankan)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [NIIMBOT_SERVICE_UUID],
  } as any);
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(NIIMBOT_SERVICE_UUID);
  const chars = await service.getCharacteristics();
  const char = chars.find((c) => (c as { uuid?: string }).uuid === NIIMBOT_CHAR_UUID) ?? chars[0];
  if (!char) {
    server.disconnect();
    throw new Error("Karakteristik NiiMBot tidak ditemukan.");
  }
  const write = char.properties.writeWithoutResponse
    ? (data: Uint8Array) => char.writeValueWithoutResponse(data as BufferSource)
    : (data: Uint8Array) => char.writeValueWithResponse(data as BufferSource);

  return {
    async write(data: Uint8Array) {
      const CHUNK = 100;
      for (let i = 0; i < data.length; i += CHUNK) {
        await write(data.slice(i, i + CHUNK));
      }
    },
    disconnect() {
      server.disconnect();
    },
  };
}

/**
 * Print a label with the given text lines to NiiMBot.
 * Uses B1-style sequence: SetDensity, SetLabelType, PrintStart, PageStart, SetPageSize, rows, PageEnd, PrintEnd.
 */
export async function printLabelNiimbot(lines: string[]): Promise<void> {
  const widthPx = 384;
  const heightPx = 128;
  const bitmapRows = renderLabelToBitmap(lines, widthPx, heightPx);
  if (bitmapRows.length === 0) throw new Error("Gagal render label.");

  const conn = await connectNiimbot();
  try {
    await conn.write(buildPacket(0x21, [0x01]));
    await conn.write(buildPacket(0x23, [0x00]));
    await conn.write(buildPacket(0x01, [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
    await conn.write(buildPacket(0x03, [0x01]));
    const rowsLo = heightPx & 0xff;
    const rowsHi = (heightPx >> 8) & 0xff;
    const colsLo = widthPx & 0xff;
    const colsHi = (widthPx >> 8) & 0xff;
    await conn.write(buildPacket(0x13, [rowsLo, rowsHi, colsLo, colsHi, 0x01, 0x00]));

    for (let row = 0; row < bitmapRows.length; row++) {
      const rowData = bitmapRows[row];
      const blackCount = countBits(rowData);
      const isEmpty = blackCount === 0;
      if (isEmpty) {
        const pkt = buildPacket(0x84, [row & 0xff, (row >> 8) & 0xff, 0x01]);
        await conn.write(pkt);
      } else {
        const data = [
          row & 0xff,
          (row >> 8) & 0xff,
          0x01,
          0x00,
          blackCount & 0xff,
          (blackCount >> 8) & 0xff,
          ...rowData,
        ];
        const pkt = buildPacket(0x85, data);
        await conn.write(pkt);
      }
    }

    await conn.write(buildPacket(0xe3, [0x01]));
    await conn.write(buildPacket(0xf3, [0x01]));
  } finally {
    conn.disconnect();
  }
}

// --- Label content (what to show on the label) ---

export const NIIMBOT_LABEL_STORAGE_KEY = "hisabia-niimbot-label-fields";

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

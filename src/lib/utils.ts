/** Generate URL-friendly slug from string */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Format number as IDR currency */
export function formatIdr(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

/**
 * Parse price string supporting Indonesian format:
 * - "10.000" = 10000 (titik = pemisah ribuan)
 * - "10.000,50" = 10000.50 (koma = desimal)
 * - "10000" atau "10000.50" = US format
 * Dibulatkan 2 desimal untuk hindari floating-point error (mis. 40.000 → 39.999,88)
 */
export function parsePriceIdr(str: string): number {
  if (!str || typeof str !== "string") return 0;
  const s = str.trim().replace(/\s/g, "");
  if (!s) return 0;

  let result = 0;

  // Ada koma: format Indonesia (koma = desimal)
  if (s.includes(",")) {
    const normalized = s.replace(/\./g, "").replace(",", ".");
    result = parseFloat(normalized) || 0;
  } else {
    // Tanpa koma: cek apakah titik = desimal atau ribuan
    const parts = s.split(".");
    if (parts.length === 1) {
      result = parseFloat(s) || 0;
    } else if (parts.length === 2) {
      const after = parts[1];
      // 1-2 digit setelah titik = desimal (10.5, 10.50)
      if (after.length <= 2 && /^\d+$/.test(after)) {
        result = parseFloat(s) || 0;
      } else {
        // 3+ digit = ribuan (10.000)
        result = parseFloat(parts.join("")) || 0;
      }
    } else {
      // Beberapa titik = ribuan (1.000.000)
      result = parseFloat(parts.join("")) || 0;
    }
  }

  // Bulatkan ke 2 desimal pakai integer untuk hindari 40.000 → 39.999,88
  return Math.round(result * 100) / 100;
}

/** Format date */
export function formatDate(d: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(d));
}

/** Batas bawah stok untuk dianggap "stok menipis" (di bawah ini = menipis, 0 = kosong, < 0 = minus) */
export const STOCK_LOW_THRESHOLD = 10;

export type StockStatus = "minus" | "empty" | "low" | "ok";

/** Status stok: minus (< 0), empty (0), low (1..threshold), ok (> threshold) */
export function getStockStatus(
  stock: number,
  lowThreshold: number = STOCK_LOW_THRESHOLD
): StockStatus {
  const s = Number(stock);
  if (s < 0) return "minus";
  if (s === 0) return "empty";
  if (s <= lowThreshold) return "low";
  return "ok";
}

/** Label status stok untuk tampilan */
export function getStockStatusLabel(status: StockStatus): string {
  switch (status) {
    case "minus":
      return "Stok minus";
    case "empty":
      return "Stok kosong";
    case "low":
      return "Stok menipis";
    default:
      return "";
  }
}

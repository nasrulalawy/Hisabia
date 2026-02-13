/** Base URL for API (relative /api in dev with proxy; set VITE_API_URL for production) */
export function getApiBase(): string {
  const base = import.meta.env.VITE_API_URL;
  if (typeof base === "string" && base.trim()) return base.replace(/\/$/, "");
  return "";
}

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

/** Format date */
export function formatDate(d: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(d));
}

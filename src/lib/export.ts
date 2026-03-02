/**
 * Export data ke CSV (tanpa dependency). Untuk PDF gunakan Cetak browser (Save as PDF).
 */

function escapeCsvCell(s: string): string {
  const t = String(s).replace(/"/g, '""');
  return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
}

/** Unduh array baris (baris pertama = header) sebagai file CSV. */
export function downloadCsv(rows: string[][], filename: string): void {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Buka dialog print browser (user bisa pilih Save as PDF). */
export function printForPdf(): void {
  window.print();
}

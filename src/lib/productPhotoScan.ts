/**
 * Ekstrak barcode dari gambar (file atau URL) menggunakan ZXing.
 */
export async function decodeBarcodeFromImage(source: File | string): Promise<string | null> {
  const { BrowserMultiFormatReader } = await import("@zxing/library");
  const reader = new BrowserMultiFormatReader();
  try {
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    try {
      const result = await reader.decodeFromImageUrl(url);
      return result?.getText()?.trim() ?? null;
    } finally {
      if (typeof source !== "string") URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

/**
 * Ekstrak teks dari gambar dengan OCR (Tesseract). Bahasa: Indonesia + Inggris.
 */
export async function extractTextFromImage(source: File | string): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const { data } = await Tesseract.recognize(url, "ind+eng", {
      logger: () => {},
    });
    return (data?.text ?? "").trim();
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

export interface ProductPhotoScanResult {
  barcode: string | null;
  ocrText: string;
  /** Baris pertama atau baris terpanjang yang bukan angka saja — untuk nama produk */
  suggestedName: string;
  /** Kata dari OCR yang cocok dengan salah satu nama kategori (untuk pilihan jenis) */
  suggestedCategoryName: string | null;
}

/**
 * Ekstrak barcode dan teks dari gambar, lalu sarankan nama dan kategori.
 */
export async function scanProductPhoto(
  image: File | string,
  categoryNames: string[]
): Promise<ProductPhotoScanResult> {
  const [barcode, ocrText] = await Promise.all([
    decodeBarcodeFromImage(image),
    extractTextFromImage(image),
  ]);

  const lines = ocrText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let suggestedName = "";
  for (const line of lines) {
    const clean = line.replace(/\s+/g, " ").trim();
    if (clean.length < 2) continue;
    if (/^\d+$/.test(clean)) continue;
    if (suggestedName.length < clean.length) suggestedName = clean;
  }
  if (!suggestedName && lines[0]) suggestedName = lines[0].replace(/\s+/g, " ").trim();

  const lowerCategoryNames = categoryNames.map((n) => n.toLowerCase());
  let suggestedCategoryName: string | null = null;
  const words = ocrText.toLowerCase().split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (word.length < 2) continue;
    const match = lowerCategoryNames.find((cat) => cat.includes(word) || word.includes(cat));
    if (match) {
      suggestedCategoryName = categoryNames[lowerCategoryNames.indexOf(match)];
      break;
    }
  }

  return {
    barcode,
    ocrText,
    suggestedName,
    suggestedCategoryName,
  };
}

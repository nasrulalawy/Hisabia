import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { scanProductPhoto, type ProductPhotoScanResult } from "@/lib/productPhotoScan";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB for camera capture
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ProductPhotoScanModalProps {
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  onApply: (result: { barcode: string; name: string; category_id: string }, imageFile: File) => void;
}

export function ProductPhotoScanModal({
  open,
  onClose,
  categories,
  onApply,
}: ProductPhotoScanModalProps) {
  const categoryNames = categories.map((c) => c.name);
  const categoryIdByName: Record<string, string> = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const [step, setStep] = useState<"capture" | "result">("capture");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductPhotoScanResult | null>(null);
  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    if (step === "capture" && !imagePreview) {
      startCamera();
      return () => stopCamera();
    }
  }, [open, step, imagePreview]);

  function reset() {
    setStep("capture");
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(null);
    setExtractError(null);
    setEditName("");
    setEditBarcode("");
    setEditCategoryId("");
    stopCamera();
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setExtractError("Tidak bisa mengakses kamera. Gunakan tombol Pilih file.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function captureFromCamera() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setExtractError("Ukuran gambar maksimal 5 MB.");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setExtractError("Format: JPEG, PNG, atau WebP.");
      return;
    }
    setExtractError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function runExtract() {
    if (!imageFile) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const scanResult = await scanProductPhoto(imageFile, categoryNames);
      setResult(scanResult);
      setEditBarcode(scanResult.barcode ?? "");
      setEditName(scanResult.suggestedName);
      setEditCategoryId(
        scanResult.suggestedCategoryName ? categoryIdByName[scanResult.suggestedCategoryName] ?? "" : ""
      );
      setStep("result");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Gagal mengekstrak");
    }
    setExtracting(false);
  }

  function handleApply() {
    if (!imageFile) return;
    const name = editName.trim();
    if (!name) {
      setExtractError("Isi nama produk.");
      return;
    }
    onApply(
      {
        barcode: editBarcode.trim(),
        name,
        category_id: editCategoryId.trim(),
      },
      imageFile
    );
    handleClose();
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Isi produk dari foto" size="lg">
      <div className="space-y-4">
        {extractError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {extractError}
          </div>
        )}

        {step === "capture" && (
          <>
            {!imagePreview ? (
              <div className="space-y-3">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      Pilih file
                    </Button>
                    <Button type="button" size="sm" onClick={captureFromCamera}>
                      Ambil foto
                    </Button>
                  </div>
                </div>
                <p className="text-center text-xs text-[var(--muted-foreground)]">
                  Izinkan kamera lalu ambil foto kemasan produk (barcode + nama terlihat), atau pilih file gambar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="mx-auto max-h-[50vh] w-full rounded-xl border border-[var(--border)] object-contain"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                      startCamera();
                    }}
                  >
                    Ganti foto
                  </Button>
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Pilih file lain
                  </Button>
                  <Button type="button" onClick={runExtract} disabled={extracting}>
                    {extracting ? "Mengekstrak..." : "Ekstrak barcode & nama"}
                  </Button>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Periksa dan edit jika perlu. Harga bisa diisi nanti di form.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Barcode</label>
              <Input
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
                placeholder="Kosongkan jika tidak ada"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nama produk *</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nama produk"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Kategori (jenis)</label>
              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value="">-- Pilih kategori --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("capture");
                  setImageFile(null);
                  setImagePreview((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                  setResult(null);
                  startCamera();
                }}
              >
                Ganti foto
              </Button>
              <Button type="button" onClick={handleApply}>
                Pakai untuk form
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

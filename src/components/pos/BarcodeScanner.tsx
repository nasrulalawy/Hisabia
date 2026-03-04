import { useRef, useCallback, useEffect } from "react";
import { useZxing } from "react-zxing";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

interface BarcodeScannerProps {
  open: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
  lastError?: string | null;
}

/** Cooldown per barcode agar tidak double-trigger (sama seperti scanner fisik: satu scan = satu enter). */
const SCAN_COOLDOWN_MS = 800;

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 640, min: 320 },
  height: { ideal: 480, min: 240 },
};

const DECODE_HINTS = new Map([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

export function BarcodeScanner({ open, onScan, onClose, lastError }: BarcodeScannerProps) {
  const lastScanned = useRef<string | null>(null);
  const lastTime = useRef<number>(0);

  const handleResult = useCallback(
    (result: { getText: () => string }) => {
      const text = result.getText()?.trim();
      if (!text) return;
      const now = Date.now();
      if (lastScanned.current === text && now - lastTime.current < SCAN_COOLDOWN_MS) return;
      lastScanned.current = text;
      lastTime.current = now;
      onScan(text);
    },
    [onScan]
  );

  const { ref } = useZxing({
    onResult: handleResult,
    onError: () => {},
    paused: !open,
    hints: DECODE_HINTS,
    timeBetweenDecodingAttempts: 100,
    constraints: { video: VIDEO_CONSTRAINTS },
  });

  useEffect(() => {
    if (!open) {
      lastScanned.current = null;
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        Arahkan kamera ke barcode. Saat terdeteksi, produk langsung masuk keranjang (sama seperti scanner fisik).
      </p>
      <div className="relative aspect-square max-h-[55vh] w-full overflow-hidden rounded-xl bg-black">
        <video
          ref={ref}
          className="h-full w-full object-contain"
          muted
          playsInline
          autoPlay
        />
        <div className="absolute inset-0 border-4 border-dashed border-[var(--primary)]/50 pointer-events-none rounded-xl" />
      </div>
      {lastError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{lastError}</p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--border)]"
      >
        Tutup
      </button>
    </div>
  );
}

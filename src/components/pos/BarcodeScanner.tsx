import { useRef, useCallback, useEffect } from "react";
import { useZxing } from "react-zxing";

interface BarcodeScannerProps {
  open: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
  lastError?: string | null;
}

const SCAN_COOLDOWN_MS = 2000;

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
    timeBetweenDecodingAttempts: 300,
    constraints: { video: { facingMode: "environment" } },
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
        Arahkan kamera ke barcode/QR produk. Produk akan otomatis masuk keranjang.
      </p>
      <div className="relative aspect-square max-h-[50vh] w-full overflow-hidden rounded-xl bg-black">
        <video
          ref={ref}
          className="h-full w-full object-cover"
          muted
          playsInline
          style={{ transform: "scaleX(-1)" }}
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

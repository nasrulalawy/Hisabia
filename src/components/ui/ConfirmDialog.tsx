import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Ya",
  cancelLabel = "Batal",
  variant = "danger",
  loading,
}: ConfirmDialogProps) {
  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="mt-2 text-[var(--muted-foreground)]">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={variant === "danger" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Memproses...
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

const DISMISS_KEY = "hisabia-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return; // Jangan tampilkan lagi 7 hari
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as { standalone?: boolean }).standalone) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg sm:left-auto sm:right-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10">
            <svg className="h-5 w-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--foreground)]">Install Hisabia</p>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              Install aplikasi di HP untuk akses lebih cepat dan bisa dipakai offline.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Tutup"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleInstall} className="flex-1">Install</Button>
          <Button variant="outline" onClick={handleDismiss}>Nanti</Button>
        </div>
      </div>
    </div>
  );
}

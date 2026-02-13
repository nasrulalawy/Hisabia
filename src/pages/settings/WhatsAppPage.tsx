import { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";

const API = "/api";

export function WhatsAppPage() {
  const { orgId, outlets } = useOrg();
  const [waAvailable, setWaAvailable] = useState(false);
  const [outletStatus, setOutletStatus] = useState<Record<string, { status: string; qr?: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    fetch(`${API}/wa/status`)
      .then((r) => r.json())
      .then((d) => setWaAvailable(d.available ?? false));
  }, []);

  async function fetchStatus(outletId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API}/wa/${outletId}/status`, { headers });
    const data = await res.json();
    setOutletStatus((prev) => ({ ...prev, [outletId]: data }));
  }

  useEffect(() => {
    outlets.forEach((o) => fetchStatus(o.id));
  }, [orgId, outlets.length]);

  async function handleConnect(outletId: string) {
    setLoading((prev) => ({ ...prev, [outletId]: true }));
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/wa/${outletId}/connect`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOutletStatus((prev) => ({ ...prev, [outletId]: data }));
      pollForQr(outletId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading((prev) => ({ ...prev, [outletId]: false }));
    }
  }

  function pollForQr(outletId: string) {
    const i = setInterval(async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API}/wa/${outletId}/status`, { headers });
      const data = await res.json();
      setOutletStatus((prev) => ({ ...prev, [outletId]: data }));
      if (data.status === "connected" || data.status === "auth_failure") {
        clearInterval(i);
      }
    }, 2000);
    setTimeout(() => clearInterval(i), 120000);
  }

  async function handleDisconnect(outletId: string) {
    setLoading((prev) => ({ ...prev, [outletId]: true }));
    setError(null);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API}/wa/${outletId}/disconnect`, {
        method: "POST",
        headers,
      });
      setOutletStatus((prev) => ({ ...prev, [outletId]: { status: "disconnected" } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading((prev) => ({ ...prev, [outletId]: false }));
    }
  }

  if (!waAvailable) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Koneksi WhatsApp</h2>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <p className="font-medium">WhatsApp Web belum tersedia</p>
          <p className="mt-1 text-sm">
            Jalankan <code className="rounded bg-amber-100 px-1">npm install whatsapp-web.js</code>{" "}
            lalu restart server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Koneksi WhatsApp</h2>
        <p className="text-[var(--muted-foreground)]">
          Hubungkan WA outlet untuk mengirim notifikasi otomatis: pesanan, tagihan hutang, dll.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-4">
        {outlets.map((outlet) => {
          const st = outletStatus[outlet.id] || { status: "disconnected" };
          const status = st.status;
          const isConnecting = loading[outlet.id];
          return (
            <div
              key={outlet.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-[var(--foreground)]">{outlet.name}</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {status === "connected"
                      ? "Terhubung"
                      : status === "qr_pending"
                        ? "Scan QR code di bawah"
                        : status === "connecting"
                          ? "Menghubungkan..."
                          : "Belum terhubung"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {status === "connected" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(outlet.id)}
                      disabled={isConnecting}
                    >
                      Putuskan
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnect(outlet.id)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? "..." : "Hubungkan"}
                    </Button>
                  )}
                </div>
              </div>
              {status === "qr_pending" && st.qr && (
                <div className="mt-4 flex justify-center">
                  <QRCodeDisplay qr={st.qr} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QRCodeDisplay({ qr }: { qr: string }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    import("qrcode").then((mod) => {
      mod.toDataURL(qr, { width: 256 }).then(setImg);
    });
  }, [qr]);
  return img ? <img src={img} alt="QR Code" className="rounded-lg border" /> : <div className="h-64 w-64 animate-pulse bg-[var(--muted)]" />;
}

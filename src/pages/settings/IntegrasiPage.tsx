import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { API_SERVER_URL, getApiServerToken } from "@/lib/apiServer";

export function IntegrasiPage() {
  const { orgId } = useOrg();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchConfig() {
    if (!orgId || !API_SERVER_URL) {
      setLoading(false);
      return;
    }
    const token = await getApiServerToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_SERVER_URL}/api/integrations/n8n?organization_id=${encodeURIComponent(orgId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setWebhookUrl(data.n8n_webhook_url || "");
        setHasApiKey(!!data.has_api_key);
        setApiKeyPrefix(data.api_key_prefix || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConfig();
  }, [orgId]);

  async function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !API_SERVER_URL) return;
    const token = await getApiServerToken();
    if (!token) {
      setError("Silakan login ulang.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_SERVER_URL}/api/integrations/n8n`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organization_id: orgId, n8n_webhook_url: webhookUrl.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
        return;
      }
      setSuccess("Webhook URL disimpan.");
      setTimeout(() => setSuccess(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateApiKey() {
    if (!orgId || !API_SERVER_URL) return;
    const token = await getApiServerToken();
    if (!token) {
      setError("Silakan login ulang.");
      return;
    }
    setKeyLoading(true);
    setError(null);
    setNewApiKey(null);
    try {
      const res = await fetch(`${API_SERVER_URL}/api/integrations/n8n/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organization_id: orgId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Gagal membuat API key");
        return;
      }
      setNewApiKey(data.api_key || null);
      setHasApiKey(true);
      setApiKeyPrefix(data.api_key ? data.api_key.slice(-4) : null);
    } finally {
      setKeyLoading(false);
    }
  }

  function copyApiKey() {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setSuccess("API key disalin ke clipboard.");
      setTimeout(() => setSuccess(null), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!API_SERVER_URL) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Integrasi n8n</h2>
          <p className="text-[var(--muted-foreground)]">Sambungkan Hisabia dengan n8n untuk otomasi workflow.</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-medium">Backend API belum dikonfigurasi</p>
          <p className="mt-1 text-sm">Tambahkan <code className="rounded bg-amber-100 px-1">VITE_API_URL</code> di <code className="rounded bg-amber-100 px-1">.env.local</code> (mis. <code className="rounded bg-amber-100 px-1">http://localhost:3001</code>) dan jalankan server dengan <code className="rounded bg-amber-100 px-1">npm run server</code>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Integrasi n8n</h2>
        <p className="text-[var(--muted-foreground)]">Sambungkan Hisabia dengan n8n untuk otomasi workflow: baca data (order, produk, pelanggan) dari n8n dan terima event (mis. order baru) di workflow n8n.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 space-y-6">
        <h3 className="font-semibold text-[var(--foreground)]">API Key (untuk n8n memanggil Hisabia)</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          Gunakan di n8n node &quot;HTTP Request&quot;: header <code className="rounded bg-[var(--muted)] px-1">X-API-Key</code> atau <code className="rounded bg-[var(--muted)] px-1">Authorization: Bearer &lt;api_key&gt;</code>.
        </p>
        {newApiKey ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-700">Simpan API key ini; tidak akan ditampilkan lagi.</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-[var(--muted)] px-2 py-1 text-sm break-all">{newApiKey}</code>
              <Button variant="outline" size="sm" onClick={copyApiKey}>Salin</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {hasApiKey ? (
              <span className="text-[var(--muted-foreground)]">API key aktif (••••{apiKeyPrefix})</span>
            ) : (
              <span className="text-[var(--muted-foreground)]">Belum ada API key</span>
            )}
            <Button variant="outline" size="sm" onClick={handleGenerateApiKey} disabled={keyLoading}>
              {keyLoading ? "..." : hasApiKey ? "Regenerasi API Key" : "Buat API Key"}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 space-y-4">
        <h3 className="font-semibold text-[var(--foreground)]">Webhook n8n (untuk terima event dari Hisabia)</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          Buat workflow di n8n dengan trigger &quot;Webhook&quot;, lalu tempel URL webhook-nya di bawah. Hisabia akan mengirim event (mis. <code className="rounded bg-[var(--muted)] px-1">order.created</code>) ke URL ini.
        </p>
        <form onSubmit={handleSaveWebhook} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-sm font-medium">URL Webhook n8n</label>
            <Input
              type="url"
              placeholder="https://...n8n.../webhook/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
        </form>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-4 text-sm">
        <h4 className="font-medium text-[var(--foreground)] mb-2">Cara pakai di n8n</h4>
        <ul className="list-disc list-inside space-y-1 text-[var(--muted-foreground)]">
          <li><strong>Ambil data:</strong> Tambah node &quot;HTTP Request&quot;. Method GET. URL: <code>{API_SERVER_URL}/api/n8n/orders</code> (atau <code>/api/n8n/products</code>, <code>/api/n8n/customers</code>, <code>/api/n8n/cash-flows</code>). Header: <code>X-API-Key: &lt;api_key&gt;</code>. Query opsional: <code>since</code>, <code>until</code>, <code>limit</code>.</li>
          <li><strong>Terima event:</strong> Buat workflow dengan trigger Webhook, dapatkan URL, tempel di &quot;Webhook n8n&quot; di atas. Body yang dikirim: <code>{`{ event, payload, timestamp }`}</code>.</li>
        </ul>
      </div>
    </div>
  );
}

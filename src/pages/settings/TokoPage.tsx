import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function TokoPage() {
  const { orgId } = useOrg();
  const [phone, setPhone] = useState("");
  const [catalogSlug, setCatalogSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("organizations")
        .select("phone, catalog_slug")
        .eq("id", orgId)
        .single();
      if (!cancelled) {
        setPhone(data?.phone ?? "");
        setCatalogSlug(data?.catalog_slug ?? "");
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const slug = catalogSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || null;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("organizations")
      .update({
        phone: phone.trim() || null,
        catalog_slug: slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);
    setSaving(false);
    if (err) setError(err.message);
    else if (slug) setCatalogSlug(slug);
  }

  function getCatalogUrl() {
    const slug = catalogSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const path = slug ? slug : orgId ?? "";
    return path ? `${window.location.origin}/katalog/${path}` : "";
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Info Toko</h2>
        <p className="text-[var(--muted-foreground)]">
          Nomor WhatsApp toko untuk menerima notifikasi pesanan dari pelanggan.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
            Slug URL Katalog
          </label>
          <Input
            value={catalogSlug}
            onChange={(e) => setCatalogSlug(e.target.value)}
            placeholder="toko-saya (kosong = pakai ID)"
          />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Atur URL katalog agar mudah dibagikan. Contoh: toko-saya → /katalog/toko-saya
          </p>
          {getCatalogUrl() && (
            <p className="mt-1 text-xs font-medium text-[var(--primary)]">
              Link: {getCatalogUrl()}
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
            Nomor WA Toko
          </label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08123456789 atau 628123456789"
          />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Saat pelanggan selesai memesan via link belanja, WhatsApp akan otomatis terbuka ke nomor
            ini dengan link detail pesanan.
          </p>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </form>
    </div>
  );
}

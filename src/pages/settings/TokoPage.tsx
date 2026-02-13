import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function TokoPage() {
  const { orgId } = useOrg();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("organizations")
        .select("phone")
        .eq("id", orgId)
        .single();
      if (!cancelled) setPhone(data?.phone ?? "");
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("organizations")
      .update({ phone: phone.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", orgId);
    setSaving(false);
    if (err) setError(err.message);
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

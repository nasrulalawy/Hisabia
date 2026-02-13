import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [outletName, setOutletName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data?.organization_id) {
            navigate(`/org/${data.organization_id}/dashboard`, { replace: true });
          }
        });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError("Nama usaha wajib diisi.");
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("create_organization", {
      p_name: nameTrim,
      p_slug: slug.trim() || null,
      p_outlet_name: outletName.trim() || null,
    });
    setLoading(false);
    const res = data as { organizationId?: string; error?: string } | null;
    if (rpcError) {
      setError(rpcError.message || "Gagal membuat usaha.");
      return;
    }
    if (res?.error) {
      setError(res.error);
      return;
    }
    if (res?.organizationId) {
      navigate(`/org/${res.organizationId}/dashboard`, { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--muted)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--primary)] text-2xl font-bold text-white">
            H
          </div>
          <CardTitle>Buat Usaha</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Isi data usaha Anda. Anda bisa menambah outlet nanti.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Nama usaha
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Contoh: Warung Sejahtera"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }}
                required
              />
            </div>
            <div>
              <label htmlFor="slug" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Slug (untuk URL)
              </label>
              <Input
                id="slug"
                type="text"
                placeholder="warung-sejahtera"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="outletName" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Nama outlet pertama
              </label>
              <Input
                id="outletName"
                type="text"
                placeholder="Outlet Utama"
                value={outletName}
                onChange={(e) => setOutletName(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Memproses..." : "Buat usaha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

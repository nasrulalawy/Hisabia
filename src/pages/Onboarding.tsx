import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { OutletType } from "@/lib/database.types";

const BUSINESS_CATEGORY_OPTIONS: { value: OutletType; label: string }[] = [
  { value: "mart", label: "Mart / Retail (toko, warung, minimarket)" },
  { value: "fnb", label: "F&B (restoran, kafe, kedai)" },
  { value: "barbershop", label: "Barbershop / Salon" },
  { value: "gudang", label: "Gudang (distributor, grosir, hanya stok & pembelian)" },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [outletName, setOutletName] = useState("");
  const [businessCategory, setBusinessCategory] = useState<OutletType>("mart");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      const { data: orgData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (orgData?.organization_id) {
        navigate(`/org/${orgData.organization_id}/dashboard`, { replace: true });
        return;
      }
      const { data: customerData } = await supabase
        .from("customers")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (customerData?.organization_id) {
        navigate(`/katalog/${customerData.organization_id}`, { replace: true });
      }
    })();
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
      p_outlet_type: businessCategory,
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
            Isi data usaha Anda. Kategori usaha menentukan menu dan fitur yang muncul. Anda bisa menambah outlet nanti.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
            )}
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-[var(--foreground)]">
                Kategori usaha
              </label>
              <select
                id="category"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value as OutletType)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                required
              >
                {BUSINESS_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Menu dan fitur (POS, Kategori, Stok Toko, dll.) disesuaikan dengan kategori.
              </p>
            </div>
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

import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getReceiptPrinterType,
  setReceiptPrinterType,
  getReceiptLocalUrl,
  setReceiptLocalUrl,
  type ReceiptPrinterType,
} from "@/lib/receipt";

export function TokoPage() {
  const { orgId } = useOrg();
  const [phone, setPhone] = useState("");
  const [catalogSlug, setCatalogSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [receiptPrinter, setReceiptPrinter] = useState<ReceiptPrinterType>("dialog");

  const [localPrintUrl, setLocalPrintUrl] = useState("http://localhost:3999");

  useEffect(() => {
    setReceiptPrinter(getReceiptPrinterType());
    setLocalPrintUrl(getReceiptLocalUrl());
  }, []);

  function handleReceiptPrinterChange(value: ReceiptPrinterType) {
    setReceiptPrinter(value);
    setReceiptPrinterType(value);
  }

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
    setSuccess(false);
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
    else {
      setSuccess(true);
      if (slug) setCatalogSlug(slug);
      setTimeout(() => setSuccess(false), 3000);
    }
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
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Info toko berhasil disimpan.
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

      <div className="max-w-md space-y-4 border-t border-[var(--border)] pt-6">
        <h3 className="text-lg font-medium text-[var(--foreground)]">Cetak Struk</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          Jenis printer untuk cetak struk otomatis saat bayar dengan Enter di POS.
        </p>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
            Jenis printer struk
          </label>
          <select
            value={receiptPrinter}
            onChange={(e) => handleReceiptPrinterChange(e.target.value as ReceiptPrinterType)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="dialog">Dialog print (USB / Bluetooth sistem)</option>
            <option value="bluetooth">Thermal Bluetooth (BLE)</option>
            <option value="local">App lokal (direct, tanpa dialog)</option>
          </select>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Dialog: jendela print browser. BLE: langsung ke printer thermal Bluetooth. App lokal: install Hisabia Print Agent di PC, cetak direct ke printer USB/Bluetooth.
          </p>
        </div>
        {receiptPrinter === "local" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              URL App Print Agent
            </label>
            <Input
              value={localPrintUrl}
              onChange={(e) => {
                const v = e.target.value;
                setLocalPrintUrl(v);
                setReceiptLocalUrl(v);
              }}
              placeholder="http://localhost:3999"
            />
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Jalankan Hisabia Print Agent di PC ini, lalu isi URL yang sama (default: http://localhost:3999).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

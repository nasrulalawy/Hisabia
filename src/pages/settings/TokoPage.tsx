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
import {
  getNiimbotLabelFields,
  setNiimbotLabelFields,
  NIIMBOT_LABEL_FIELD_OPTIONS,
  type NiimbotLabelFieldId,
} from "@/lib/niimbot";

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
  const [niimbotLabelFields, setNiimbotLabelFieldsState] = useState<NiimbotLabelFieldId[]>([]);

  useEffect(() => {
    setReceiptPrinter(getReceiptPrinterType());
    setLocalPrintUrl(getReceiptLocalUrl());
    setNiimbotLabelFieldsState(getNiimbotLabelFields());
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

      <div className="max-w-md space-y-4 border-t border-[var(--border)] pt-6">
        <h3 className="text-lg font-medium text-[var(--foreground)]">Label NiiMBot</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          Atur isi label yang dicetak ke printer NiiMBot (Bluetooth). Urutan field = urutan baris di label.
        </p>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
            Field yang ditampilkan (urutan dari atas ke bawah)
          </label>
          <ul className="space-y-2">
            {niimbotLabelFields.map((fieldId, index) => {
              const opt = NIIMBOT_LABEL_FIELD_OPTIONS.find((o) => o.id === fieldId);
              return (
                <li
                  key={fieldId}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2"
                >
                  <span className="flex-1 text-sm">{opt?.label ?? fieldId}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...niimbotLabelFields];
                        const t = next[index - 1];
                        next[index - 1] = next[index];
                        next[index] = t;
                        setNiimbotLabelFieldsState(next);
                        setNiimbotLabelFields(next);
                      }}
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Naik
                    </button>
                    <button
                      type="button"
                      disabled={index === niimbotLabelFields.length - 1}
                      onClick={() => {
                        const next = [...niimbotLabelFields];
                        const t = next[index + 1];
                        next[index + 1] = next[index];
                        next[index] = t;
                        setNiimbotLabelFieldsState(next);
                        setNiimbotLabelFields(next);
                      }}
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Turun
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = niimbotLabelFields.filter((_, i) => i !== index);
                        setNiimbotLabelFieldsState(next);
                        setNiimbotLabelFields(next);
                      }}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {niimbotLabelFields.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Belum ada field. Tambah di bawah.</p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Tambah field</label>
          <div className="flex flex-wrap gap-2">
            {NIIMBOT_LABEL_FIELD_OPTIONS.filter((o) => !niimbotLabelFields.includes(o.id)).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const next = [...niimbotLabelFields, opt.id];
                  setNiimbotLabelFieldsState(next);
                  setNiimbotLabelFields(next);
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm hover:bg-[var(--muted)]"
              >
                + {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

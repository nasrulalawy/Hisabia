import { useEffect, useState, useRef } from "react";
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
  getNiimbotLabelDesign,
  setNiimbotLabelDesign,
  buildLabelCanvasFromDesign,
  NIIMBOT_LABEL_FIELD_OPTIONS,
  connectNiimbot,
  disconnectNiimbot,
  getNiimbotConnection,
  nextLabelElementId,
  LABEL_WIDTH_PX,
  LABEL_HEIGHT_PX,
  type LabelDesign,
  type LabelElement,
  type LabelElementField,
  type LabelElementStaticText,
  type LabelElementLine,
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
  const [labelDesign, setLabelDesignState] = useState<LabelDesign>(() => getNiimbotLabelDesign());
  const [expandedElementId, setExpandedElementId] = useState<string | null>(null);
  const [niimbotConnected, setNiimbotConnected] = useState(false);
  const [niimbotConnecting, setNiimbotConnecting] = useState(false);
  const [niimbotConnError, setNiimbotConnError] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const SAMPLE_PRODUCT = {
    name: "Contoh Produk",
    barcode: "1234567890123",
    price: 25000,
    sku: "SKU-001",
    stock: 42,
  };

  useEffect(() => {
    setNiimbotConnected(!!getNiimbotConnection());
  }, []);

  useEffect(() => {
    setReceiptPrinter(getReceiptPrinterType());
    setLocalPrintUrl(getReceiptLocalUrl());
    setLabelDesignState(getNiimbotLabelDesign());
  }, []);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = LABEL_WIDTH_PX;
    canvas.height = LABEL_HEIGHT_PX;
    if (labelDesign.elements.length === 0) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, LABEL_WIDTH_PX, LABEL_HEIGHT_PX);
      return;
    }
    const source = buildLabelCanvasFromDesign(labelDesign, SAMPLE_PRODUCT);
    ctx.drawImage(source, 0, 0);
  }, [labelDesign]);

  function updateLabelDesign(design: LabelDesign) {
    setLabelDesignState(design);
    setNiimbotLabelDesign(design);
  }

  function moveElement(fromIndex: number, toIndex: number) {
    const next = [...labelDesign.elements];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    updateLabelDesign({ elements: next });
  }

  function updateElement(index: number, patch: Partial<LabelElement>) {
    const next = [...labelDesign.elements];
    next[index] = { ...next[index], ...patch } as LabelElement;
    updateLabelDesign({ elements: next });
  }

  function removeElement(index: number) {
    const next = labelDesign.elements.filter((_, i) => i !== index);
    updateLabelDesign({ elements: next });
    if (labelDesign.elements[index]?.id === expandedElementId) setExpandedElementId(null);
  }

  function addElementField(fieldId: NiimbotLabelFieldId) {
    const el: LabelElementField = {
      id: nextLabelElementId(),
      type: "field",
      fieldId,
      fontSize: 18,
      fontBold: true,
      align: "left",
    };
    updateLabelDesign({ elements: [...labelDesign.elements, el] });
  }

  function addElementStaticText() {
    const el: LabelElementStaticText = {
      id: nextLabelElementId(),
      type: "static_text",
      text: "Teks statis",
      fontSize: 18,
      fontBold: true,
      align: "left",
    };
    updateLabelDesign({ elements: [...labelDesign.elements, el] });
  }

  function addElementLine() {
    const el: LabelElementLine = {
      id: nextLabelElementId(),
      type: "line",
      thickness: 2,
    };
    updateLabelDesign({ elements: [...labelDesign.elements, el] });
  }

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
          Hubungkan printer NiiMBot di sini sekali. Di POS dan detail produk, tombol cetak label hanya akan
          mencetak ke printer yang sudah terhubung.
        </p>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-4">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {niimbotConnected ? "Printer terhubung" : "Printer belum terhubung"}
          </span>
          {niimbotConnected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                disconnectNiimbot();
                setNiimbotConnected(false);
                setNiimbotConnError(null);
              }}
            >
              Putuskan
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={niimbotConnecting || !("bluetooth" in navigator && navigator.bluetooth)}
              onClick={async () => {
                setNiimbotConnecting(true);
                setNiimbotConnError(null);
                try {
                  await connectNiimbot();
                  setNiimbotConnected(true);
                } catch (err) {
                  setNiimbotConnError(err instanceof Error ? err.message : "Gagal menghubungkan NiiMBot");
                } finally {
                  setNiimbotConnecting(false);
                }
              }}
            >
              {niimbotConnecting ? "Menghubungkan..." : "Hubungkan NiiMBot"}
            </Button>
          )}
        </div>
        {niimbotConnError && (
          <p className="text-sm text-red-600">{niimbotConnError}</p>
        )}

        <p className="text-sm text-[var(--muted-foreground)]">
          Desain label: atur elemen (field produk, teks statis, garis), urutan drag-and-drop, font &amp; ukuran.
        </p>

        {/* Preview label */}
        <div className="rounded-lg border border-[var(--border)] bg-white p-2">
          <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">Preview (contoh data)</p>
          <canvas
            ref={previewCanvasRef}
            width={LABEL_WIDTH_PX}
            height={LABEL_HEIGHT_PX}
            className="max-h-32 w-full border border-[var(--border)] object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Daftar elemen - drag & drop */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
            Elemen label (seret untuk mengubah urutan)
          </label>
          <ul className="space-y-2">
            {labelDesign.elements.map((el, index) => (
              <li
                key={el.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(index));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                  if (Number.isNaN(from) || from === index) return;
                  moveElement(from, index);
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="cursor-grab text-[var(--muted-foreground)]" title="Seret untuk pindah">⋮⋮</span>
                  <span className="flex-1 text-sm">
                    {el.type === "field" && (NIIMBOT_LABEL_FIELD_OPTIONS.find((o) => o.id === el.fieldId)?.label ?? el.fieldId)}
                    {el.type === "static_text" && `Teks: "${(el.text || "").slice(0, 20)}${(el.text || "").length > 20 ? "…" : ""}"`}
                    {el.type === "line" && `Garis (${el.thickness ?? 2}px)`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveElement(index, index - 1)}
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Naik
                    </button>
                    <button
                      type="button"
                      disabled={index === labelDesign.elements.length - 1}
                      onClick={() => moveElement(index, index + 1)}
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Turun
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedElementId(expandedElementId === el.id ? null : el.id)}
                      className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                    >
                      {expandedElementId === el.id ? "Tutup" : "Atur"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeElement(index)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                {expandedElementId === el.id && (
                  <div className="border-t border-[var(--border)] bg-[var(--muted)]/10 px-3 py-3">
                    {(el.type === "field" || el.type === "static_text") && (
                      <>
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-1 text-xs">
                            Ukuran font
                            <select
                              value={el.fontSize ?? 18}
                              onChange={(e) => updateElement(index, { fontSize: Number(e.target.value) })}
                              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                            >
                              {[12, 14, 16, 18, 20, 24].map((n) => (
                                <option key={n} value={n}>{n}px</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={el.fontBold ?? true}
                              onChange={(e) => updateElement(index, { fontBold: e.target.checked })}
                            />
                            Tebal
                          </label>
                          <span className="text-xs">Rata:</span>
                          {(["left", "center", "right"] as const).map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => updateElement(index, { align: a })}
                              className={`rounded border px-2 py-1 text-xs ${(el.align ?? "left") === a ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)]"}`}
                            >
                              {a === "left" ? "Kiri" : a === "center" ? "Tengah" : "Kanan"}
                            </button>
                          ))}
                        </div>
                        {el.type === "static_text" && (
                          <Input
                            value={el.text}
                            onChange={(e) => updateElement(index, { text: e.target.value })}
                            placeholder="Teks statis"
                            className="text-sm"
                          />
                        )}
                        {el.type === "field" && (
                          <div className="flex flex-wrap gap-1">
                            {NIIMBOT_LABEL_FIELD_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => updateElement(index, { fieldId: opt.id })}
                                className={`rounded border px-2 py-1 text-xs ${el.fieldId === opt.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)]"}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {el.type === "line" && (
                      <label className="flex items-center gap-2 text-xs">
                        Ketebalan (px)
                        <select
                          value={el.thickness ?? 2}
                          onChange={(e) => updateElement(index, { thickness: Number(e.target.value) })}
                          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {labelDesign.elements.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">Belum ada elemen. Tambah di bawah.</p>
          )}
        </div>

        {/* Tambah elemen */}
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Tambah elemen</label>
          <div className="flex flex-wrap gap-2">
            {NIIMBOT_LABEL_FIELD_OPTIONS.map((opt) => (
              <Button key={opt.id} type="button" variant="outline" size="sm" onClick={() => addElementField(opt.id)}>
                + {opt.label}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addElementStaticText}>
              + Teks statis
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addElementLine}>
              + Garis
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

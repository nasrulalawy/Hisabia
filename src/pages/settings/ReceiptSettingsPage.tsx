import { useEffect, useState } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getReceiptSettings,
  setReceiptSettings,
  buildReceiptHtml,
  DEFAULT_RECEIPT_SETTINGS,
  DEFAULT_BLOCK_LAYOUT,
  type ReceiptSettings,
  type ReceiptData,
  type ReceiptBlockId,
  type ReceiptBlockLayout,
} from "@/lib/receipt";

const SAMPLE_RECEIPT_DATA: ReceiptData = {
  orderId: "ABC12345",
  outletName: "Nama Toko",
  date: new Date(),
  items: [
    { name: "1 Ice Pistachio Latte", qty: 1, unit: "pcs", price: 20000, lineTotal: 20000 },
  ],
  subtotal: 20000,
  discount: 0,
  total: 20000,
  paymentMethod: "qris",
  notes: "Take away",
  cashierName: "Zaki",
  cashReceived: 20000,
};

export function ReceiptSettingsPage() {
  const { currentOutletId, currentOutlet } = useOrg();
  const [form, setForm] = useState<ReceiptSettings>({ ...DEFAULT_RECEIPT_SETTINGS });
  const [saved, setSaved] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  useEffect(() => {
    if (!currentOutletId) return;
    const s = getReceiptSettings(currentOutletId);
    setForm({
      ...s,
      storeName: s.storeName.trim() || currentOutlet?.name || "",
      address: s.address.trim() || currentOutlet?.address || "",
    });
  }, [currentOutletId, currentOutlet?.name, currentOutlet?.address]);

  useEffect(() => {
    const data: ReceiptData = {
      ...SAMPLE_RECEIPT_DATA,
      outletName: form.storeName.trim() || currentOutlet?.name || "Toko",
      receiptSettings: form,
    };
    setPreviewHtml(buildReceiptHtml(data));
  }, [form, currentOutlet?.name]);

  function update<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function getBlock(blockId: ReceiptBlockId): ReceiptBlockLayout {
    return { ...DEFAULT_BLOCK_LAYOUT[blockId], ...form.blockLayout?.[blockId] };
  }

  function updateBlock(blockId: ReceiptBlockId, patch: Partial<ReceiptBlockLayout>) {
    setForm((f) => ({
      ...f,
      blockLayout: {
        ...f.blockLayout,
        [blockId]: { ...DEFAULT_BLOCK_LAYOUT[blockId], ...f.blockLayout?.[blockId], ...patch },
      },
    }));
    setSaved(false);
  }

  const BLOCK_LABELS: Record<ReceiptBlockId, string> = {
    header: "Nama toko",
    address: "Alamat",
    dateCashier: "Tanggal & Kasir",
    status: "# LUNAS #",
    items: "Daftar item",
    total: "TOTAL & Pembayaran",
    notes: "Keterangan",
    footer: "Footer (Instagram, WiFi, Powered By)",
  };

  function handleSave() {
    if (!currentOutletId) return;
    setReceiptSettings(currentOutletId, form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!currentOutletId) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6">
        <p className="text-[var(--muted-foreground)]">Pilih outlet terlebih dahulu di header.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Pengaturan Struk</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Atur tampilan struk thermal (header, footer, status LUNAS, kasir, dll). Kosongkan nama toko/alamat untuk pakai data dari Info Toko.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6 rounded-lg border border-[var(--border)] bg-[var(--background)] p-6">
          <h2 className="text-lg font-medium text-[var(--foreground)]">Header</h2>
          <div>
            <label className="mb-1 block text-sm font-medium">Nama toko</label>
            <Input
              value={form.storeName}
              onChange={(e) => update("storeName", e.target.value)}
              placeholder={currentOutlet?.name ?? "Nama toko"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Alamat (satu baris atau beberapa baris)</label>
            <textarea
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] min-h-[80px]"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder={currentOutlet?.address ?? "Jl. ..."}
              rows={3}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showDate}
                onChange={(e) => update("showDate", e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm">Tampilkan tanggal</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showTime}
                onChange={(e) => update("showTime", e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm">Tampilkan jam</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.dateTimeFormatLong}
                onChange={(e) => update("dateTimeFormatLong", e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm">Format panjang (Selasa, 03/03/2026 18:56)</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showCashier}
                onChange={(e) => update("showCashier", e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm">Tampilkan kasir</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm">Label kasir:</label>
              <Input
                value={form.cashierLabel}
                onChange={(e) => update("cashierLabel", e.target.value)}
                className="w-24"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Teks status lunas (tengah)</label>
            <Input
              value={form.statusPaidText}
              onChange={(e) => update("statusPaidText", e.target.value)}
              placeholder="# LUNAS #"
            />
          </div>

          <h2 className="text-lg font-medium text-[var(--foreground)] pt-4">Ringkasan & pembayaran</h2>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showPaymentMethodLine}
                onChange={(e) => update("showPaymentMethodLine", e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm">Baris Pembayaran (QRIS/Tunai + nominal)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showTotalBayar}
                onChange={(e) => update("showTotalBayar", e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm">Total Bayar</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showKembalian}
                onChange={(e) => update("showKembalian", e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <span className="text-sm">Kembalian</span>
            </label>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Baris &quot;Keterangan&quot; di struk menampilkan catatan yang diketik di POS saat bayar (mis. Take away, Meja 3).
          </p>

          <h2 className="text-lg font-medium text-[var(--foreground)] pt-6">Layout struk (canvas)</h2>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            Atur per blok: alignment (kiri/tengah), garis pemisah sebelum/sesudah, dan jarak setelah. Preview di samping mengikuti pengaturan ini.
          </p>
          <div className="space-y-4">
            {(Object.keys(DEFAULT_BLOCK_LAYOUT) as ReceiptBlockId[]).map((blockId) => {
              const lay = getBlock(blockId);
              return (
                <div
                  key={blockId}
                  className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 p-4"
                >
                  <div className="mb-2 font-medium text-sm text-[var(--foreground)]">
                    {BLOCK_LABELS[blockId]}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <label className="mr-2 text-xs text-[var(--muted-foreground)]">Alignment</label>
                      <select
                        className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                        value={lay.alignment}
                        onChange={(e) => updateBlock(blockId, { alignment: e.target.value as "left" | "center" })}
                      >
                        <option value="left">Kiri</option>
                        <option value="center">Tengah</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={lay.separatorBefore}
                        onChange={(e) => updateBlock(blockId, { separatorBefore: e.target.checked })}
                        className="rounded border-[var(--border)]"
                      />
                      <span>Garis sebelum</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={lay.separatorAfter}
                        onChange={(e) => updateBlock(blockId, { separatorAfter: e.target.checked })}
                        className="rounded border-[var(--border)]"
                      />
                      <span>Garis sesudah</span>
                    </label>
                    <div>
                      <label className="mr-2 text-xs text-[var(--muted-foreground)]">Jarak sebelum</label>
                      <select
                        className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                        value={lay.linesBefore}
                        onChange={(e) => updateBlock(blockId, { linesBefore: Number(e.target.value) as 0 | 1 | 2 })}
                      >
                        <option value={0}>0</option>
                        <option value={1}>1 baris</option>
                        <option value={2}>2 baris</option>
                      </select>
                    </div>
                    <div>
                      <label className="mr-2 text-xs text-[var(--muted-foreground)]">Jarak sesudah</label>
                      <select
                        className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                        value={lay.linesAfter}
                        onChange={(e) => updateBlock(blockId, { linesAfter: Number(e.target.value) as 0 | 1 | 2 })}
                      >
                        <option value={0}>0</option>
                        <option value={1}>1 baris</option>
                        <option value={2}>2 baris</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="text-lg font-medium text-[var(--foreground)] pt-6">Footer</h2>
          <div>
            <label className="mb-1 block text-sm font-medium">Instagram</label>
            <Input
              value={form.footerInstagram}
              onChange={(e) => update("footerInstagram", e.target.value)}
              placeholder="Instagram @username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password WiFi / teks promo</label>
            <Input
              value={form.footerWifi}
              onChange={(e) => update("footerWifi", e.target.value)}
              placeholder="Password WiFi ..."
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Struk selalu menampilkan &quot;Powered By Hisabia&quot; di footer.
          </p>

          <Button onClick={handleSave}>{saved ? "Tersimpan" : "Simpan pengaturan"}</Button>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6">
          <h2 className="text-lg font-medium text-[var(--foreground)] mb-4">Preview struk</h2>
          <div className="rounded border border-[var(--border)] bg-[var(--muted)]/30 p-4 overflow-auto">
            <iframe
              title="Preview struk"
              srcDoc={previewHtml}
              className="h-[480px] w-full max-w-[280px] border-0 bg-white shrink-0"
              sandbox="allow-same-origin"
            />
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Struk di POS akan mengikuti pengaturan ini. Format Rp + nominal tanpa spasi untuk thermal BLE.
          </p>
        </div>
      </div>
    </div>
  );
}

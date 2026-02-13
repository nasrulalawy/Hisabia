export function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-[var(--foreground)]">Koneksi WhatsApp</h2>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
        <p className="font-medium">Fitur tidak tersedia</p>
        <p className="mt-1 text-sm">
          Aplikasi ini di-deploy tanpa server API (mis. Vercel). Koneksi WhatsApp membutuhkan server (Node.js) yang tidak disediakan. Untuk kirim pengingat ke pelanggan, gunakan nomor WA toko secara manual atau integrasi lain.
        </p>
      </div>
    </div>
  );
}

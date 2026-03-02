# Hisabia Print Agent

Aplikasi kecil untuk cetak struk **langsung** (tanpa dialog print) dari browser Hisabia ke printer thermal USB/Bluetooth yang terpasang di PC.

## Cara pakai (untuk pengguna)

### Opsi A: Pakai installer .exe (tanpa perlu Node.js)

1. Download **HisabiaPrintAgent-Setup-1.0.0.exe** (dari release atau hasil build).
2. Jalankan installer, ikuti langkah (bisa pilih shortcut Desktop / jalankan saat Windows startup).
3. Set **printer default** di Windows ke printer thermal Anda.
4. Jalankan **Hisabia Print Agent** dari shortcut — app berjalan di **background** dengan **ikon di system tray** (dekat jam/baterai), tanpa jendela CMD di taskbar. Klik kanan ikon → "Buka status" atau "Keluar".
5. Di **Hisabia** (Setting → Info Toko → Cetak Struk): pilih **"App lokal"**, URL: `http://localhost:3999`.
6. Saat bayar di POS dengan Enter (bayar + cetak), struk langsung keluar di printer.

### Opsi B: Jalankan dari sumber (Node.js)

1. **Pasang printer** thermal di Windows dan set sebagai printer default.
2. Install **Node.js** (LTS) dari [nodejs.org](https://nodejs.org).
3. Di folder ini:
   ```bash
   npm install
   npm start
   ```
4. Di Hisabia pilih "App lokal" dan URL `http://localhost:3999`.

## Port & printer

- **Port default:** 3999. Ganti dengan env: `PORT=4000 npm start`
- **Printer:** Pakai printer default Windows. Untuk pilih printer tertentu:  
  `PRINTER_NAME="Nama Printer Anda" npm start`

## Cek status

Buka di browser: [http://localhost:3999/health](http://localhost:3999/health)  
Akan tampil printer default dan status agent.

## Build .exe dan installer (untuk developer)

1. Install dependency: `npm install`
2. Build file .exe tunggal:
   ```bash
   npm run build:exe
   ```
   Hasil: `dist/hisabia-print-agent.exe` (bisa dijalankan langsung, tidak perlu Node.js).
3. (Opsional) Build installer Windows:
   - Install [Inno Setup 6](https://jrsoftware.org/isinfo.php)
   - Jalankan: `iscc installer.iss`  
   Atau buka `installer.iss` di Inno Setup Compiler.  
   Hasil: `installer/HisabiaPrintAgent-Setup-1.0.0.exe`.

## Troubleshooting

- **"Cetak gagal" / "Tidak ada printer"**  
  Set printer default di Windows (Settings → Devices → Printers) atau set env `PRINTER_NAME`.

- **"Gagal cetak. Pastikan Print Agent berjalan"**  
  Pastikan Print Agent jalan (double-click .exe atau `npm start`) di PC yang sama dengan browser.

- **Struk tidak keluar / format aneh**  
  Pastikan driver printer thermal terpasang dan printer mendukung ESC/POS (umum untuk struk 58mm/80mm).

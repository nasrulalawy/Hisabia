/**
 * Hisabia Print Agent
 * Jalankan di PC yang terpasang printer thermal (USB/Bluetooth).
 * Browser Hisabia mengirim data struk ke http://localhost:3999/print untuk cetak direct.
 * Cetak via PowerShell + Win32 (tanpa native module) agar bisa di-pack jadi .exe.
 */

const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { buildEscPosBuffer } = require("./escpos.js");

const PORT = Number(process.env.PORT) || 3999;
const PRINTER_NAME = process.env.PRINTER_NAME || null;

// Script PowerShell (embed agar .exe tidak perlu file .ps1 terpisah)
const PS1_SCRIPT = `# Hisabia raw print
param([Parameter(Mandatory=$true)][string]$Path,[string]$PrinterName)
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $Path)) { Write-Error "File not found"; exit 1 }
$bytes = [System.IO.File]::ReadAllBytes($Path)
if ($bytes.Length -eq 0) { Write-Error "File empty"; exit 1 }
if (-not $PrinterName) {
  try { $PrinterName = (New-Object -ComObject WScript.Network).DefaultPrinter }
  catch { $PrinterName = (Get-CimInstance Win32_Printer -Filter "Default=$true" -EA 0 | Select-Object -First 1 -ExpandProperty Name) }
  if (-not $PrinterName) { Write-Error "No default printer"; exit 1 }
}
Add-Type -TypeDefinition @"
using System; using System.IO; using System.Runtime.InteropServices;
public class R { [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)] public class D { [MarshalAs(UnmanagedType.LPStr)] public string pDocName;[MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;[MarshalAs(UnmanagedType.LPStr)] public string pDatatype; }
[DllImport("winspool.Drv",EntryPoint="OpenPrinterA",SetLastError=true,CharSet=CharSet.Ansi,ExactSpelling=true,CallingConvention=CallingConvention.StdCall)] public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)]string s,out IntPtr h,IntPtr p);
[DllImport("winspool.Drv",EntryPoint="ClosePrinter",SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);
[DllImport("winspool.Drv",EntryPoint="StartDocPrinterA",SetLastError=true,CharSet=CharSet.Ansi)] public static extern bool StartDocPrinter(IntPtr h,int l,[In,MarshalAs(UnmanagedType.LPStruct)]D d);
[DllImport("winspool.Drv",EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
[DllImport("winspool.Drv",EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
[DllImport("winspool.Drv",EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
[DllImport("winspool.Drv",EntryPoint="WritePrinter",SetLastError=true)] public static extern bool WritePrinter(IntPtr h,IntPtr b,int c,out int w);
public static bool Go(string pn,string fp){ var b=File.ReadAllBytes(fp); IntPtr p=Marshal.AllocCoTaskMem(b.Length); try { Marshal.Copy(b,0,p,b.Length); IntPtr h=IntPtr.Zero; if(!OpenPrinter(pn.Normalize(),out h,IntPtr.Zero)) return false; var d=new D{pDocName="Hisabia",pOutputFile=null,pDatatype="RAW"}; if(!StartDocPrinter(h,1,d)){ClosePrinter(h);return false;} if(!StartPagePrinter(h)){EndDocPrinter(h);ClosePrinter(h);return false;} int w; bool ok=WritePrinter(h,p,b.Length,out w)&&w==b.Length; EndPagePrinter(h);EndDocPrinter(h);ClosePrinter(h); return ok; } finally{Marshal.FreeCoTaskMem(p);} }
}
"@ -ErrorAction Stop
if (-not [R]::Go($PrinterName,$Path)) { Write-Error "WritePrinter failed"; exit 1 }
"`;

let cachedPs1Path = null;
function getPs1Path() {
  if (cachedPs1Path) return cachedPs1Path;
  try {
    const external = path.join(__dirname, "print-raw.ps1");
    if (fs.existsSync(external)) {
      cachedPs1Path = external;
      return cachedPs1Path;
    }
  } catch (_) {}
  const tmp = path.join(os.tmpdir(), "hisabia-print-raw.ps1");
  fs.writeFileSync(tmp, PS1_SCRIPT, "utf8");
  cachedPs1Path = tmp;
  return cachedPs1Path;
}

function getDefaultPrinterName() {
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell", [
      "-NoProfile",
      "-Command",
      "try { (New-Object -ComObject WScript.Network).DefaultPrinter } catch { (Get-CimInstance -ClassName Win32_Printer -Filter 'Default=$true' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Name) }",
    ], { windowsHide: true });
    let out = "";
    let err = "";
    ps.stdout.on("data", (d) => { out += d.toString(); });
    ps.stderr.on("data", (d) => { err += d.toString(); });
    ps.on("close", (code) => {
      const name = out.trim();
      if (code === 0 && name) resolve(name);
      else reject(new Error(err || "Tidak ada printer default"));
    });
  });
}

function printRawToPrinter(buffer, printerName) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `hisabia-receipt-${Date.now()}.bin`);
    fs.writeFile(tmpFile, buffer, (errWrite) => {
      if (errWrite) return reject(errWrite);
      const ps1Path = getPs1Path();
      const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1Path, "-Path", tmpFile];
      if (printerName) args.push("-PrinterName", printerName);
      const ps = spawn("powershell", args, { windowsHide: true });
      let stderr = "";
      ps.stderr.on("data", (d) => { stderr += d.toString(); });
      ps.on("close", (code) => {
        fs.unlink(tmpFile, () => {});
        if (code === 0) resolve();
        else reject(new Error(stderr || `PowerShell exit ${code}`));
      });
    });
  });
}

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: "100kb" }));

app.post("/print", async (req, res) => {
  const body = req.body;
  if (!body || !body.orderId || !Array.isArray(body.items)) {
    return res.status(400).send("Bad request: butuh orderId dan items");
  }

  let buffer;
  try {
    buffer = buildEscPosBuffer(body);
  } catch (err) {
    console.error("Build ESC/POS error:", err);
    return res.status(400).send("Format data struk salah");
  }

  let printerName = PRINTER_NAME;
  if (!printerName) {
    try {
      printerName = await getDefaultPrinterName();
    } catch (e) {
      console.error("Printer default:", e.message);
      return res.status(500).send("Tidak ada printer default. Set printer default di Windows atau env PRINTER_NAME.");
    }
  }

  try {
    await printRawToPrinter(buffer, printerName);
    console.log("Cetak OK orderId:", body.orderId);
    res.status(200).send("OK");
  } catch (err) {
    console.error("Cetak gagal:", err);
    res.status(500).send(err.message || "Cetak gagal");
  }
});

app.get("/health", async (req, res) => {
  let defaultPrinter = null;
  try {
    defaultPrinter = await getDefaultPrinterName();
  } catch (_) {}
  res.json({
    ok: true,
    defaultPrinter,
    message: "Hisabia Print Agent jalan",
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log("Hisabia Print Agent listening on http://127.0.0.1:" + PORT);
  console.log("POST /print = terima struk, GET /health = cek status");
  getDefaultPrinterName().then((n) => console.log("Printer:", PRINTER_NAME || n)).catch(() => console.log("Printer: (set default di Windows)"));
});

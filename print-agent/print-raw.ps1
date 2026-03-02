# Send raw bytes (ESC/POS) to Windows printer. Usage: .\print-raw.ps1 -Path "C:\path\to\file.bin" [-PrinterName "Printer Name"]
param(
    [Parameter(Mandatory=$true)]
    [string]$Path,
    [string]$PrinterName
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "File not found: $Path"
    exit 1
}
$bytes = [System.IO.File]::ReadAllBytes($Path)
if ($bytes.Length -eq 0) {
    Write-Error "File is empty"
    exit 1
}

if (-not $PrinterName) {
    try {
        $net = New-Object -ComObject WScript.Network
        $PrinterName = $net.DefaultPrinter
    } catch {
        $default = Get-CimInstance -ClassName Win32_Printer -Filter "Default=$true" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Name
        if ($default) { $PrinterName = $default } else { Write-Error "No default printer"; exit 1 }
    }
}

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDatatype;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendFile(string printerName, string filePath) {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
        try {
            Marshal.Copy(bytes, 0, pBytes, bytes.Length);
            return SendBytes(printerName, pBytes, bytes.Length);
        } finally { Marshal.FreeCoTaskMem(pBytes); }
    }
    public static bool SendBytes(string printerName, IntPtr pBytes, int length) {
        IntPtr hPrinter = IntPtr.Zero;
        try {
            if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) return false;
            var di = new DOCINFOA { pDocName = "Hisabia Receipt", pOutputFile = null, pDatatype = "RAW" };
            if (!StartDocPrinter(hPrinter, 1, di)) return false;
            if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); return false; }
            int written;
            bool ok = WritePrinter(hPrinter, pBytes, length, out written) && written == length;
            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            return ok;
        } finally {
            if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
        }
    }
}
"@
Add-Type -TypeDefinition $code -ErrorAction Stop
$ok = [RawPrinter]::SendFile($PrinterName, $Path)
if (-not $ok) {
    Write-Error "WritePrinter failed. Check printer name and driver."
    exit 1
}

# Hisabia Print Agent - System Tray
# Menjalankan Print Agent di background dengan ikon di system tray (dekat jam/baterai).
# Tidak ada jendela CMD di taskbar.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$appDir = $PSScriptRoot
$exePath = Join-Path $appDir "hisabia-print-agent.exe"
if (-not (Test-Path -LiteralPath $exePath)) {
    [System.Windows.Forms.MessageBox]::Show("File tidak ditemukan: hisabia-print-agent.exe", "Hisabia Print Agent", "OK", "Error")
    exit 1
}

$agentProcess = $null
$form = New-Object System.Windows.Forms.Form
$form.Visible = $false
$form.WindowState = "Minimized"
$form.ShowInTaskbar = $false

$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.SystemIcons]::Application
$icon.Text = "Hisabia Print Agent - Jalan di background"
$icon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add("Buka status (localhost:3999)")
$openItem.Add_Click({
    Start-Process "http://localhost:3999/health"
})
$exitItem = $menu.Items.Add("Keluar")
$exitItem.Add_Click({
    if ($agentProcess -and -not $agentProcess.HasExited) {
        $agentProcess.Kill()
    }
    $icon.Visible = $false
    [System.Windows.Forms.Application]::Exit()
})
$icon.ContextMenuStrip = $menu

$icon.Add_DoubleClick({
    Start-Process "http://localhost:3999/health"
})

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $exePath
$psi.WorkingDirectory = $appDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$agentProcess = [System.Diagnostics.Process]::Start($psi)

[System.Windows.Forms.Application]::Run($form)

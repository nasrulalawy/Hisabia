; Inno Setup script - Hisabia Print Agent
; Butuh Inno Setup 6: https://jrsoftware.org/isinfo.php
; Build: jalankan "Build:exe" dulu, lalu buka installer.iss di Inno Setup Compiler, atau: iscc installer.iss

#define MyAppName "Hisabia Print Agent"
#define MyAppVersion "1.0.0"
#define MyAppExe "hisabia-print-agent.exe"
#define MyAppUrl "https://hisabia.app"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Hisabia
DefaultDirName={autopf}\Hisabia Print Agent
DefaultGroupName=Hisabia
DisableProgramGroupPage=yes
OutputDir=installer
OutputBaseFilename=HisabiaPrintAgent-Setup-{#MyAppVersion}
SetupIconFile=
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Buat shortcut di Desktop"; GroupDescription: "Shortcut:"; Flags: unchecked
Name: "startupicon"; Description: "Jalankan saat Windows startup"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
Source: "dist\{#MyAppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "tray.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-hidden.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-tray.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-tray.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Jalankan via wscript.exe agar .vbs tidak salah dijalankan (hindari error 193)
Name: "{group}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-tray.vbs"""; Comment: "Jalankan di background dengan ikon di system tray"
Name: "{group}\Cek status Print Agent"; Filename: "http://localhost:3999/health"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-tray.vbs"""; Tasks: desktopicon; Comment: "Hisabia Print Agent (system tray)"

[Run]
; Post-install: jalankan via wscript
Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-tray.vbs"""; Description: "Jalankan Print Agent sekarang (ikon di system tray)"; Flags: nowait postinstall skipifsilent
; Startup: wscript supaya tidak error 193
Filename: "reg.exe"; Parameters: "add ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v ""Hisabia Print Agent"" /t REG_SZ /d ""{sys}\wscript.exe"" ""{app}\start-tray.vbs"" /f"; Flags: runhidden; Tasks: startupicon

[UninstallRun]
Filename: "reg.exe"; Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v ""Hisabia Print Agent"" /f"; Flags: runhidden; Tasks: startupicon

; Saat compile, pastikan sudah jalankan: npm run build:exe (agar dist\hisabia-print-agent.exe ada)

' Jalankan Print Agent dengan tray - tanpa jendela CMD
' Pakai cmd.exe /c agar Windows tidak error 193 (parsing aman)
Option Explicit
Dim fso, sh, scriptDir, psExe, trayPath, cmdLine
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

psExe = sh.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
If Not fso.FileExists(psExe) Then
  psExe = "powershell.exe"
End If

trayPath = scriptDir & "\tray.ps1"
' cmd.exe /c "path\to\powershell.exe" -NoProfile ... -File "path\to\tray.ps1"
cmdLine = "cmd.exe /c """ & psExe & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & trayPath & """"
sh.Run cmdLine, 0, False

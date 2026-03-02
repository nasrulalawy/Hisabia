' Hisabia Print Agent - Jalankan tanpa jendela CMD (hidden)
' 0 = Hide window, False = don't wait for process
Dim fso, sh, scriptDir, exePath
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = """" & scriptDir & "\hisabia-print-agent.exe"""
sh.Run exePath, 0, False

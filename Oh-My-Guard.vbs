Set objShell = CreateObject("Shell.Application")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this .vbs file lives
strDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strScript = strDir & "\launch.ps1"

' Run PowerShell as Administrator (triggers UAC prompt)
objShell.ShellExecute "powershell.exe", _
    "-NoProfile -ExecutionPolicy Bypass -File """ & strScript & """", _
    strDir, "runas", 1

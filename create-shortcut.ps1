# Run this once to create the desktop shortcut
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbsPath = Join-Path $ROOT "Oh-My-Guard.vbs"
$iconPath = Join-Path $ROOT "assets\brand\icons\icon-256.png"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Oh-My-Guard!.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $ROOT
$shortcut.Description = "Oh-My-Guard! Security Platform"

# Use the shield icon from Windows (since .png can't be used directly in .lnk)
# Falls back to the security shield icon built into Windows
$shortcut.IconLocation = "$ROOT\assets\brand\icons\icon.ico, 0"

$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath" -ForegroundColor Green
Write-Host "Double-click 'Oh-My-Guard!' on your desktop to launch the system." -ForegroundColor Cyan

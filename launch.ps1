# Oh-My-Guard! System Launcher
# Starts all services with admin privileges and opens the browser

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Status($msg) {
    Write-Host "[Oh-My-Guard!] $msg" -ForegroundColor Cyan
}

# ── 1. Enable file system auditing ───────────────────────────────────────────
Write-Status "Enabling file system audit policy..."
auditpol /set /subcategory:"File System" /success:enable /failure:enable | Out-Null

# ── 2. Enable last-access time tracking ──────────────────────────────────────
Write-Status "Enabling NTFS last-access time..."
fsutil behavior set disablelastaccess 0 | Out-Null

# ── 3. Kill stale processes on our ports ─────────────────────────────────────
Write-Status "Clearing ports 3001 and 5173..."
@(3001, 5173) | ForEach-Object {
    $p = (Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue).OwningProcess
    if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1

# ── 4. Start API server ───────────────────────────────────────────────────────
Write-Status "Starting API server on port 3001..."
$apiJob = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"`$env:PORT='3001'; `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/securewatch'; `$env:NODE_ENV='development'; pnpm --filter @workspace/api-server run dev`"" `
    -WorkingDirectory $ROOT -WindowStyle Minimized -PassThru

# ── 5. Start frontend ─────────────────────────────────────────────────────────
Write-Status "Starting frontend on port 5173..."
$feJob = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"`$env:PORT='5173'; `$env:BASE_PATH='/'; pnpm --filter '@workspace/Oh-My-Guard!' run dev`"" `
    -WorkingDirectory $ROOT -WindowStyle Minimized -PassThru

# ── 6. Start file watcher ─────────────────────────────────────────────────────
Write-Status "Starting file watcher..."
$watcherJob = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command python oh-my-guard/agent/file_watcher.py --api http://localhost:3001 --device-id 1 --user-id 0" `
    -WorkingDirectory $ROOT -WindowStyle Minimized -PassThru

# ── 7. Start ETW view monitor ─────────────────────────────────────────────────
Write-Status "Starting ETW view monitor (admin)..."
$etwJob = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command python oh-my-guard/agent/etw_view_monitor.py --api http://localhost:3001 --device-id 1 --user-id 0" `
    -WorkingDirectory $ROOT -WindowStyle Minimized -PassThru

# ── 8. Wait for frontend then open browser ────────────────────────────────────
Write-Status "Waiting for services to start (up to 90s)..."
$maxWait = 90
$waited = 0
$ready = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 3
    $waited += 3
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "  Waiting... ($waited/$maxWait s)" -ForegroundColor DarkGray
}

Write-Status "Opening browser..."
Start-Process "http://localhost:5173"

Write-Status ""
Write-Status "Oh-My-Guard! is running."
Write-Status "  Frontend : http://localhost:5173"
Write-Status "  API      : http://localhost:3001"
Write-Status ""
Write-Status "Close this window to stop all services."

Read-Host "Press Enter to stop all services and exit"

# ── Cleanup ───────────────────────────────────────────────────────────────────
Write-Status "Stopping services..."
@($apiJob, $feJob, $watcherJob, $etwJob) | ForEach-Object {
    if ($_ -and !$_.HasExited) {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}
@(3001, 5173) | ForEach-Object {
    $p = (Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue).OwningProcess
    if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
}
Write-Status "All services stopped."

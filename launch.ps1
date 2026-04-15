# Oh-My-Guard! System Launcher
# Starts all services with admin privileges and opens the browser

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Status($msg) {
    Write-Host "[Oh-My-Guard!] $msg" -ForegroundColor Cyan
}

# ── 0. Auto-detect LAN IP and update .env ────────────────────────────────────
Write-Status "Detecting LAN IP address..."

# Pick the best LAN IP — prefer 192.168.x.x (home/hotspot), fall back to 10.x.x.x
# Exclude VirtualBox (192.168.56.x) and loopback
$lanIp = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*") -and
        $_.IPAddress -notlike "192.168.56.*" -and
        $_.IPAddress -ne "127.0.0.1"
    } |
    Sort-Object { if ($_.IPAddress -like "192.168.*") { 0 } else { 1 } } |
    Select-Object -First 1 -ExpandProperty IPAddress

if (-not $lanIp) {
    Write-Host "  WARNING: Could not detect LAN IP. Falling back to 192.168.1.0/24" -ForegroundColor Yellow
    $lanIp = "192.168.1.100"
}

# Derive subnet from IP (assume /24)
$subnetParts = $lanIp.Split(".")
$subnet = "$($subnetParts[0]).$($subnetParts[1]).$($subnetParts[2]).0/24"

Write-Status "  LAN IP   : $lanIp"
Write-Status "  Subnet   : $subnet"

# Update .env with detected values
$envPath = Join-Path $ROOT "artifacts\api-server\.env"
$envContent = Get-Content $envPath -Raw

# Replace VPN_SUBNET line
$envContent = $envContent -replace "VPN_SUBNET=.*", "VPN_SUBNET=$subnet"

# Replace or add LAN_IP line
if ($envContent -match "LAN_IP=") {
    $envContent = $envContent -replace "LAN_IP=.*", "LAN_IP=$lanIp"
} else {
    $envContent = $envContent.TrimEnd() + "`nLAN_IP=$lanIp`n"
}

Set-Content -Path $envPath -Value $envContent -NoNewline
Write-Status ".env updated with current network settings."

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
Write-Status "  Admin    : http://localhost:5173"
Write-Status "  Register : http://${lanIp}:5173/register"
Write-Status "  Portal   : http://${lanIp}:5173/portal"
Write-Status "  API      : http://localhost:3001"
Write-Status ""
Write-Status "Share the Register URL with mobile devices on this network."
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

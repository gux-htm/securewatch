#Requires -RunAsAdministrator
# =============================================================================
# Oh-My-Guard! – Native Windows Installation Script
# Supports: Windows Server 2022/2025, Windows 10/11
# Run as Administrator in PowerShell:
#   .\install\install.ps1
# =============================================================================

param(
    [string]$InstallPath = "C:\Oh-My-Guard!",
    [string]$DataPath    = "C:\Oh-My-Guard!Data",
    [string]$LogPath     = "C:\Oh-My-Guard!Logs",
    [string]$PythonVer   = "3.12"
)

$ErrorActionPreference = "Stop"
$AegisVersion = "1.0.0"

function Write-Step($msg)  { Write-Host "[Oh-My-Guard!] $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN] $msg"       -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "[ERROR] $msg"      -ForegroundColor Red; exit 1 }

# ─── Helper: Download file ────────────────────────────────────────────────────
function Download-File($url, $dest) {
    Write-Step "Downloading $url..."
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

# ─── Check & Install Chocolatey ───────────────────────────────────────────────
function Install-Chocolatey {
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Step "Installing Chocolatey package manager..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    } else {
        Write-Step "Chocolatey already installed ✓"
    }
}

# ─── Install System Packages ──────────────────────────────────────────────────
function Install-SystemPackages {
    Write-Step "Installing system packages via Chocolatey..."
    choco install python312      -y --no-progress
    choco install postgresql16   -y --no-progress
    choco install redis-64       -y --no-progress
    choco install openvpn        -y --no-progress
    choco install openssl.light  -y --no-progress
    choco install nssm           -y --no-progress
    choco install git            -y --no-progress
    Write-Step "System packages installed ✓"
}

# ─── Create Directory Structure ───────────────────────────────────────────────
function Create-Directories {
    Write-Step "Creating directories..."
    $dirs = @(
        $InstallPath, $DataPath, $LogPath,
        "$DataPath\ca", "$DataPath\certs", "$DataPath\ovpn",
        "$DataPath\backups", "$DataPath\keystore",
        "$InstallPath\src"
    )
    foreach ($d in $dirs) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
    }

    # Copy application source
    $scriptRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
    Copy-Item -Recurse -Force "$scriptRoot\*" "$InstallPath\src\"
    Write-Step "Directories created ✓"
}

# ─── Create Oh-My-Guard! Windows user account ───────────────────────────────────
function Create-ServiceUser {
    Write-Step "Creating Oh-My-Guard! service account..."
    $SvcPass = [System.Web.Security.Membership]::GeneratePassword(24, 4)
    $SecPass = ConvertTo-SecureString $SvcPass -AsPlainText -Force

    if (-not (Get-LocalUser "Oh-My-Guard!" -ErrorAction SilentlyContinue)) {
        New-LocalUser "Oh-My-Guard!" -Password $SecPass -Description "Oh-My-Guard! Security Service" -PasswordNeverExpires
        Add-LocalGroupMember -Group "Performance Monitor Users" -Member "Oh-My-Guard!"
    }

    # Store credentials securely
    [System.IO.File]::WriteAllText(
        "$InstallPath\svc_pass.enc",
        ([Security.Cryptography.ProtectedData]::Protect(
            [System.Text.Encoding]::UTF8.GetBytes($SvcPass),
            $null,
            [Security.Cryptography.DataProtectionScope]::LocalMachine
        ) | ForEach-Object { $_.ToString("X2") }) -join ""
    )
    icacls "$InstallPath\svc_pass.enc" /inheritance:r /grant "Oh-My-Guard!:(R)" | Out-Null
    Write-Step "Service account created ✓"
}

# ─── Set up Python Virtual Environment ───────────────────────────────────────
function Setup-PythonVenv {
    Write-Step "Setting up Python virtual environment..."
    $py = "C:\Python312\python.exe"
    if (-not (Test-Path $py)) { $py = (Get-Command python3.12 -ErrorAction SilentlyContinue)?.Source }
    if (-not $py) { Write-Fail "Python 3.12 not found. Install manually and re-run." }

    & $py -m venv "$InstallPath\venv"
    & "$InstallPath\venv\Scripts\pip" install --upgrade pip wheel -q
    & "$InstallPath\venv\Scripts\pip" install -r "$InstallPath\src\requirements.txt" -q
    Write-Step "Python environment ready ✓"
}

# ─── Configure PostgreSQL ─────────────────────────────────────────────────────
function Setup-PostgreSQL {
    Write-Step "Configuring PostgreSQL..."
    $PgPass = [System.Web.Security.Membership]::GeneratePassword(32, 4)
    $pgBin  = "C:\Program Files\PostgreSQL\16\bin"

    & "$pgBin\psql.exe" -U postgres -c "CREATE USER Oh-My-Guard! WITH PASSWORD '$PgPass';"   2>$null
    & "$pgBin\psql.exe" -U postgres -c "CREATE DATABASE Oh-My-Guard! OWNER Oh-My-Guard!;"      2>$null
    & "$pgBin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE Oh-My-Guard! TO Oh-My-Guard!;" 2>$null

    @"
DATABASE_URL=postgresql+asyncpg://Oh-My-Guard!:${PgPass}@localhost:5432/Oh-My-Guard!
PGHOST=localhost
PGPORT=5432
PGUSER=Oh-My-Guard!
PGPASSWORD=${PgPass}
PGDATABASE=Oh-My-Guard!
"@ | Set-Content "$InstallPath\db.env" -Encoding UTF8
    icacls "$InstallPath\db.env" /inheritance:r /grant "Oh-My-Guard!:(R)" | Out-Null
    Write-Step "PostgreSQL configured ✓"
}

# ─── Generate TLS Certificates ────────────────────────────────────────────────
function Generate-Certificates {
    Write-Step "Generating TLS certificates..."
    $opensslBin = "C:\Program Files\OpenSSL-Win64\bin\openssl.exe"
    $ca  = "$DataPath\ca"
    $crt = "$DataPath\certs"

    & $opensslBin genrsa -out "$ca\ca.key" 4096
    & $opensslBin req -new -x509 -days 3650 -key "$ca\ca.key" `
        -out "$ca\ca.crt" -subj "/C=US/O=Oh-My-Guard!/CN=Oh-My-Guard! Root CA"
    & $opensslBin genrsa -out "$crt\server.key" 4096
    & $opensslBin req -new -key "$crt\server.key" `
        -out "$crt\server.csr" -subj "/C=US/O=Oh-My-Guard!/CN=Oh-My-Guard!-server"
    & $opensslBin x509 -req -days 825 `
        -in "$crt\server.csr" -CA "$ca\ca.crt" -CAkey "$ca\ca.key" `
        -CAcreateserial -out "$crt\server.crt" -sha256
    & $opensslBin genrsa -out "$ca\master.key" 4096

    # Restrict permissions on private keys
    icacls "$ca\ca.key"     /inheritance:r /grant "Oh-My-Guard!:(R)" | Out-Null
    icacls "$ca\master.key" /inheritance:r /grant "Oh-My-Guard!:(R)" | Out-Null
    Write-Step "Certificates generated ✓"
}

# ─── Generate Application Config ─────────────────────────────────────────────
function Generate-AppConfig {
    Write-Step "Generating application configuration..."
    $secret   = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")
    $adminPwd = [System.Web.Security.Membership]::GeneratePassword(16, 4)
    $serverIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | Select-Object -First 1).IPAddress

    @"
AEGIS_SECRET_KEY=${secret}
AEGIS_HOST=0.0.0.0
AEGIS_PORT=8443
AEGIS_TLS_CERT=${DataPath}\certs\server.crt
AEGIS_TLS_KEY=${DataPath}\certs\server.key
AEGIS_CA_CERT=${DataPath}\ca\ca.crt
AEGIS_CA_KEY=${DataPath}\ca\ca.key
AEGIS_MASTER_KEY=${DataPath}\ca\master.key
AEGIS_DATA_DIR=${DataPath}
AEGIS_LOG_DIR=${LogPath}
AEGIS_LOG_LEVEL=INFO
AEGIS_ENVIRONMENT=production
AEGIS_SUPERADMIN_USER=superadmin
AEGIS_SUPERADMIN_PASS=${adminPwd}
AEGIS_VPN_SERVER=${serverIp}
"@ | Set-Content "$InstallPath\Oh-My-Guard!.env" -Encoding UTF8
    icacls "$InstallPath\Oh-My-Guard!.env" /inheritance:r /grant "Oh-My-Guard!:(R)" | Out-Null

    # Save admin password to display later
    $script:AdminPass = $adminPwd
    Write-Step "Configuration generated ✓"
}

# ─── Run Database Migrations ──────────────────────────────────────────────────
function Run-Migrations {
    Write-Step "Running database migrations..."
    $env:DATABASE_URL = (Get-Content "$InstallPath\db.env" | Select-String "DATABASE_URL").ToString().Split("=",2)[1]
    & "$InstallPath\venv\Scripts\alembic.exe" -c "$InstallPath\src\alembic.ini" upgrade head
    Write-Step "Database migrated ✓"
}

# ─── Install Windows Services via NSSM ───────────────────────────────────────
function Install-WindowsServices {
    Write-Step "Installing Oh-My-Guard! as Windows Services..."
    $nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"
    $py   = "$InstallPath\venv\Scripts\uvicorn.exe"

    # Main server
    & $nssm install Oh-My-Guard! $py
    & $nssm set Oh-My-Guard! AppParameters "server.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile `"$DataPath\certs\server.key`" --ssl-certfile `"$DataPath\certs\server.crt`""
    & $nssm set Oh-My-Guard! AppDirectory  "$InstallPath\src"
    & $nssm set Oh-My-Guard! AppEnvironmentExtra `
        "DATABASE_URL=$(Get-Content "$InstallPath\db.env" | Select-String "DATABASE_URL")"
    & $nssm set Oh-My-Guard! AppStdout     "$LogPath\server.log"
    & $nssm set Oh-My-Guard! AppStderr     "$LogPath\server-error.log"
    & $nssm set Oh-My-Guard! Start         SERVICE_AUTO_START
    & $nssm set Oh-My-Guard! ObjectName    ".\Oh-My-Guard!"

    # IDS/IPS engine (must run as SYSTEM for raw sockets)
    $idsScript = "$InstallPath\src\server\services\ids_engine.py"
    & $nssm install Oh-My-Guard!IDS "$InstallPath\venv\Scripts\python.exe"
    & $nssm set Oh-My-Guard!IDS AppParameters  "-m server.services.ids_engine"
    & $nssm set Oh-My-Guard!IDS AppDirectory   "$InstallPath\src"
    & $nssm set Oh-My-Guard!IDS AppStdout      "$LogPath\ids.log"
    & $nssm set Oh-My-Guard!IDS AppStderr      "$LogPath\ids-error.log"
    & $nssm set Oh-My-Guard!IDS Start          SERVICE_AUTO_START

    # Start services
    Start-Service Oh-My-Guard!
    Start-Sleep 3
    Start-Service Oh-My-Guard!IDS

    Write-Step "Windows services installed and started ✓"
}

# ─── Configure Windows Firewall ───────────────────────────────────────────────
function Configure-Firewall {
    Write-Step "Configuring Windows Firewall..."
    New-NetFirewallRule -DisplayName "Oh-My-Guard! Dashboard (HTTPS)" -Direction Inbound `
        -Protocol TCP -LocalPort 8443 -Action Allow -Profile Any -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Oh-My-Guard! OpenVPN" -Direction Inbound `
        -Protocol UDP -LocalPort 1194-1200 -Action Allow -Profile Any -ErrorAction SilentlyContinue
    Write-Step "Firewall rules added ✓"
}

# ─── Print Summary ────────────────────────────────────────────────────────────
function Print-Summary {
    $serverIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | Select-Object -First 1).IPAddress
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  Oh-My-Guard! $AegisVersion – Installation Complete" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Dashboard URL : https://${serverIp}:8443" -ForegroundColor White
    Write-Host "  Username      : superadmin"               -ForegroundColor White
    Write-Host "  Password      : $($script:AdminPass)"    -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ⚠  CHANGE THE DEFAULT PASSWORD IMMEDIATELY" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Install path  : $InstallPath"
    Write-Host "  Data path     : $DataPath"
    Write-Host "  Logs          : $LogPath"
    Write-Host ""
    Write-Host "  Manage services:"
    Write-Host "    Get-Service Oh-My-Guard!"
    Write-Host "    Restart-Service Oh-My-Guard!"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

# ─── Main Execution ───────────────────────────────────────────────────────────
Write-Step "Starting Oh-My-Guard! $AegisVersion installation..."
Install-Chocolatey
Install-SystemPackages
Create-Directories
Create-ServiceUser
Setup-PythonVenv
Setup-PostgreSQL
Generate-Certificates
Generate-AppConfig
Run-Migrations
Install-WindowsServices
Configure-Firewall
Print-Summary

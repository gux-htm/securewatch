#!/usr/bin/env bash
# =============================================================================
# Oh-My-Guard! – Client Agent Installation Script (Linux)
# Registers this endpoint with the central server and installs as systemd service.
# Run as root: sudo bash install-agent.sh
# =============================================================================
set -euo pipefail

AEGIS_SERVER="${AEGIS_SERVER_URL:-https://your-Oh-My-Guard!-server:8443}"
AGENT_DIR="/opt/Oh-My-Guard!-agent"
CONF_DIR="/etc/Oh-My-Guard!-agent"
LOG_DIR="/var/log/Oh-My-Guard!-agent"

info()  { echo -e "\033[0;32m[Agent]\033[0m $*"; }
error() { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && error "Run as root: sudo bash install-agent.sh"

# ── Prompt for server details ─────────────────────────────────────────────────
read -rp "Oh-My-Guard! server URL [$AEGIS_SERVER]: " INPUT
AEGIS_SERVER="${INPUT:-$AEGIS_SERVER}"

read -rp "Admin username: " ADMIN_USER
read -rsp "Admin password: " ADMIN_PASS; echo

# ── Create directories ────────────────────────────────────────────────────────
mkdir -p "$AGENT_DIR" "$CONF_DIR" "$LOG_DIR"
chmod 750 "$CONF_DIR"

# ── Install Python deps ───────────────────────────────────────────────────────
info "Installing Python dependencies..."
python3.12 -m venv "$AGENT_DIR/venv"
"$AGENT_DIR/venv/bin/pip" install -r "$(dirname "$0")/requirements-agent.txt" -q

# ── Get JWT token from server ─────────────────────────────────────────────────
info "Authenticating with Oh-My-Guard! server..."
TOKEN=$(curl -sf -X POST "$AEGIS_SERVER/api/v1/auth/login" \
    --cacert "$CONF_DIR/ca.crt" \
    -d "username=$ADMIN_USER&password=$ADMIN_PASS" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

# ── Download CA cert ──────────────────────────────────────────────────────────
info "Downloading CA certificate..."
curl -sf "$AEGIS_SERVER/api/v1/auth/ca-cert" -o "$CONF_DIR/ca.crt"

# ── Generate agent key pair & CSR ────────────────────────────────────────────
info "Generating agent key pair..."
HOSTNAME=$(hostname -f)
openssl genrsa -out "$CONF_DIR/client.key" 4096
openssl req -new -key "$CONF_DIR/client.key" \
    -out "$CONF_DIR/client.csr" \
    -subj "/C=US/O=Oh-My-Guard!/CN=$HOSTNAME"
chmod 400 "$CONF_DIR/client.key"

# ── Register device on server & get signed cert ───────────────────────────────
info "Registering device on Oh-My-Guard! server..."
MAC=$(cat /sys/class/net/$(ip route | awk '/default/ {print $5}')/address 2>/dev/null || echo "00:00:00:00:00:00")
IP=$(hostname -I | awk '{print $1}')

REGISTER_RESPONSE=$(curl -sf -X POST "$AEGIS_SERVER/api/v1/devices/" \
    --cacert "$CONF_DIR/ca.crt" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"hostname\":\"$HOSTNAME\",\"mac\":\"$MAC\",\"ip\":\"$IP\",\"cert_fingerprint\":\"pending\",\"platform\":\"linux\"}")

DEVICE_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
info "Device registered with ID: $DEVICE_ID"

# ── Write agent config ────────────────────────────────────────────────────────
cat > "$CONF_DIR/agent.conf" <<EOF
[agent]
server_url      = $AEGIS_SERVER
device_id       = $DEVICE_ID
cert_path       = $CONF_DIR/client.crt
key_path        = $CONF_DIR/client.key
ca_path         = $CONF_DIR/ca.crt
monitored_paths = /etc,/home,/var/www
heartbeat_interval = 30
EOF

# ── Copy agent source ─────────────────────────────────────────────────────────
cp -r "$(dirname "$0")" "$AGENT_DIR/src"

# ── Install systemd service ───────────────────────────────────────────────────
cat > /etc/systemd/system/Oh-My-Guard!-agent.service <<EOF
[Unit]
Description=Oh-My-Guard! Security Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$AGENT_DIR/venv/bin/python -m agent.agent
WorkingDirectory=$AGENT_DIR/src
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/agent.log
StandardError=append:$LOG_DIR/agent-error.log
Environment=AEGIS_AGENT_CONFIG=$CONF_DIR/agent.conf
# Run as non-root where possible
User=root
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now Oh-My-Guard!-agent
info "Oh-My-Guard! Agent installed and started ✓"
info "Check status: systemctl status Oh-My-Guard!-agent"
info "View logs:    journalctl -u Oh-My-Guard!-agent -f"

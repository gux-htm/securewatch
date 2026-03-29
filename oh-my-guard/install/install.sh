#!/usr/bin/env bash
# =============================================================================
# Oh-My-Guard! – Native Linux Installation Script
# Supports: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS
# Run as root:  sudo bash install.sh
# =============================================================================
set -euo pipefail

AEGIS_VERSION="1.0.0"
AEGIS_USER="Oh-My-Guard!"
AEGIS_HOME="/opt/Oh-My-Guard!"
AEGIS_DATA="/var/lib/Oh-My-Guard!"
AEGIS_LOGS="/var/log/Oh-My-Guard!"
AEGIS_CONF="/etc/Oh-My-Guard!"
PG_DB="Oh-My-Guard!"
PG_USER="Oh-My-Guard!"
PYTHON_MIN="3.12"
export PYTHON_MIN

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[Oh-My-Guard!]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

check_root() {
    [[ $EUID -ne 0 ]] && error "This script must be run as root. Use: sudo bash install.sh"
}

check_os() {
    info "Checking operating system..."
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        if [[ "$ID" != "ubuntu" ]]; then
            warn "Untested OS: $PRETTY_NAME. Continuing (Ubuntu 22.04/24.04 recommended)."
        else
            info "Detected: $PRETTY_NAME ✓"
        fi
    fi
}

install_system_packages() {
    info "Updating package lists..."
    apt-get update -qq

    info "Installing system dependencies..."
    apt-get install -y -qq \
        python3.12 python3.12-venv python3.12-dev \
        postgresql-16 postgresql-client-16 \
        redis-server \
        openvpn easy-rsa \
        openssl \
        libpq-dev \
        libnetfilter-queue-dev \
        build-essential \
        git curl wget \
        nftables iptables \
        net-tools iproute2 \
        libssl-dev libffi-dev \
        certbot

    info "System packages installed ✓"
}

create_aegis_user() {
    info "Creating system user: $AEGIS_USER..."
    if ! id -u "$AEGIS_USER" &>/dev/null; then
        useradd --system --shell /bin/false --home-dir "$AEGIS_HOME" \
                --create-home --comment "Oh-My-Guard! Security Platform" "$AEGIS_USER"
    else
        info "User $AEGIS_USER already exists."
    fi
}

create_directories() {
    info "Creating directory structure..."
    for dir in "$AEGIS_HOME" "$AEGIS_DATA" "$AEGIS_LOGS" "$AEGIS_CONF" \
                "$AEGIS_DATA/ca" "$AEGIS_DATA/certs" "$AEGIS_DATA/ovpn" \
                "$AEGIS_DATA/backups" "$AEGIS_DATA/keystore"; do
        mkdir -p "$dir"
    done

    # Copy application source
    cp -r "$(dirname "$0")/.." "$AEGIS_HOME/src"

    chown -R "$AEGIS_USER:$AEGIS_USER" "$AEGIS_HOME" "$AEGIS_DATA" "$AEGIS_LOGS"
    chmod 750 "$AEGIS_DATA/ca" "$AEGIS_DATA/certs" "$AEGIS_DATA/keystore"
    info "Directories created ✓"
}

setup_python_venv() {
    info "Setting up Python virtual environment..."
    python3.12 -m venv "$AEGIS_HOME/venv"
    source "$AEGIS_HOME/venv/bin/activate"
    pip install --upgrade pip wheel setuptools -q
    pip install -r "$AEGIS_HOME/src/requirements.txt" -q
    deactivate
    chown -R "$AEGIS_USER:$AEGIS_USER" "$AEGIS_HOME/venv"
    info "Python environment ready ✓"
}

setup_postgresql() {
    info "Configuring PostgreSQL..."
    systemctl enable postgresql --now

    # Wait for PostgreSQL to start
    sleep 2

    # Generate a secure random password
    PG_PASS=$(openssl rand -base64 32)

    su - postgres -c "psql -c \"CREATE USER $PG_USER WITH PASSWORD '$PG_PASS';\"" 2>/dev/null || true
    su - postgres -c "psql -c \"CREATE DATABASE $PG_DB OWNER $PG_USER;\"" 2>/dev/null || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;\""

    # Store credentials in config
    cat > "$AEGIS_CONF/db.env" <<EOF
DATABASE_URL=postgresql+asyncpg://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}
PGHOST=localhost
PGPORT=5432
PGUSER=${PG_USER}
PGPASSWORD=${PG_PASS}
PGDATABASE=${PG_DB}
EOF
    chmod 600 "$AEGIS_CONF/db.env"
    chown "$AEGIS_USER:$AEGIS_USER" "$AEGIS_CONF/db.env"

    info "PostgreSQL configured ✓"
}

setup_redis() {
    info "Configuring Redis..."
    REDIS_PASS=$(openssl rand -base64 24)

    # Harden redis configuration
    sed -i "s/^# requirepass.*/requirepass $REDIS_PASS/" /etc/redis/redis.conf
    sed -i "s/^bind .*/bind 127.0.0.1 -::1/" /etc/redis/redis.conf

    cat >> "$AEGIS_CONF/db.env" <<EOF
REDIS_URL=redis://:${REDIS_PASS}@localhost:6379/0
EOF

    systemctl enable redis-server --now
    info "Redis configured ✓"
}

generate_server_certificates() {
    info "Generating Oh-My-Guard! server TLS certificate and CA..."

    CA_DIR="$AEGIS_DATA/ca"
    CERT_DIR="$AEGIS_DATA/certs"

    # Generate CA key and self-signed certificate
    openssl genrsa -out "$CA_DIR/ca.key" 4096
    openssl req -new -x509 -days 3650 -key "$CA_DIR/ca.key" \
        -out "$CA_DIR/ca.crt" \
        -subj "/C=US/O=Oh-My-Guard!/CN=Oh-My-Guard! Root CA"

    # Generate server key and CSR
    openssl genrsa -out "$CERT_DIR/server.key" 4096
    openssl req -new -key "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.csr" \
        -subj "/C=US/O=Oh-My-Guard!/CN=Oh-My-Guard!-server"

    # Sign server cert with CA
    openssl x509 -req -days 825 \
        -in "$CERT_DIR/server.csr" \
        -CA "$CA_DIR/ca.crt" \
        -CAkey "$CA_DIR/ca.key" \
        -CAcreateserial \
        -out "$CERT_DIR/server.crt" \
        -sha256

    # Generate server master key for audit log signing
    openssl genrsa -out "$CA_DIR/master.key" 4096
    chmod 400 "$CA_DIR/ca.key" "$CA_DIR/master.key"
    chmod 444 "$CA_DIR/ca.crt"
    chown -R "$AEGIS_USER:$AEGIS_USER" "$CA_DIR" "$CERT_DIR"

    info "Certificates generated ✓"
}

generate_app_config() {
    info "Generating application configuration..."
    SECRET_KEY=$(openssl rand -hex 64)

    cat > "$AEGIS_CONF/Oh-My-Guard!.env" <<EOF
# Oh-My-Guard! Server Configuration
# Generated by install.sh on $(date -u)
AEGIS_SECRET_KEY=${SECRET_KEY}
AEGIS_HOST=0.0.0.0
AEGIS_PORT=8443
AEGIS_TLS_CERT=${AEGIS_DATA}/certs/server.crt
AEGIS_TLS_KEY=${AEGIS_DATA}/certs/server.key
AEGIS_CA_CERT=${AEGIS_DATA}/ca/ca.crt
AEGIS_CA_KEY=${AEGIS_DATA}/ca/ca.key
AEGIS_MASTER_KEY=${AEGIS_DATA}/ca/master.key
AEGIS_DATA_DIR=${AEGIS_DATA}
AEGIS_LOG_DIR=${AEGIS_LOGS}
AEGIS_LOG_LEVEL=INFO
AEGIS_ENVIRONMENT=production

# First-Run Superadmin (CHANGE PASSWORD AFTER FIRST LOGIN)
AEGIS_SUPERADMIN_USER=superadmin
AEGIS_SUPERADMIN_PASS=$(openssl rand -base64 16)

# VPN defaults
AEGIS_VPN_SERVER=\$(hostname -I | awk '{print \$1}')
EOF
    chmod 600 "$AEGIS_CONF/Oh-My-Guard!.env"
    chown "$AEGIS_USER:$AEGIS_USER" "$AEGIS_CONF/Oh-My-Guard!.env"
}

run_database_migrations() {
    info "Running database migrations..."
    sudo -u "$AEGIS_USER" bash -c "
        source '$AEGIS_CONF/db.env'
        source '$AEGIS_CONF/Oh-My-Guard!.env'
        source '$AEGIS_HOME/venv/bin/activate'
        cd '$AEGIS_HOME/src'
        alembic upgrade head
    "
    info "Database migrated ✓"
}

install_systemd_services() {
    info "Installing systemd services..."

    # Main Oh-My-Guard! server service
    cat > /etc/systemd/system/Oh-My-Guard!.service <<EOF
[Unit]
Description=Oh-My-Guard! Security Platform
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=${AEGIS_USER}
Group=${AEGIS_USER}
WorkingDirectory=${AEGIS_HOME}/src
EnvironmentFile=${AEGIS_CONF}/Oh-My-Guard!.env
EnvironmentFile=${AEGIS_CONF}/db.env
ExecStart=${AEGIS_HOME}/venv/bin/uvicorn server.main:app \
    --host \${AEGIS_HOST} \
    --port \${AEGIS_PORT} \
    --ssl-keyfile \${AEGIS_TLS_KEY} \
    --ssl-certfile \${AEGIS_TLS_CERT} \
    --workers 4 \
    --log-level info
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=append:${AEGIS_LOGS}/server.log
StandardError=append:${AEGIS_LOGS}/server-error.log
# Security hardening
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_RAW
ReadWritePaths=${AEGIS_DATA} ${AEGIS_LOGS}
ReadOnlyPaths=${AEGIS_CONF} ${AEGIS_HOME}

[Install]
WantedBy=multi-user.target
EOF

    # Oh-My-Guard! IDS/IPS background worker
    cat > /etc/systemd/system/Oh-My-Guard!-ids.service <<EOF
[Unit]
Description=Oh-My-Guard! IDS/IPS Packet Engine
After=Oh-My-Guard!.service
Requires=Oh-My-Guard!.service

[Service]
Type=simple
User=root
WorkingDirectory=${AEGIS_HOME}/src
EnvironmentFile=${AEGIS_CONF}/Oh-My-Guard!.env
EnvironmentFile=${AEGIS_CONF}/db.env
ExecStart=${AEGIS_HOME}/venv/bin/python -m server.services.ids_engine
Restart=always
RestartSec=5
StandardOutput=append:${AEGIS_LOGS}/ids.log
StandardError=append:${AEGIS_LOGS}/ids-error.log

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable Oh-My-Guard! Oh-My-Guard!-ids
    info "Systemd services installed ✓"
}

configure_firewall() {
    info "Configuring host firewall (nftables)..."
    cat > /etc/nftables-Oh-My-Guard!.conf <<'EOF'
#!/usr/sbin/nft -f
flush ruleset

table inet Oh-My-Guard! {
    chain input {
        type filter hook input priority 0; policy drop;

        # Allow loopback
        iif lo accept

        # Allow established/related
        ct state established,related accept

        # Allow SSH (restrict to your IP in production)
        tcp dport 22 accept

        # Oh-My-Guard! dashboard (HTTPS)
        tcp dport 8443 accept

        # OpenVPN ports (UDP 1194-1200 for multiple networks)
        udp dport 1194-1200 accept

        # ICMP
        ip protocol icmp accept
        ip6 nexthdr icmpv6 accept

        # Drop everything else
        drop
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
        # VPN forwarding is managed by Oh-My-Guard! dynamically
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
EOF

    nft -f /etc/nftables-Oh-My-Guard!.conf
    info "Host firewall configured ✓"
}

setup_log_rotation() {
    cat > /etc/logrotate.d/Oh-My-Guard! <<EOF
${AEGIS_LOGS}/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl reload Oh-My-Guard! 2>/dev/null || true
    endscript
}
EOF
    info "Log rotation configured ✓"
}

start_services() {
    info "Starting Oh-My-Guard! services..."
    systemctl start Oh-My-Guard!
    sleep 3
    if systemctl is-active Oh-My-Guard! >/dev/null 2>&1; then
        info "Oh-My-Guard! server started ✓"
    else
        warn "Oh-My-Guard! failed to start – check: journalctl -u Oh-My-Guard!"
    fi
    systemctl start Oh-My-Guard!-ids
}

print_summary() {
    ADMIN_PASS=$(grep AEGIS_SUPERADMIN_PASS "$AEGIS_CONF/Oh-My-Guard!.env" | cut -d= -f2)
    SERVER_IP=$(hostname -I | awk '{print $1}')

    printf "\n"
    printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    printf "  Oh-My-Guard! %s – Installation Complete\n" "${AEGIS_VERSION}"
    printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    printf "\n"
    printf "  Dashboard URL  : https://%s:8443\n" "${SERVER_IP}"
    printf "  Username       : %s\n" "superadmin"
    printf "  Password       : %s\n" "${ADMIN_PASS}"
    printf "\n"
    printf "  ⚠  CHANGE THE DEFAULT PASSWORD IMMEDIATELY AFTER FIRST LOGIN\n"
    printf "\n"
    printf "  Config dir     : %s/\n" "${AEGIS_CONF}"
    printf "  Data dir       : %s/\n" "${AEGIS_DATA}"
    printf "  Logs           : %s/\n" "${AEGIS_LOGS}"
    printf "\n"
    printf "  Manage services:\n"
    printf "    systemctl status Oh-My-Guard!\n"
    printf "    systemctl restart Oh-My-Guard!\n"
    printf "    journalctl -u Oh-My-Guard! -f\n"
    printf "\n"
    printf "  Install client agents on endpoints:\n"
    printf "    Linux:   sudo bash %s/src/agent/install-agent.sh\n" "${AEGIS_HOME}"
    printf "    Windows: .\\agent\\install-agent.ps1\n"
    printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
}

# ─── Main Execution ───────────────────────────────────────────────────────────
check_root
check_os
install_system_packages
create_aegis_user
create_directories
setup_python_venv
setup_postgresql
setup_redis
generate_server_certificates
generate_app_config
run_database_migrations
install_systemd_services
configure_firewall
setup_log_rotation
start_services
print_summary

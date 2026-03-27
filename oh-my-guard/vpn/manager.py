"""
Oh-My-Guard! – OpenVPN Network Manager
Manages multiple isolated OpenVPN server instances (one per virtual network).
Each network gets its own port, subnet, and CA-signed certificate bundle.

No Docker, no containers. OpenVPN runs as a native systemd service per network.
"""
from __future__ import annotations

import os
import subprocess
import textwrap
from pathlib import Path

from loguru import logger

from crypto.ca import issue_client_cert
from server.config import settings


def _vpn_dir(network_id: int) -> Path:
    """Return the data directory for a given VPN network."""
    d = Path(settings.aegis_data_dir) / "ovpn" / str(network_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def create_network_vpn(network_id: int, name: str, subnet: str, port: int, protocol: str) -> str:
    """
    Initialize OpenVPN server for a new virtual network.
    Generates server certificate, writes server.conf, and creates systemd service.

    Returns the server config path.
    """
    vpn_dir = _vpn_dir(network_id)

    # Generate server certificate for this network
    server_cn = f"Oh-My-Guard!-vpn-{network_id}"
    cert_pem, key_pem, fingerprint = issue_client_cert(server_cn, days=3650)

    (vpn_dir / "server.crt").write_text(cert_pem)
    (vpn_dir / "server.key").write_text(key_pem)
    (vpn_dir / "server.key").chmod(0o400)

    # Generate Diffie-Hellman params (use pre-generated for speed in dev)
    dh_path = vpn_dir / "dh4096.pem"
    if not dh_path.exists():
        logger.info(f"Generating DH params for network {network_id}. This takes a moment...")
        subprocess.run(
            ["openssl", "dhparam", "-out", str(dh_path), "2048"],
            check=True, capture_output=True,
        )

    # Generate TLS-auth key
    ta_path = vpn_dir / "ta.key"
    if not ta_path.exists():
        subprocess.run(
            ["openvpn", "--genkey", "--secret", str(ta_path)],
            check=True, capture_output=True,
        )

    # Extract subnet host address (e.g., 10.0.1.0/24 → 10.0.1.0 255.255.255.0)
    from ipaddress import IPv4Network
    net = IPv4Network(subnet, strict=False)
    net_addr = str(net.network_address)
    net_mask = str(net.netmask)

    # Write OpenVPN server config
    server_conf = textwrap.dedent(f"""\
        # Oh-My-Guard! – Network: {name} (id={network_id})
        port {port}
        proto {protocol}
        dev tun{network_id}
        ca {settings.aegis_ca_cert}
        cert {vpn_dir}/server.crt
        key {vpn_dir}/server.key
        dh {vpn_dir}/dh4096.pem
        tls-auth {vpn_dir}/ta.key 0
        key-direction 0
        server {net_addr} {net_mask}
        ifconfig-pool-persist /var/lib/Oh-My-Guard!/ovpn/{network_id}/ipp.txt
        push "redirect-gateway def1 bypass-dhcp"
        push "dhcp-option DNS 8.8.8.8"
        keepalive 10 120
        cipher AES-256-GCM
        auth SHA256
        tls-version-min 1.3
        ncp-ciphers AES-256-GCM
        user nobody
        group nogroup
        persist-key
        persist-tun
        status /var/log/Oh-My-Guard!/openvpn-{network_id}-status.log
        log-append /var/log/Oh-My-Guard!/openvpn-{network_id}.log
        verb 3
        # Verify client certificates against Oh-My-Guard! CA only
        verify-client-cert require
        # Script hook: called by OpenVPN to verify client MAC+IP via Oh-My-Guard! API
        client-connect {settings.aegis_data_dir}/scripts/verify-client.sh
        client-disconnect {settings.aegis_data_dir}/scripts/disconnect-client.sh
    """)

    conf_path = vpn_dir / "server.conf"
    conf_path.write_text(server_conf)

    # Install systemd service for this VPN instance
    _install_vpn_service(network_id, conf_path)

    logger.info(f"VPN network {name} (id={network_id}) initialized on port {port}/{protocol}")
    return str(conf_path)


def _install_vpn_service(network_id: int, conf_path: Path) -> None:
    """Register and start a per-network OpenVPN systemd service."""
    service_name = f"Oh-My-Guard!-vpn@{network_id}"
    unit_content = textwrap.dedent(f"""\
        [Unit]
        Description=Oh-My-Guard! VPN Network {network_id}
        After=network.target Oh-My-Guard!.service

        [Service]
        Type=notify
        ExecStart=/usr/sbin/openvpn --config {conf_path}
        Restart=always
        RestartSec=5

        [Install]
        WantedBy=multi-user.target
    """)
    unit_path = Path(f"/etc/systemd/system/{service_name}.service")
    unit_path.write_text(unit_content)

    subprocess.run(["systemctl", "daemon-reload"], check=False)
    subprocess.run(["systemctl", "enable", "--now", service_name], check=False)


def stop_network_vpn(network_id: int) -> None:
    """Stop and disable the OpenVPN instance for a network."""
    service = f"Oh-My-Guard!-vpn@{network_id}"
    subprocess.run(["systemctl", "stop", service], check=False)
    subprocess.run(["systemctl", "disable", service], check=False)


def generate_client_ovpn(
    network_id: int,
    common_name: str,
    server_ip: str,
    port: int,
    protocol: str,
) -> str:
    """
    Generate a complete .ovpn file for a client device.
    Embeds the client certificate, private key, CA cert, and TLS-auth key.
    The private key is issued once and must be distributed securely.

    Returns the full .ovpn config content as a string.
    """
    vpn_dir = _vpn_dir(network_id)

    # Issue a new client certificate
    cert_pem, key_pem, fingerprint = issue_client_cert(common_name, days=365)

    # Read embedded blobs
    ca_pem = Path(settings.aegis_ca_cert).read_text()
    ta_key = (vpn_dir / "ta.key").read_text()

    ovpn = textwrap.dedent(f"""\
        # Oh-My-Guard! Generated Client Configuration
        # Network ID : {network_id}
        # Common Name: {common_name}
        # Generated  : {__import__('datetime').datetime.utcnow().isoformat()}Z
        # WARNING: This file contains private key material. Keep it secret.
        client
        dev tun
        proto {protocol}
        remote {server_ip} {port}
        resolv-retry infinite
        nobind
        persist-key
        persist-tun
        remote-cert-tls server
        cipher AES-256-GCM
        auth SHA256
        tls-version-min 1.3
        key-direction 1
        verb 3

        <ca>
        {ca_pem.strip()}
        </ca>

        <cert>
        {cert_pem.strip()}
        </cert>

        <key>
        {key_pem.strip()}
        </key>

        <tls-auth>
        {ta_key.strip()}
        </tls-auth>
    """)

    return ovpn, fingerprint


def get_vpn_status(network_id: int) -> dict:
    """Read OpenVPN status file to return connected clients."""
    status_path = Path(f"/var/log/Oh-My-Guard!/openvpn-{network_id}-status.log")
    if not status_path.exists():
        return {"connected_clients": [], "error": "Status file not found"}

    clients = []
    in_clients = False
    for line in status_path.read_text().splitlines():
        if line.startswith("CLIENT_LIST"):
            in_clients = True
            continue
        if in_clients and line.startswith("ROUTING_TABLE"):
            break
        if in_clients and "," in line:
            parts = line.split(",")
            if len(parts) >= 4:
                clients.append({
                    "common_name": parts[0],
                    "real_address": parts[1],
                    "virtual_address": parts[2],
                    "connected_since": parts[4] if len(parts) > 4 else None,
                })

    return {"connected_clients": clients}

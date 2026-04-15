"""
Oh-My-Guard! – OVPN Issuance Engine
Generates per-device OpenVPN client configs signed by the internal CA.

Called by the Express API via HTTP POST /ovpn/issue.
Runs as part of the FastAPI application on port 8001 (or AEGIS_PORT).

No Docker. Runs bare-metal under systemd as oh-my-guard-engine.service.
"""
from __future__ import annotations

import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from jinja2 import Environment, BaseLoader
from pydantic import BaseModel, Field

from crypto.ca import issue_client_cert, get_cert_fingerprint
from server.config import settings

router = APIRouter()

# ─── Jinja2 OVPN template ─────────────────────────────────────────────────────

_OVPN_TEMPLATE = """\
# Oh-My-Guard! – Auto-generated client config
# Device: {{ device_id }} | Network: {{ network_id }} | IP: {{ static_ip }}
# Generated: {{ generated_at }}
client
dev tun
proto udp
remote {{ server_public_ip }} {{ vpn_port }}
resolv-retry infinite
nobind
persist-key
persist-tun
cipher AES-256-GCM
auth SHA256
tls-version-min 1.3
verb 3
ifconfig-push {{ static_ip }} 255.255.255.0
<ca>
{{ ca_cert_pem }}
</ca>
<cert>
{{ client_cert_pem }}
</cert>
<key>
{{ client_key_pem }}
</key>
<tls-auth>
{{ ta_key }}
</tls-auth>
key-direction 1
"""

_jinja_env = Environment(loader=BaseLoader(), autoescape=False)


# ─── Request / Response models ────────────────────────────────────────────────

class OvpnIssueRequest(BaseModel):
    device_id: int
    mac: str = Field(..., pattern=r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
    static_ip: str
    network_id: int | None = None


class OvpnIssueResponse(BaseModel):
    ovpn_path: str
    client_cert_fingerprint: str
    cert_serial: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _read_file(path: str) -> str:
    """Read a PEM/key file, stripping trailing whitespace."""
    return Path(path).read_text(encoding="utf-8").strip()


def _get_ta_key() -> str:
    ta_path = os.environ.get("TA_KEY_PATH", str(Path(settings.aegis_data_dir) / "ca" / "ta.key"))
    if not Path(ta_path).exists():
        raise FileNotFoundError(f"TLS-auth key not found at {ta_path}")
    return _read_file(ta_path)


def _get_vpn_port(network_id: int | None) -> int:
    """Return the VPN port for the given network (default 1194)."""
    # In production this would query the DB; for now use env or default
    return int(os.environ.get("VPN_PORT", "1194"))


def _schedule_deletion(path: str, delay_seconds: int = 300) -> None:
    """Delete the OVPN file after delay_seconds (default 5 min)."""
    def _delete() -> None:
        try:
            Path(path).unlink(missing_ok=True)
        except Exception:
            pass

    t = threading.Timer(delay_seconds, _delete)
    t.daemon = True
    t.start()


# ─── Route ────────────────────────────────────────────────────────────────────

@router.post("/ovpn/issue", response_model=OvpnIssueResponse)
async def issue_ovpn(body: OvpnIssueRequest) -> OvpnIssueResponse:
    """
    Generate a per-device .ovpn file.

    Steps:
    1. Issue a client cert+key pair from the internal CA.
    2. Render the Jinja2 OVPN template.
    3. Write to OVPN_OUTPUT_DIR/<device_id>.ovpn.
    4. Schedule deletion after 5 minutes.
    5. Return the file path and cert fingerprint.
    """
    output_dir = Path(os.environ.get("OVPN_OUTPUT_DIR", "/tmp/ovpn"))
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load CA cert (public, safe to embed in client config)
    try:
        ca_cert_pem = _read_file(settings.aegis_ca_cert)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"CA cert not found: {exc}") from exc

    # Issue per-device client certificate (RSA-4096, 365 days)
    common_name = f"omg-device-{body.device_id}"
    try:
        cert_pem, key_pem, fingerprint = issue_client_cert(
            common_name=common_name,
            days=365,
            san_ips=[body.static_ip],
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Certificate issuance failed: {exc}") from exc

    # Extract serial number from fingerprint (first 16 hex chars)
    cert_serial = fingerprint[:16].upper()

    # Load TLS-auth key
    try:
        ta_key = _get_ta_key()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    server_public_ip = os.environ.get("SERVER_PUBLIC_IP", settings.aegis_vpn_server)
    vpn_port = _get_vpn_port(body.network_id)

    # Render OVPN config
    template = _jinja_env.from_string(_OVPN_TEMPLATE)
    ovpn_content = template.render(
        device_id=body.device_id,
        network_id=body.network_id,
        static_ip=body.static_ip,
        generated_at=datetime.now(timezone.utc).isoformat(),
        server_public_ip=server_public_ip,
        vpn_port=vpn_port,
        ca_cert_pem=ca_cert_pem,
        client_cert_pem=cert_pem,
        client_key_pem=key_pem,
        ta_key=ta_key,
    )

    ovpn_path = output_dir / f"{body.device_id}.ovpn"
    ovpn_path.write_text(ovpn_content, encoding="utf-8")
    # Restrict permissions: only owner can read
    ovpn_path.chmod(0o600)

    # Schedule deletion after 5 minutes
    _schedule_deletion(str(ovpn_path), delay_seconds=300)

    return OvpnIssueResponse(
        ovpn_path=str(ovpn_path),
        client_cert_fingerprint=fingerprint,
        cert_serial=cert_serial,
    )

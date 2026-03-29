"""Networks / VPN Router – create, manage, and provision virtual networks."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AuditSeverity, Network, NetworkStatus
from database.session import get_db
from server.services.audit import write_audit_log
from server.middlewares.auth import require_role

router = APIRouter()


class NetworkCreateRequest(BaseModel):
    name: str
    description: str | None = None
    subnet: str
    port: int = 1194
    protocol: str = "udp"


class OvpnGenerateRequest(BaseModel):
    device_id: int
    common_name: str


@router.get("/")
async def list_networks(db: AsyncSession = Depends(get_db), _=Depends(require_role(["super_admin", "network_admin", "auditor"]))):
    result = await db.execute(select(Network))
    return result.scalars().all()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_network(body: NetworkCreateRequest, db: AsyncSession = Depends(get_db),
                          current_user=Depends(require_role(["super_admin", "network_admin"]))):
    network = Network(**body.model_dump())
    db.add(network)
    await db.flush()

    # Initialize VPN instance (deferred to avoid blocking API)
    try:
        from vpn.manager import create_network_vpn
        conf_path = create_network_vpn(network.id, network.name, network.subnet, network.port, network.protocol)
        network.vpn_config_path = conf_path
    except Exception as e:
        network.status = NetworkStatus.inactive
        import loguru
        loguru.logger.error(f"VPN init failed for network {network.name}: {e}")

    await write_audit_log(db, event_type="network.created",
        details=f"Network '{network.name}' ({network.subnet}) created",
        severity=AuditSeverity.info, admin_user_id=current_user.id)

    await db.commit()
    await db.refresh(network)
    return network


@router.get("/{network_id}")
async def get_network(network_id: int, db: AsyncSession = Depends(get_db),
                       _=Depends(require_role(["super_admin", "network_admin", "auditor"]))):
    network = await db.get(Network, network_id)
    if not network:
        raise HTTPException(status_code=404, detail="Network not found")
    return network


@router.delete("/{network_id}", status_code=204)
async def delete_network(network_id: int, db: AsyncSession = Depends(get_db),
                          _=Depends(require_role(["super_admin"]))):
    network = await db.get(Network, network_id)
    if not network:
        raise HTTPException(status_code=404, detail="Network not found")
    try:
        from vpn.manager import stop_network_vpn
        stop_network_vpn(network_id)
    except Exception:
        pass
    await db.delete(network)
    await db.commit()


@router.post("/{network_id}/generate-ovpn")
async def generate_ovpn(network_id: int, body: OvpnGenerateRequest,
                          db: AsyncSession = Depends(get_db),
                          current_user=Depends(require_role(["super_admin", "network_admin"]))):
    """Generate and return a .ovpn file for a specific device on this network."""
    network = await db.get(Network, network_id)
    if not network:
        raise HTTPException(status_code=404, detail="Network not found")

    from vpn.manager import generate_client_ovpn
    from server.config import settings
    ovpn_content, _ = generate_client_ovpn(
        network_id=network_id,
        common_name=body.common_name,
        server_ip=settings.aegis_vpn_server,
        port=network.port,
        protocol=network.protocol,
    )

    await write_audit_log(db, event_type="vpn.ovpn_generated",
        details=f"OVPN generated for CN='{body.common_name}' on network '{network.name}'",
        severity=AuditSeverity.info, admin_user_id=current_user.id)
    await db.commit()

    return Response(
        content=ovpn_content,
        media_type="application/x-openvpn-profile",
        headers={"Content-Disposition": f'attachment; filename="{body.common_name}.ovpn"'},
    )


@router.get("/{network_id}/status")
async def vpn_status(network_id: int, _=Depends(require_role(["super_admin", "network_admin"]))):
    from vpn.manager import get_vpn_status
    return get_vpn_status(network_id)

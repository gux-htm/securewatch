"""VPN Management Router – alias endpoints and ovpn revocation."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import OvpnIssuance
from database.session import get_db
from server.middlewares.auth import require_role

router = APIRouter()


@router.get("/issuances")
async def list_issuances(device_id: int | None = None, db: AsyncSession = Depends(get_db),
                          _=Depends(require_role(["super_admin", "network_admin"]))):
    stmt = select(OvpnIssuance).order_by(OvpnIssuance.created_at.desc())
    if device_id:
        stmt = stmt.where(OvpnIssuance.device_id == device_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/issuances/{issuance_id}/revoke")
async def revoke_issuance(issuance_id: int, db: AsyncSession = Depends(get_db),
                           current_user=Depends(require_role(["super_admin", "network_admin"]))):
    from datetime import datetime
    issuance = await db.get(OvpnIssuance, issuance_id)
    if not issuance:
        raise HTTPException(status_code=404, detail="Issuance not found")
    issuance.revoked    = True
    issuance.revoked_at = datetime.utcnow()
    # In production: also update CRL and reload OpenVPN
    from crypto.ca import revoke_cert
    if issuance.cert_serial:
        revoke_cert(int(issuance.cert_serial, 16))
    await db.commit()
    return {"status": "revoked"}

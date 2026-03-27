"""
Oh-My-Guard! – Device Management Router
Handles device registration, zero-trust verification, and status management.

SECURITY: Zero-trust verification requires ALL THREE fields (MAC + IP + cert fingerprint)
to match exactly. Any mismatch triggers an alarm and connection rejection.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AuditLog, AuditSeverity, Device, DeviceStatus
from database.session import get_db
from server.services.audit import write_audit_log
from server.services.notifications import notify_alert
from server.middlewares.auth import require_role, get_current_user

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]


class DeviceRegisterRequest(BaseModel):
    hostname: str           = Field(..., max_length=255)
    mac: str                = Field(..., pattern=r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
    ip: str                 = Field(..., max_length=45)
    cert_fingerprint: str   = Field(..., max_length=128)
    network_id: int | None  = None
    platform: str           = Field("linux", max_length=16)
    agent_version: str | None = None


class DeviceUpdateRequest(BaseModel):
    status: DeviceStatus | None = None
    network_id: int | None = None
    ip: str | None = None


class ZeroTrustVerifyRequest(BaseModel):
    """
    Pre-connection verification payload sent by client agent.
    All three fields must match the registered device record exactly.
    """
    mac: str            = Field(..., pattern=r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
    ip: str             = Field(..., max_length=45)
    cert_fingerprint: str = Field(..., max_length=128)


@router.get("/")
async def list_devices(
    db: DB,
    network_id: int | None = None,
    device_status: DeviceStatus | None = None,
    _=Depends(require_role(["super_admin", "network_admin", "auditor"])),
):
    stmt = select(Device)
    if network_id:
        stmt = stmt.where(Device.network_id == network_id)
    if device_status:
        stmt = stmt.where(Device.status == device_status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def register_device(
    body: DeviceRegisterRequest,
    db: DB,
    current_user=Depends(require_role(["super_admin", "network_admin"])),
):
    device = Device(**body.model_dump(), last_seen=datetime.utcnow())
    db.add(device)
    await db.flush()

    await write_audit_log(db, event_type="device.registered",
        details=f"Device {device.hostname} ({device.mac}) registered",
        device_id=device.id, ip_address=device.ip, mac_address=device.mac,
        severity=AuditSeverity.info, admin_user_id=current_user.id)

    await db.commit()
    await db.refresh(device)
    return device


@router.get("/{device_id}")
async def get_device(
    device_id: int, db: DB,
    _=Depends(require_role(["super_admin", "network_admin", "auditor"])),
):
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.patch("/{device_id}")
async def update_device(
    device_id: int,
    body: DeviceUpdateRequest,
    db: DB,
    current_user=Depends(require_role(["super_admin", "network_admin"])),
):
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(device, field, value)

    if body.status == DeviceStatus.blocked:
        await write_audit_log(db, event_type="device.blocked",
            details=f"Device {device.hostname} blocked by admin {current_user.username}",
            device_id=device.id, ip_address=device.ip, mac_address=device.mac,
            severity=AuditSeverity.warning, admin_user_id=current_user.id)
        await notify_alert(
            title="Device Blocked",
            message=f"Device {device.hostname} ({device.ip}) has been blocked.",
            severity="warning",
        )

    await db.commit()
    await db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: int, db: DB,
    _=Depends(require_role(["super_admin"])),
):
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    await db.delete(device)
    await db.commit()


@router.post("/{device_id}/verify")
async def zero_trust_verify(
    device_id: int,
    body: ZeroTrustVerifyRequest,
    db: DB,
):
    """
    Zero-Trust Pre-Connection Verification.
    Called by the client agent before establishing any communication.
    ALL THREE fields (MAC, IP, cert_fingerprint) must match exactly.
    Any mismatch → reject + critical audit log + alarm.
    """
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    mac_match  = device.mac == body.mac
    ip_match   = device.ip  == body.ip
    cert_match = device.cert_fingerprint == body.cert_fingerprint
    allowed    = mac_match and ip_match and cert_match and device.status == DeviceStatus.active

    # Always update last_seen on a verify attempt
    device.last_seen = datetime.utcnow()

    if not allowed:
        mismatches = []
        if not mac_match:  mismatches.append("MAC")
        if not ip_match:   mismatches.append("IP")
        if not cert_match: mismatches.append("CertificateFingerprint")
        if device.status != DeviceStatus.active:
            mismatches.append(f"Status={device.status.value}")

        await write_audit_log(db, event_type="device.verification_failed",
            details=f"Zero-trust FAILED for {device.hostname}: mismatch={','.join(mismatches)}. "
                    f"Presented IP={body.ip} MAC={body.mac}",
            device_id=device.id, ip_address=body.ip, mac_address=body.mac,
            severity=AuditSeverity.critical)

        await notify_alert(
            title="Zero-Trust Verification FAILED",
            message=f"Device {device.hostname} failed zero-trust check. Mismatch: {', '.join(mismatches)}",
            severity="critical",
        )

        await db.commit()
        return {
            "allowed": False,
            "reason": f"Credential mismatch: {', '.join(mismatches)}",
            "matched_fields": {"mac": mac_match, "ip": ip_match, "cert_fingerprint": cert_match},
        }

    await db.commit()
    return {
        "allowed": True,
        "reason": "All credentials verified",
        "matched_fields": {"mac": True, "ip": True, "cert_fingerprint": True},
    }

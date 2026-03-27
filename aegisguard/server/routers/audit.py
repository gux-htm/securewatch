"""Audit Logs Router – query, verify, and export immutable audit trail."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AuditLog, AuditSeverity
from database.session import get_db
from server.middlewares.auth import require_role
from server.services.audit import verify_audit_entry

router = APIRouter()


@router.get("/")
async def list_audit_logs(
    limit: int = 100,
    severity: AuditSeverity | None = None,
    event_type: str | None = None,
    device_id: int | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role(["super_admin", "network_admin", "auditor"])),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if severity:   stmt = stmt.where(AuditLog.severity == severity)
    if event_type: stmt = stmt.where(AuditLog.event_type.ilike(f"%{event_type}%"))
    if device_id:  stmt = stmt.where(AuditLog.device_id == device_id)
    if from_date:  stmt = stmt.where(AuditLog.created_at >= from_date)
    if to_date:    stmt = stmt.where(AuditLog.created_at <= to_date)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{log_id}/verify")
async def verify_log_integrity(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role(["super_admin", "auditor"])),
):
    """
    Forensic integrity check: verify that an audit entry has not been tampered with.
    Returns whether the stored RSA-PSS signature matches the entry's canonical payload.
    """
    entry = await db.get(AuditLog, log_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Audit log entry not found")
    valid = await verify_audit_entry(entry)
    return {"log_id": log_id, "event_id": entry.event_id, "integrity": "VALID" if valid else "TAMPERED"}


@router.get("/export/csv")
async def export_csv(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role(["super_admin", "auditor"])),
):
    """Export audit logs as a signed CSV file."""
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10000))
    logs = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "event_id", "event_type", "severity", "device_id",
        "ip_address", "mac_address", "details", "created_at", "server_signature"
    ])
    writer.writeheader()
    for log in logs:
        writer.writerow({
            "id": log.id, "event_id": log.event_id, "event_type": log.event_type,
            "severity": log.severity.value, "device_id": log.device_id,
            "ip_address": log.ip_address, "mac_address": log.mac_address,
            "details": log.details, "created_at": log.created_at.isoformat(),
            "server_signature": log.server_signature or "",
        })

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=aegisguard-audit-{datetime.utcnow().date()}.csv"},
    )

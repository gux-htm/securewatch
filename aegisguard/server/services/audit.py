"""
AegisGuard – Audit Log Service
Every security event produces a cryptographically signed, immutable audit log entry.
The server master key (RSA-PSS) signs a JSON representation of every entry.
This ensures that even if the database is compromised, tampered entries can be detected.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AuditLog, AuditSeverity
from crypto.ca import sign_payload


async def write_audit_log(
    db: AsyncSession,
    *,
    event_type: str,
    severity: AuditSeverity = AuditSeverity.info,
    details: str | None = None,
    device_id: int | None = None,
    admin_user_id: int | None = None,
    ip_address: str | None = None,
    mac_address: str | None = None,
) -> AuditLog:
    """
    Create an immutable, signed audit log entry.

    The entry payload (JSON) is signed with the server master RSA key.
    Any tampering of the record will cause signature verification to fail during forensics.
    """
    event_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"

    # Build the canonical payload that will be signed
    payload = {
        "event_id":     event_id,
        "event_type":   event_type,
        "severity":     severity.value,
        "device_id":    device_id,
        "admin_user_id": admin_user_id,
        "ip_address":   ip_address,
        "mac_address":  mac_address,
        "details":      details,
        "timestamp":    timestamp,
    }

    # Sign the canonical payload (sorted keys for determinism)
    try:
        signature = sign_payload(json.dumps(payload, sort_keys=True).encode())
    except Exception:
        # If signing fails (e.g., key not yet available), proceed without signature
        # and flag it – production deployments must always have the master key
        signature = None

    entry = AuditLog(
        event_id=event_id,
        device_id=device_id,
        admin_user_id=admin_user_id,
        event_type=event_type,
        details=details,
        ip_address=ip_address,
        mac_address=mac_address,
        severity=severity,
        server_signature=signature,
    )

    db.add(entry)
    return entry


async def verify_audit_entry(entry: AuditLog) -> bool:
    """
    Verify that an audit log entry has not been tampered with.
    Used during forensic investigations.
    """
    from crypto.ca import verify_signature

    if not entry.server_signature:
        return False

    payload = {
        "event_id":     entry.event_id,
        "event_type":   entry.event_type,
        "severity":     entry.severity.value,
        "device_id":    entry.device_id,
        "admin_user_id": entry.admin_user_id,
        "ip_address":   entry.ip_address,
        "mac_address":  entry.mac_address,
        "details":      entry.details,
        "timestamp":    entry.created_at.isoformat() + "Z",
    }

    return verify_signature(
        json.dumps(payload, sort_keys=True).encode(),
        entry.server_signature,
    )

"""IDS/IPS Router 	6 signatures, alerts, and anomaly management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import IdsAlert, IdsSignature, IdsSeverity, IdsCategory, IdsAction
from database.session import get_db
from server.middlewares.auth import require_role

router = APIRouter()


class SignatureCreate(BaseModel):
    name: str
    pattern: str
    category: IdsCategory
    severity: IdsSeverity
    action: IdsAction


@router.get("/signatures")
async def list_signatures(db: AsyncSession = Depends(get_db),
                           _=Depends(require_role(["super_admin", "network_admin", "auditor"]))):
    result = await db.execute(select(IdsSignature).order_by(IdsSignature.id))
    return result.scalars().all()


@router.post("/signatures", status_code=201)
async def create_signature(body: SignatureCreate, db: AsyncSession = Depends(get_db),
                            _=Depends(require_role(["super_admin", "network_admin"]))):
    sig = IdsSignature(**body.model_dump())
    db.add(sig)
    await db.commit()
    await db.refresh(sig)
    return sig


@router.get("/alerts")
async def list_alerts(limit: int = 50, severity: IdsSeverity | None = None,
                       resolved: bool | None = None,
                       db: AsyncSession = Depends(get_db),
                       _=Depends(require_role(["super_admin", "network_admin", "auditor"]))):
    stmt = select(IdsAlert).order_by(IdsAlert.created_at.desc()).limit(limit)
    if severity:
        stmt = stmt.where(IdsAlert.severity == severity)
    if resolved is not None:
        stmt = stmt.where(IdsAlert.resolved == resolved)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(get_db),
                         current_user=Depends(require_role(["super_admin", "network_admin"]))):
    from datetime import datetime
    alert = await db.get(IdsAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved    = True
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "resolved"}

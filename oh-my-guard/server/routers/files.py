"""File Events & Protected Resources Router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import FileAction, FileEvent
from database.session import get_db
from server.middlewares.auth import require_role

router = APIRouter()


class FileEventIngest(BaseModel):
    """Payload submitted by client agent for every file system event."""
    device_id: int | None       = None
    user_cert_cn: str | None    = None
    file_path: str
    action: FileAction
    hash_before: str | None     = None
    hash_after: str | None      = None
    user_signature: str | None  = None
    ip_address: str | None      = None
    mac_address: str | None     = None
    privileges_used: str | None = None


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def ingest_file_event(body: FileEventIngest, db: AsyncSession = Depends(get_db)):
    """
    Receive and persist a file event from a client agent.
    This endpoint must be mTLS-authenticated in production.
    Events are stored immutably – no UPDATE or DELETE is permitted.
    """
    event = FileEvent(**body.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return {"id": event.id, "status": "stored"}


@router.get("/events")
async def list_file_events(limit: int = 100, device_id: int | None = None,
                             action: FileAction | None = None,
                             db: AsyncSession = Depends(get_db),
                             _=Depends(require_role(["super_admin", "network_admin", "auditor"]))):
    stmt = select(FileEvent).order_by(FileEvent.created_at.desc()).limit(limit)
    if device_id:
        stmt = stmt.where(FileEvent.device_id == device_id)
    if action:
        stmt = stmt.where(FileEvent.action == action)
    result = await db.execute(stmt)
    return result.scalars().all()

"""Dashboard Stats Router – aggregated metrics for the HTMX dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Device, DeviceStatus, FileEvent, IdsAlert, Network
from database.session import get_db
from server.middlewares.auth import require_role

router = APIRouter()


@router.get("/stats")
async def dashboard_stats(db: AsyncSession = Depends(get_db),
                            _=Depends(require_role(["super_admin", "network_admin", "auditor", "viewer"]))):
    total_devices  = (await db.execute(select(func.count()).select_from(Device))).scalar()
    active_devices = (await db.execute(select(func.count()).select_from(Device).where(Device.status == DeviceStatus.active))).scalar()
    total_networks = (await db.execute(select(func.count()).select_from(Network))).scalar()
    open_alerts    = (await db.execute(select(func.count()).select_from(IdsAlert).where(IdsAlert.resolved == False))).scalar()
    file_events_24h = (await db.execute(
        select(func.count()).select_from(FileEvent).where(
            FileEvent.created_at >= func.now() - func.cast("24 hours", type_=None)
        )
    )).scalar()
    return {
        "total_devices":   total_devices,
        "active_devices":  active_devices,
        "total_networks":  total_networks,
        "open_alerts":     open_alerts,
        "file_events_24h": file_events_24h,
    }

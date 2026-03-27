"""ACL Policies Router – manage granular file/resource access control."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AuditSeverity, Policy
from database.session import get_db
from server.middlewares.auth import require_role
from server.services.audit import write_audit_log

router = APIRouter()


class PolicyCreate(BaseModel):
    device_id: int | None   = None
    user_cert_cn: str | None = None
    group_name: str | None  = None
    resource_path: str
    permissions: dict       # {"view":T,"edit":F,"delete":F,"rename":F,"full_control":F}


@router.get("/")
async def list_policies(device_id: int | None = None, db: AsyncSession = Depends(get_db),
                         _=Depends(require_role(["super_admin", "network_admin", "auditor"]))):
    stmt = select(Policy)
    if device_id:
        stmt = stmt.where(Policy.device_id == device_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_policy(body: PolicyCreate, db: AsyncSession = Depends(get_db),
                         current_user=Depends(require_role(["super_admin", "network_admin"]))):
    policy = Policy(**body.model_dump(), created_by=current_user.id)
    db.add(policy)
    await db.flush()
    await write_audit_log(db, event_type="policy.created",
        details=f"Policy for '{body.resource_path}': {body.permissions}",
        severity=AuditSeverity.info, admin_user_id=current_user.id)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.put("/{policy_id}")
async def update_policy(policy_id: int, body: PolicyCreate,
                         db: AsyncSession = Depends(get_db),
                         current_user=Depends(require_role(["super_admin", "network_admin"]))):
    policy = await db.get(Policy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    for field, value in body.model_dump().items():
        setattr(policy, field, value)
    await write_audit_log(db, event_type="policy.updated",
        details=f"Policy #{policy_id} updated: {body.permissions}",
        severity=AuditSeverity.warning, admin_user_id=current_user.id)
    await db.commit()
    return policy


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(policy_id: int, db: AsyncSession = Depends(get_db),
                         _=Depends(require_role(["super_admin"]))):
    policy = await db.get(Policy, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    await db.delete(policy)
    await db.commit()

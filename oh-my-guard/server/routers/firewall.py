"""Firewall Rules Router – create, list, apply, and remove stateful firewall rules."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AuditSeverity, FirewallRule, FirewallAction, FirewallProtocol, FirewallDirection
from database.session import get_db
from server.services.audit import write_audit_log
from server.middlewares.auth import require_role

router = APIRouter()


class FirewallRuleCreate(BaseModel):
    network_id: int | None  = None
    device_id: int | None   = None
    action: FirewallAction
    source_ip: str | None   = None
    dest_ip: str | None     = None
    source_port: int | None = None
    dest_port: int | None   = None
    protocol: FirewallProtocol = FirewallProtocol.any
    direction: FirewallDirection = FirewallDirection.both
    priority: int = 100
    description: str | None = None


@router.get("/")
async def list_rules(network_id: int | None = None, device_id: int | None = None,
                      db: AsyncSession = Depends(get_db),
                      _=Depends(require_role(["super_admin", "network_admin", "auditor"]))):
    stmt = select(FirewallRule).order_by(FirewallRule.priority)
    if network_id:
        stmt = stmt.where(FirewallRule.network_id == network_id)
    if device_id:
        stmt = stmt.where(FirewallRule.device_id == device_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_rule(body: FirewallRuleCreate, db: AsyncSession = Depends(get_db),
                       current_user=Depends(require_role(["super_admin", "network_admin"]))):
    rule = FirewallRule(**body.model_dump(), created_by=current_user.id)
    db.add(rule)
    await db.flush()

    await write_audit_log(db, event_type="firewall.rule_created",
        details=f"Rule #{rule.id}: {rule.action.value} {rule.protocol.value} "
                f"{rule.source_ip or 'any'}→{rule.dest_ip or 'any'}:{rule.dest_port or 'any'}",
        severity=AuditSeverity.info, admin_user_id=current_user.id)

    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db),
                       current_user=Depends(require_role(["super_admin", "network_admin"]))):
    rule = await db.get(FirewallRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await write_audit_log(db, event_type="firewall.rule_deleted",
        details=f"Rule #{rule_id} deleted", severity=AuditSeverity.warning,
        admin_user_id=current_user.id)
    await db.delete(rule)
    await db.commit()


@router.post("/{rule_id}/apply")
async def apply_rule(rule_id: int, db: AsyncSession = Depends(get_db),
                      current_user=Depends(require_role(["super_admin", "network_admin"]))):
    """Push a rule to the target device's agent or apply it at the network level."""
    rule = await db.get(FirewallRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    # In production: send the rule to the target agent via WebSocket or REST
    rule.enabled = True
    await write_audit_log(db, event_type="firewall.rule_applied",
        details=f"Rule #{rule_id} applied", severity=AuditSeverity.info,
        admin_user_id=current_user.id)
    await db.commit()
    return {"status": "applied", "rule_id": rule_id}

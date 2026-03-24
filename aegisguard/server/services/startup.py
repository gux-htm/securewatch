"""
AegisGuard – Server Startup Tasks
Runs once at FastAPI lifespan start:
  1. Create the superadmin account if it doesn't exist
  2. Seed built-in IDS signatures
  3. Start Redis → WebSocket relay
"""
from __future__ import annotations

from loguru import logger
from passlib.context import CryptContext
from sqlalchemy import select

from database.models import AdminUser, IdsSignature, IdsCategory, IdsSeverity, IdsAction, UserRole
from database.session import AsyncSessionLocal
from server.config import settings
from server.services.ids_engine import BUILTIN_SIGNATURES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


async def initialize_superadmin() -> None:
    """Create the superadmin account on first run (if AEGIS_SUPERADMIN_PASS is set)."""
    if not settings.aegis_superadmin_pass:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AdminUser).where(AdminUser.username == settings.aegis_superadmin_user)
        )
        if result.scalar_one_or_none():
            return  # Already exists

        admin = AdminUser(
            username=settings.aegis_superadmin_user,
            email=f"{settings.aegis_superadmin_user}@localhost",
            password_hash=pwd_context.hash(settings.aegis_superadmin_pass),
            role=UserRole.super_admin,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        logger.info(f"Superadmin '{settings.aegis_superadmin_user}' created.")


async def preload_ids_signatures() -> None:
    """Seed built-in IDS signatures into the database if not already present."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(IdsSignature))
        existing = {sig.name for sig in result.scalars().all()}

        new_sigs = []
        for sig in BUILTIN_SIGNATURES:
            if sig["name"] not in existing:
                new_sigs.append(IdsSignature(
                    name=sig["name"],
                    pattern=sig["pattern"],
                    category=IdsCategory(sig["category"]),
                    severity=IdsSeverity(sig["severity"]),
                    action=IdsAction(sig["action"]),
                ))

        if new_sigs:
            db.add_all(new_sigs)
            await db.commit()
            logger.info(f"Seeded {len(new_sigs)} built-in IDS signatures.")

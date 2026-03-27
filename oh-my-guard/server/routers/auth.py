"""
Oh-My-Guard! – Authentication Router
JWT-based auth for admin dashboard. Tokens are short-lived (60 min).
Passwords hashed with bcrypt (12 rounds minimum).
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AdminUser
from database.session import get_db
from server.config import settings

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


def create_access_token(user_id: int, role: str) -> str:
    """Create a signed JWT access token."""
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.aegis_secret_key, algorithm="HS256")


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate an admin user. Returns JWT on success.
    Invalid credentials always return 401 (no username enumeration).
    """
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == form_data.username)
    )
    user: AdminUser | None = result.scalar_one_or_none()

    # Constant-time comparison to prevent timing attacks
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.last_login = datetime.utcnow()
    await db.commit()

    token = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/change-password", status_code=200)
async def change_password(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Change password for authenticated admin user."""
    # In production: validate JWT, verify old_password, enforce complexity
    raise HTTPException(status_code=501, detail="Implement with JWT validation")

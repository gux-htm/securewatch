"""
Oh-My-Guard! – Authentication Middleware & Role Guards
JWT verification for every API endpoint. Roles enforced via dependency injection.
"""
from __future__ import annotations

from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import AdminUser
from database.session import get_db
from server.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    """Decode JWT and return the current AdminUser."""
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.aegis_secret_key, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = await db.get(AdminUser, int(user_id))
    if user is None or not user.is_active:
        raise cred_exc
    return user


def require_role(roles: list[str]) -> Callable:
    """Factory: returns a dependency that enforces the given role list."""
    async def _check(user: AdminUser = Depends(get_current_user)) -> AdminUser:
        if user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role.value}' is not authorized for this action. Required: {roles}",
            )
        return user
    return _check

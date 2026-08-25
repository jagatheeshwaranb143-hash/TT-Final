"""
SmartSchedule — Security: JWT, Password Hashing, Role Guards
"""
from datetime import datetime, timedelta, timezone
from typing import Any
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.db.session import get_db

logger = logging.getLogger(__name__)

# ─── Password Hashing ───
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Bearer Token Scheme ───
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise UnauthorizedError(f"Invalid or expired session. Please log in again.")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Dependency: Extract and validate current user from JWT token."""
    if not credentials:
        raise UnauthorizedError()

    payload = decode_access_token(credentials.credentials)
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise UnauthorizedError()

    # Import here to avoid circular imports
    from app.models.models import User
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError("User account not found or deactivated.")

    return user


def require_role(*allowed_roles: str):
    """Dependency factory: ensure current user has one of the allowed roles."""
    async def role_checker(current_user = Depends(get_current_user)):
        role = getattr(current_user, "role", None)
        if role not in allowed_roles:
            raise ForbiddenError(
                f"This action requires one of the following roles: {', '.join(allowed_roles)}."
            )
        return current_user

    return role_checker


def require_super_admin():
    return require_role("super_admin")


def require_hod_or_above():
    return require_role("super_admin", "hod")


def require_faculty_or_above():
    return require_role("super_admin", "hod", "faculty")


def require_any_role():
    return require_role("super_admin", "hod", "faculty", "student")


from typing import Generator, Optional, Sequence
from fastapi import Depends, status, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.security import decode_access_token
from app.core.exceptions import HRCoreException
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)


def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    """Extracts and validates JWT Bearer token from request, returning authenticated user."""
    if not token:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
            message="Authentication credentials were not provided."
        )

    payload = decode_access_token(token)
    if not payload:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_TOKEN",
            message="Invalid or expired authentication token."
        )

    user_id: Optional[str] = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_TOKEN",
            message="Token payload is missing user identification."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="USER_NOT_FOUND",
            message="User account associated with this token does not exist."
        )

    if not user.is_active:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="USER_INACTIVE",
            message="User account has been deactivated."
        )

    return user


def get_current_active_verified_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensures current user is both active and email verified."""
    if not current_user.is_verified:
        raise HRCoreException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNVERIFIED_ACCOUNT",
            message="Email address has not been verified. Please verify your email before proceeding."
        )
    return current_user


def require_roles(*allowed_roles: UserRole):
    """
    Dependency factory that enforces Role-Based Access Control (RBAC).
    Raises 403 Forbidden if current user role is not in allowed_roles.
    """
    def role_checker(current_user: User = Depends(get_current_active_verified_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HRCoreException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="FORBIDDEN",
                message="Insufficient permissions to access this HR resource."
            )
        return current_user
    return role_checker


def enforce_self_or_admin(current_user: User, target_employee_id: str) -> None:
    """
    Enforces server-side authorization: an employee can only access their own profile/records,
    while HR and Admin roles can access any employee's administrative resource.
    """
    if current_user.role in [UserRole.ADMIN, UserRole.HR]:
        return
    if current_user.employee_id and current_user.employee_id == target_employee_id:
        return
    raise HRCoreException(
        status_code=status.HTTP_403_FORBIDDEN,
        code="FORBIDDEN",
        message="You are not authorized to access another employee's private HR data."
    )

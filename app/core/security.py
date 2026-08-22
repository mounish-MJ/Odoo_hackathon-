import secrets
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
from jose import jwt, JWTError
from app.core.config import settings
from app.core.logging import logger


def hash_password(password: str) -> str:
    """Hashes a plain text password using bcrypt."""
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against a bcrypt hash."""
    pwd_bytes = plain_password.encode('utf-8')[:72]
    hash_bytes = hashed_password.encode('utf-8')
    try:
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def create_access_token(subject: str, claims: Optional[Dict[str, Any]] = None, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token with standard and custom claims."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    if claims:
        to_encode.update(claims)

    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.debug(f"JWT decode error: {str(e)}")
        return None


def generate_random_token() -> str:
    """Generates a secure 64-character hex verification token."""
    return secrets.token_hex(32)

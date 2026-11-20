import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str) -> str:
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET must be configured before authentication is used")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "iat": now, "exp": now + timedelta(seconds=settings.jwt_access_expiration), "type": "access"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: int) -> tuple[str, datetime]:
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET must be configured before authentication is used")
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=settings.jwt_refresh_expiration)
    token = jwt.encode(
        {"sub": str(user_id), "iat": now, "exp": expires, "type": "refresh", "jti": secrets.token_urlsafe(16)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return token, expires.replace(tzinfo=None)


def decode_token(token: str, expected_type: str = "access") -> dict:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_temporary_password() -> str:
    return secrets.token_urlsafe(12)

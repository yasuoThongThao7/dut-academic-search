from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.security import decode_token
from app.models.entities import User

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DB,
) -> User:
    if credentials is None:
        raise AppError(401, "UNAUTHORIZED", "Cần đăng nhập")
    try:
        payload = decode_token(credentials.credentials)
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        user = None
    if user is None or user.status != "ACTIVE":
        raise AppError(401, "UNAUTHORIZED", "Token không hợp lệ hoặc tài khoản đã bị khóa")
    return user


def optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DB,
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    return user if user is not None and user.status == "ACTIVE" else None


def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "ADMIN":
        raise AppError(403, "FORBIDDEN", "Chỉ ADMIN được phép thực hiện thao tác này")
    return user


def require_student_or_admin(user: Annotated[User, Depends(current_user)]) -> User:
    return user

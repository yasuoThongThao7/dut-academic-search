from datetime import datetime, timezone

import jwt
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import (
    create_access_token, create_refresh_token, generate_temporary_password, hash_password,
    token_digest, verify_password,
)
from app.models.entities import RefreshToken, User
from app.models.entities import Major


def login(db: Session, identifier: str, password: str) -> tuple[User, str, str]:
    """identifier có thể là MSSV hoặc email."""
    identifier = identifier.strip()
    user = db.scalar(select(User).where(or_(User.student_id == identifier, User.email == identifier)))
    if user is None or not verify_password(password, user.password_hash):
        raise AppError(401, "INVALID_CREDENTIALS", "MSSV/email hoặc mật khẩu không chính xác")
    if user.status != "ACTIVE":
        raise AppError(403, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa")
    raw, expires = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_digest(raw), expires_at=expires))
    db.commit()
    return user, create_access_token(user.id, user.role), raw


def rotate_refresh(db: Session, raw: str) -> tuple[User, str, str]:
    try:
        payload = jwt.decode(raw, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise jwt.InvalidTokenError()
    except jwt.PyJWTError as exc:
        raise AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token không hợp lệ hoặc đã hết hạn") from exc
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user_id = int(payload["sub"])
    result = db.execute(update(RefreshToken).where(
        RefreshToken.token_hash == token_digest(raw),
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > now,
    ).values(revoked_at=now))
    if result.rowcount != 1:
        db.rollback()
        raise AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token không hợp lệ hoặc đã hết hạn")
    user = db.get(User, user_id)
    if user is None or user.status != "ACTIVE":
        db.rollback()
        raise AppError(401, "UNAUTHORIZED", "Tài khoản không hoạt động")
    new_raw, expires = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=token_digest(new_raw), expires_at=expires))
    db.commit()
    return user, create_access_token(user.id, user.role), new_raw


def logout(db: Session, raw: str | None) -> None:
    if raw:
        token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_digest(raw)))
        if token and token.revoked_at is None:
            token.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise AppError(400, "INVALID_PASSWORD", "Mật khẩu hiện tại không chính xác")
    user.password_hash = hash_password(new)
    user.force_password_change = False
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update(
        {"revoked_at": datetime.now(timezone.utc).replace(tzinfo=None)}
    )
    db.commit()


def create_student(db: Session, student_id: str, full_name: str, email: str | None, major_id: int | None) -> tuple[User, str]:
    if db.scalar(select(User.id).where(User.student_id == student_id)):
        raise AppError(409, "STUDENT_ID_EXISTS", "MSSV đã tồn tại", {"studentId": "MSSV đã tồn tại"})
    major = db.get(Major, major_id) if major_id is not None else None
    if major_id is not None and (major is None or major.status != "ACTIVE"):
        raise AppError(422, "INVALID_MAJOR", "Chuyên ngành không tồn tại", {"majorId": "Chuyên ngành không hợp lệ"})
    if email and db.scalar(select(User.id).where(User.email == email)):
        raise AppError(409, "EMAIL_EXISTS", "Email đã được sử dụng", {"email": "Email đã tồn tại"})
    password = generate_temporary_password()
    user = User(student_id=student_id, full_name=full_name, email=email, major_id=major_id,
                password_hash=hash_password(password), role="STUDENT", status="ACTIVE", force_password_change=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "USER_CONFLICT", "MSSV hoặc email đã tồn tại") from exc
    db.refresh(user)
    return user, password


def reset_password(db: Session, user: User) -> str:
    password = generate_temporary_password()
    user.password_hash = hash_password(password)
    user.force_password_change = True
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update(
        {"revoked_at": datetime.now(timezone.utc).replace(tzinfo=None)}
    )
    db.commit()
    return password
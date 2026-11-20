from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response

from app.auth.schemas import LoginData, LoginRequest, PasswordChange, UserSummary
from app.auth.service import change_password, login, logout, rotate_refresh
from app.common.dependencies import DB, current_user
from app.common.schemas import success
from app.core.config import settings
from app.models.entities import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie("refreshToken", token, httponly=True, secure=settings.cookie_secure,
                        samesite="none" if settings.cookie_secure else "lax",
                        max_age=settings.jwt_refresh_expiration, path="/api/v1/auth")


@router.post("/login")
def login_endpoint(body: LoginRequest, response: Response, db: DB):
    user, access, refresh = login(db, body.student_id, body.password)
    set_refresh_cookie(response, refresh)
    return success(LoginData(access_token=access, expires_in=settings.jwt_access_expiration,
                             user=UserSummary.model_validate(user)))


@router.post("/refresh")
def refresh_endpoint(response: Response, db: DB, refresh_token: Annotated[str | None, Cookie(alias="refreshToken")] = None):
    user, access, refresh = rotate_refresh(db, refresh_token or "")
    set_refresh_cookie(response, refresh)
    return success(LoginData(access_token=access, expires_in=settings.jwt_access_expiration,
                             user=UserSummary.model_validate(user)))


@router.post("/logout")
def logout_endpoint(response: Response, db: DB, refresh_token: Annotated[str | None, Cookie(alias="refreshToken")] = None):
    logout(db, refresh_token)
    response.delete_cookie("refreshToken", path="/api/v1/auth")
    return success({"loggedOut": True})


@router.get("/me")
def me(user: Annotated[User, Depends(current_user)]):
    return success(UserSummary.model_validate(user))


@router.patch("/password")
def update_password(body: PasswordChange, user: Annotated[User, Depends(current_user)], db: DB):
    change_password(db, user, body.current_password, body.new_password)
    return success({"updated": True})

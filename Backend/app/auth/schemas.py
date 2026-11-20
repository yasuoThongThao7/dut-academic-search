from pydantic import EmailStr, Field

from app.common.schemas import DTO


class LoginRequest(DTO):
    student_id: str = Field(min_length=1, max_length=32)
    password: str


class PasswordChange(DTO):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


class UserSummary(DTO):
    id: int
    student_id: str
    full_name: str
    role: str
    force_password_change: bool


class LoginData(DTO):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserSummary


class AdminUserCreate(DTO):
    student_id: str = Field(min_length=1, max_length=32)
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    major_id: int | None = None


from urllib.parse import urlparse

from pydantic import Field, field_validator

from app.common.schemas import DTO

MAX_URL_LENGTH = 1000


def normalize_url(value: str) -> str:
    """Chỉ nhận liên kết http/https hợp lệ, không chứa khoảng trắng hay thông tin đăng nhập."""
    value = value.strip()
    if not value:
        raise ValueError("Liên kết không được để trống")
    if len(value) > MAX_URL_LENGTH:
        raise ValueError(f"Liên kết tối đa {MAX_URL_LENGTH} ký tự")
    if any(ch.isspace() for ch in value):
        raise ValueError("Liên kết không được chứa khoảng trắng")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Liên kết phải bắt đầu bằng http:// hoặc https://")
    if parsed.username or parsed.password:
        raise ValueError("Liên kết không được chứa thông tin đăng nhập")
    return value


class DocumentCreate(DTO):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    major_id: int
    course_id: int
    course_offering_id: int | None = None
    category_code: str
    external_url: str
    access_note: str | None = Field(default=None, max_length=255)
    is_share_confirmed: bool

    @field_validator("external_url")
    @classmethod
    def check_url(cls, value: str) -> str:
        return normalize_url(value)

    @field_validator("is_share_confirmed")
    @classmethod
    def check_confirmed(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Bạn cần xác nhận đã bật quyền chia sẻ cho liên kết")
        return value


class DocumentPatch(DTO):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    major_id: int | None = None
    course_id: int | None = None
    course_offering_id: int | None = None
    category_code: str | None = None
    external_url: str | None = None
    access_note: str | None = Field(default=None, max_length=255)
    is_share_confirmed: bool | None = None

    @field_validator("external_url")
    @classmethod
    def check_url(cls, value: str | None) -> str | None:
        return None if value is None else normalize_url(value)

    @field_validator("is_share_confirmed")
    @classmethod
    def check_confirmed(cls, value: bool | None) -> bool | None:
        if value is False:
            raise ValueError("Bạn cần xác nhận đã bật quyền chia sẻ cho liên kết")
        return value
from pydantic import Field

from app.common.schemas import DTO


class DocumentCreate(DTO):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    major_id: int
    course_id: int
    course_offering_id: int | None = None
    category_code: str


class DocumentPatch(DTO):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    major_id: int | None = None
    course_id: int | None = None
    course_offering_id: int | None = None
    category_code: str | None = None

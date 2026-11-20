from datetime import date

from pydantic import ConfigDict, EmailStr, Field

from app.common.schemas import DTO


class CatalogInput(DTO):
    model_config = ConfigDict(alias_generator=lambda s: "".join(word.title() if i else word for i, word in enumerate(s.split("_"))),
                              populate_by_name=True, from_attributes=True, extra="forbid")
    code: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = None
    faculty_id: int | None = None
    major_id: int | None = None
    credits: int | None = Field(default=None, ge=1)
    lecturer_code: str | None = Field(default=None, min_length=1, max_length=32)
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    start_date: date | None = None
    end_date: date | None = None
    course_id: int | None = None
    lecturer_id: int | None = None
    term_id: int | None = None
    class_code: str | None = Field(default=None, min_length=1, max_length=64)


class UserStatusInput(DTO):
    status: str


class MajorCoursesInput(DTO):
    course_ids: list[int]

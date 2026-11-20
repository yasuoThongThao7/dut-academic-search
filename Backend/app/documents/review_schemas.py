from pydantic import Field

from app.common.schemas import DTO


class ReviewCreate(DTO):
    rating: int = Field(ge=1, le=5)
    content: str | None = None


class ReviewPatch(DTO):
    rating: int | None = Field(default=None, ge=1, le=5)
    content: str | None = None


class ModerationInput(DTO):
    status: str
    reason: str | None = None

from pydantic import Field

from app.common.schemas import DTO


class ReviewCreate(DTO):
    # 1 = Hữu ích, 0 = Không hữu ích
    rating: int = Field(ge=0, le=1)
    content: str | None = Field(default=None, max_length=1000)


class ReviewPatch(DTO):
    rating: int | None = Field(default=None, ge=0, le=1)
    content: str | None = Field(default=None, max_length=1000)


class ModerationInput(DTO):
    status: str
    reason: str | None = None
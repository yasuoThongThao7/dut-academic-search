from typing import Literal

from pydantic import Field

from app.common.schemas import DTO


class DocumentReportCreate(DTO):
    reason: Literal[
        "WRONG_COURSE", "WRONG_MAJOR", "INAPPROPRIATE",
        "BROKEN_LINK", "NO_ACCESS", "COPYRIGHT", "OTHER",
    ]
    description: str | None = Field(default=None, max_length=2000)


class DocumentReportUpdate(DTO):
    status: Literal["RESOLVED", "REJECTED"]
    hide_document: bool = False
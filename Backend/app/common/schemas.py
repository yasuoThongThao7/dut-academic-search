from typing import Any

from pydantic import BaseModel, ConfigDict


class DTO(BaseModel):
    model_config = ConfigDict(alias_generator=lambda s: "".join(word.title() if i else word for i, word in enumerate(s.split("_"))), populate_by_name=True, from_attributes=True)


def success(data: Any) -> dict:
    if isinstance(data, BaseModel):
        data = data.model_dump(by_alias=True)
    elif isinstance(data, list):
        data = [item.model_dump(by_alias=True) if isinstance(item, BaseModel) else item for item in data]
    return {"data": data}


def page_result(items: list, page: int, size: int, total: int) -> dict:
    return {"data": items, "page": page, "size": size, "totalElements": total, "totalPages": (total + size - 1) // size}

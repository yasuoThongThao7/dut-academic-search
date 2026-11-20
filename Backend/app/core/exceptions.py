from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, field_errors: dict | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field_errors = field_errors or {}


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    body = {"code": exc.code, "message": exc.message, "fieldErrors": exc.field_errors}
    return JSONResponse(status_code=exc.status_code, content=body)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = {}
    for error in exc.errors():
        key = ".".join(str(part) for part in error["loc"] if part not in ("body", "query", "path"))
        errors[key or "request"] = error["msg"]
    return JSONResponse(
        status_code=422,
        content={"code": "VALIDATION_ERROR", "message": "Dữ liệu không hợp lệ", "fieldErrors": errors},
    )

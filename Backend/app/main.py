from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.catalog.router import router as catalog_router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler, validation_error_handler
from app.documents.router import router as documents_router

app = FastAPI(title="DUT Document Sharing API", version="1.0.0", docs_url="/docs", redoc_url="/redoc")
app.add_middleware(
    CORSMiddleware, allow_origins=[settings.frontend_url], allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"],
)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)


@app.middleware("http")
async def validate_origin(request, call_next):
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") != settings.frontend_url.rstrip("/"):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=403, content={"code": "ORIGIN_NOT_ALLOWED", "message": "Origin không được phép"})
    return await call_next(request)


for api_router in (auth_router, catalog_router, documents_router, admin_router):
    app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Health"])
def health():
    return {"message": "Hello World"}


@app.get("/hello/{name}", tags=["Health"])
def say_hello(name: str):
    return {"message": f"Hello {name}"}

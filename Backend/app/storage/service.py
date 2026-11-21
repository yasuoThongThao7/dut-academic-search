import mimetypes
import uuid
import io
import zipfile
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import AppError

ALLOWED_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword", "application/octet-stream"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"},
    ".ppt": {"application/vnd.ms-powerpoint", "application/octet-stream"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"},
    ".xls": {"application/vnd.ms-excel", "application/octet-stream"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
}


class FileStorageService:
    def __init__(self) -> None:
        self.root = Path(settings.storage_location).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(self, upload: UploadFile) -> tuple[str, str, str, int]:
        extension = Path(upload.filename or "").suffix.lower()
        allowed_mime = ALLOWED_TYPES.get(extension)
        if not allowed_mime:
            raise AppError(400, "INVALID_FILE_TYPE", "Định dạng file không được hỗ trợ")
        content = await upload.read(settings.max_file_size + 1)
        if not content:
            raise AppError(400, "EMPTY_FILE", "File không được để trống")
        if len(content) > settings.max_file_size:
            raise AppError(413, "FILE_TOO_LARGE", "Dung lượng file vượt quá giới hạn")
        mime = upload.content_type or mimetypes.guess_type(upload.filename or "")[0] or "application/octet-stream"
        if mime not in allowed_mime:
            raise AppError(400, "INVALID_FILE_TYPE", "MIME type không khớp với định dạng file")
        if extension == ".pdf" and not content.startswith(b"%PDF-"):
            raise AppError(400, "INVALID_FILE_TYPE", "Nội dung file không phải PDF hợp lệ")
        if extension in {".doc", ".ppt", ".xls"} and not content.startswith(bytes.fromhex("D0CF11E0A1B11AE1")):
            raise AppError(400, "INVALID_FILE_TYPE", "Nội dung file Office không hợp lệ")
        expected_package_part = {
            ".docx": "word/document.xml", ".pptx": "ppt/presentation.xml",
            ".xlsx": "xl/workbook.xml",
        }.get(extension)
        if expected_package_part:
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as package:
                    if expected_package_part not in package.namelist():
                        raise ValueError("missing Office package part")
            except (zipfile.BadZipFile, ValueError) as exc:
                raise AppError(400, "INVALID_FILE_TYPE", "Nội dung file Office không hợp lệ") from exc
        if extension == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AppError(400, "INVALID_FILE_TYPE", "Nội dung file không phải PNG hợp lệ")
        if extension in (".jpg", ".jpeg") and not content.startswith(b"\xff\xd8\xff"):
            raise AppError(400, "INVALID_FILE_TYPE", "Nội dung file không phải JPEG hợp lệ")
        key = f"{uuid.uuid4().hex}{extension}"
        path = self._path(key)
        path.write_bytes(content)
        safe_name = Path((upload.filename or "document").replace("\\", "/")).name
        safe_name = "".join(char for char in safe_name if char.isprintable() and char not in "\r\n\x00")
        return key, safe_name[:255] or "document", mime, len(content)

    def _path(self, key: str) -> Path:
        if Path(key).name != key or key in (".", ".."):
            raise AppError(400, "INVALID_STORAGE_KEY", "Storage key không hợp lệ")
        path = (self.root / key).resolve()
        if path.parent != self.root:
            raise AppError(400, "INVALID_STORAGE_KEY", "Storage key không hợp lệ")
        return path

    def remove(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def locate(self, key: str) -> Path:
        return self._path(key)


storage = FileStorageService()

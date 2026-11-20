import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.common.dependencies import DB, current_user, optional_user, require_admin
from app.common.schemas import page_result, success
from app.core.exceptions import AppError
from app.documents.schemas import DocumentCreate, DocumentPatch
from app.documents.review_schemas import ModerationInput, ReviewCreate, ReviewPatch
from app.documents.report_schemas import DocumentReportCreate
from app.documents.service import get_document, may_edit, search_documents, soft_delete, validate_relations
from app.models.entities import (
    AcademicTerm, Course, CourseOffering, Document, DocumentCategory, DownloadLog, Favorite,
    DocumentReport, Faculty, Lecturer, Major, ModerationLog, Review, User, major_courses,
)
from app.storage.service import storage

router = APIRouter(tags=["Documents"])


@router.get("/documents")
def list_documents(
    db: DB, q: str | None = None, faculty_id: int | None = Query(None, alias="facultyId"),
    user: Annotated[User | None, Depends(optional_user)] = None,
    major_id: int | None = Query(None, alias="majorId"), course_id: int | None = Query(None, alias="courseId"),
    lecturer_id: int | None = Query(None, alias="lecturerId"), term_id: int | None = Query(None, alias="termId"),
    category_code: str | None = Query(None, alias="categoryCode"),
    sort: str = Query("recent", pattern="^(recent|popular|rating|downloads)$"),
    page: int = Query(0, ge=0), size: int = Query(12, ge=1, le=100),
):
    items, total = search_documents(db, q=q, faculty_id=faculty_id, major_id=major_id, course_id=course_id,
                                    lecturer_id=lecturer_id, term_id=term_id, category_code=category_code,
                                    sort=sort, page=page, size=size,
                                    viewer_user_id=user.id if user else None)
    return page_result(items, page, size, total)


@router.get("/dashboard/popular-courses")
def popular_courses(db: DB, user: Annotated[User | None, Depends(optional_user)] = None, limit: int = Query(6, ge=1, le=20)):
    rows = db.execute(
        select(Course.id, Course.code, Course.name, func.count(Document.id).label("documentCount"))
        .join(Document, Document.course_id == Course.id)
        .where(Document.status == "APPROVED", Document.deleted_at.is_(None))
        .group_by(Course.id, Course.code, Course.name)
        .order_by(func.count(Document.id).desc(), Course.name)
        .limit(limit)
    ).all()
    return success([
        {"id": row.id, "code": row.code, "name": row.name, "documentCount": row.documentCount}
        for row in rows
    ])


@router.get("/documents/{document_id}")
def document_detail(document_id: int, db: DB, user: Annotated[User | None, Depends(optional_user)] = None):
    return success(get_document(db, document_id, viewer_user_id=user.id if user else None))


@router.post("/documents")
async def upload_document(
    metadata: Annotated[str, Form()], file: Annotated[UploadFile, File()],
    db: DB, user: Annotated[User, Depends(current_user)],
):
    try:
        body = DocumentCreate.model_validate_json(metadata)
    except ValidationError as exc:
        raise AppError(422, "VALIDATION_ERROR", "Metadata không hợp lệ",
                       {str(e["loc"][0]): e["msg"] for e in exc.errors() if e.get("loc")}) from exc
    category_id = validate_relations(db, body.major_id, body.course_id, body.course_offering_id, body.category_code)
    key, original, mime, size = await storage.save(file)
    document = Document(title=body.title, description=body.description, uploader_id=user.id,
                        major_id=body.major_id, course_id=body.course_id, course_offering_id=body.course_offering_id,
                        category_id=category_id, original_file_name=original, stored_file_name=key,
                        storage_key=key, file_type=mime, file_size=size, status="PENDING")
    try:
        db.add(document)
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        storage.remove(key)
        raise
    return success({"id": document.id, "status": document.status})


@router.patch("/documents/{document_id}")
async def patch_document(
    document_id: int, db: DB, user: Annotated[User, Depends(current_user)],
    metadata: Annotated[str, Form()], file: Annotated[UploadFile | None, File()] = None,
):
    try:
        body = DocumentPatch.model_validate_json(metadata)
    except ValidationError as exc:
        raise AppError(422, "VALIDATION_ERROR", "Metadata không hợp lệ",
                       {str(e["loc"][0]): e["msg"] for e in exc.errors() if e.get("loc")}) from exc
    document = db.get(Document, document_id)
    if document is None or document.deleted_at is not None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    may_edit(document, user)
    values = body.model_dump(exclude_unset=True, by_alias=False)
    if "title" in values and values["title"] is None:
        raise AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", {"title": "Tiêu đề không được để trống"})
    major_id = values.get("major_id", document.major_id)
    course_id = values.get("course_id", document.course_id)
    offering_id = values.get("course_offering_id", document.course_offering_id)
    category_code = values.pop("category_code", None)
    if major_id != document.major_id or course_id != document.course_id or offering_id != document.course_offering_id or category_code:
        if category_code is None:
            category_code = db.get(DocumentCategory, document.category_id).code
        values["category_id"] = validate_relations(db, major_id, course_id, offering_id, category_code)
    old_key = document.storage_key
    new_key = None
    if file is not None:
        new_key, original, mime, size = await storage.save(file)
        values.update(original_file_name=original, stored_file_name=new_key, storage_key=new_key, file_type=mime, file_size=size)
    for key, value in values.items():
        setattr(document, key, value)
    document.status = "PENDING"
    document.rejection_reason = None
    try:
        db.commit()
    except Exception:
        db.rollback()
        if new_key:
            storage.remove(new_key)
        raise
    if new_key:
        storage.remove(old_key)
    return success({"id": document.id, "status": document.status})


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, db: DB, user: Annotated[User, Depends(current_user)]):
    document = db.get(Document, document_id)
    if document is None or document.deleted_at is not None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    may_edit(document, user)
    soft_delete(document)
    db.commit()
    return success({"deleted": True})


@router.post("/documents/{document_id}/views")
def record_view(document_id: int, db: DB, user: Annotated[User, Depends(current_user)]):
    document = db.scalar(select(Document).where(Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None)))
    if document is None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    document.view_count += 1
    db.commit()
    return success({"viewCount": document.view_count})


@router.get("/documents/{document_id}/download")
def download_document(document_id: int, db: DB, user: Annotated[User, Depends(current_user)]):
    document = db.scalar(select(Document).where(Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None)))
    if document is None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    path = storage.locate(document.storage_key)
    if not path.is_file():
        raise AppError(404, "FILE_NOT_FOUND", "Không tìm thấy file tài liệu")
    document.download_count += 1
    db.add(DownloadLog(user_id=user.id, document_id=document.id))
    db.commit()
    return FileResponse(path, filename=document.original_file_name, media_type=document.file_type)


@router.get("/documents/{document_id}/preview")
def preview_document(document_id: int, db: DB):
    document = db.scalar(select(Document).where(
        Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None)
    ))
    if document is None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    if document.file_type != "application/pdf" and not document.file_type.startswith("image/"):
        raise AppError(415, "PREVIEW_NOT_SUPPORTED", "Định dạng tài liệu không hỗ trợ xem trước")
    path = storage.locate(document.storage_key)
    if not path.is_file():
        raise AppError(404, "FILE_NOT_FOUND", "Không tìm thấy file tài liệu")
    return FileResponse(
        path,
        filename=document.original_file_name,
        media_type=document.file_type,
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post("/documents/{document_id}/reports")
def create_document_report(
    document_id: int, payload: DocumentReportCreate, db: DB, user: Annotated[User, Depends(current_user)]
):
    if user.role != "STUDENT":
        raise AppError(403, "FORBIDDEN", "Chỉ sinh viên được gửi báo cáo tài liệu")
    document = db.scalar(select(Document).where(
        Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None)
    ).with_for_update())
    if document is None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu đã duyệt")
    pending = db.scalar(select(DocumentReport.id).where(
        DocumentReport.document_id == document_id,
        DocumentReport.reporter_id == user.id,
        DocumentReport.status == "PENDING",
    ))
    if pending:
        raise AppError(409, "REPORT_EXISTS", "Bạn đã gửi báo cáo đang chờ xử lý cho tài liệu này")
    report = DocumentReport(
        document_id=document_id,
        reporter_id=user.id,
        reason=payload.reason,
        description=payload.description,
        status="PENDING",
    )
    db.add(report)
    try:
        db.commit()
        db.refresh(report)
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "REPORT_EXISTS", "Bạn đã gửi báo cáo cho tài liệu này") from exc
    return success({"id": report.id, "status": report.status, "createdAt": report.created_at.isoformat()})


@router.get("/documents/{document_id}/reviews")
def list_reviews(document_id: int, db: DB, page: int = Query(0, ge=0), size: int = Query(10, ge=1, le=100)):
    doc = db.scalar(select(Document.id).where(Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None)))
    if not doc:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    total = db.scalar(select(func.count(Review.id)).where(Review.document_id == document_id)) or 0
    rows = db.execute(select(Review, User).join(User, User.id == Review.user_id)
                      .where(Review.document_id == document_id).order_by(Review.created_at.desc())
                      .offset(page * size).limit(size)).all()
    items = [{"id": review.id, "user": {"id": author.id, "fullName": author.full_name},
              "rating": review.rating, "content": review.content,
              "createdAt": review.created_at.isoformat(), "updatedAt": review.updated_at.isoformat()}
             for review, author in rows]
    return page_result(items, page, size, total)


@router.post("/documents/{document_id}/reviews")
def create_review(document_id: int, payload: ReviewCreate, db: DB, user: Annotated[User, Depends(current_user)]):
    rating_value = payload.rating
    doc = db.scalar(select(Document).where(Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None)))
    if doc is None: raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu đã duyệt")
    existing = db.scalar(select(Review.id).where(Review.document_id == document_id, Review.user_id == user.id))
    if existing: raise AppError(409, "REVIEW_EXISTS", "Bạn đã đánh giá tài liệu này")
    review = Review(document_id=document_id, user_id=user.id, rating=rating_value, content=payload.content)
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "REVIEW_EXISTS", "Bạn đã đánh giá tài liệu này") from exc
    avg, count = db.execute(select(func.avg(Review.rating), func.count(Review.id)).where(Review.document_id == document_id)).one()
    return success({"id": review.id, "averageRating": float(avg or 0), "reviewCount": count})


@router.patch("/reviews/{review_id}")
def update_review(review_id: int, payload: ReviewPatch, db: DB, user: Annotated[User, Depends(current_user)]):
    review = db.get(Review, review_id)
    if review is None: raise AppError(404, "REVIEW_NOT_FOUND", "Không tìm thấy đánh giá")
    if review.user_id != user.id and user.role != "ADMIN": raise AppError(403, "FORBIDDEN", "Không có quyền sửa đánh giá")
    values = payload.model_dump(exclude_unset=True)
    if "rating" in values and values["rating"] is not None: review.rating = values["rating"]
    if "content" in values: review.content = values["content"]
    db.commit()
    avg, count = db.execute(select(func.avg(Review.rating), func.count(Review.id)).where(Review.document_id == review.document_id)).one()
    return success({"id": review.id, "averageRating": float(avg or 0), "reviewCount": count})


@router.delete("/reviews/{review_id}")
def delete_review(review_id: int, db: DB, user: Annotated[User, Depends(current_user)]):
    review = db.get(Review, review_id)
    if review is None: raise AppError(404, "REVIEW_NOT_FOUND", "Không tìm thấy đánh giá")
    if review.user_id != user.id and user.role != "ADMIN": raise AppError(403, "FORBIDDEN", "Không có quyền xóa đánh giá")
    db.delete(review)
    db.commit()
    return success({"deleted": True})


@router.get("/me/favorites")
def list_favorites(db: DB, user: Annotated[User, Depends(current_user)],
                   page: int = Query(0, ge=0), size: int = Query(12, ge=1, le=100)):
    query = select(Document.id).join(Favorite, Favorite.document_id == Document.id).where(
        Favorite.user_id == user.id, Document.deleted_at.is_(None), Document.status == "APPROVED")
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    ids = db.scalars(query.order_by(Favorite.created_at.desc()).offset(page * size).limit(size)).all()
    items = [get_document(db, doc_id, viewer_user_id=user.id) for doc_id in ids]
    return page_result(items, page, size, total)


@router.put("/me/favorites/{document_id}")
def add_favorite(document_id: int, db: DB, user: Annotated[User, Depends(current_user)]):
    doc = db.scalar(select(Document.id).where(Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None)))
    if not doc: raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu đã duyệt")
    existing = db.scalar(select(Favorite.id).where(Favorite.user_id == user.id, Favorite.document_id == document_id))
    if not existing:
        db.add(Favorite(user_id=user.id, document_id=document_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return success({"favorited": True})


@router.delete("/me/favorites/{document_id}")
def remove_favorite(document_id: int, db: DB, user: Annotated[User, Depends(current_user)]):
    favorite = db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.document_id == document_id))
    if favorite:
        db.delete(favorite)
        db.commit()
    return success({"favorited": False})


@router.get("/me/documents")
def my_documents(db: DB, user: Annotated[User, Depends(current_user)],
                 status: str | None = None, page: int = Query(0, ge=0), size: int = Query(12, ge=1, le=100)):
    allowed = {"PENDING", "APPROVED", "REJECTED", "HIDDEN"}
    if status and status not in allowed: raise AppError(422, "VALIDATION_ERROR", "Trạng thái không hợp lệ", {"status": "Trạng thái không hợp lệ"})
    conditions = [Document.uploader_id == user.id, Document.deleted_at.is_(None)]
    if status: conditions.append(Document.status == status)
    total = db.scalar(select(func.count(Document.id)).where(*conditions)) or 0
    docs = db.scalars(select(Document).where(*conditions).order_by(Document.created_at.desc()).offset(page * size).limit(size)).all()
    items = [get_document(db, item.id, public=False) for item in docs]
    return page_result(items, page, size, total)


@router.get("/admin/documents")
def admin_documents(db: DB, user: Annotated[User, Depends(require_admin)], status: str = "PENDING",
                    page: int = Query(0, ge=0), size: int = Query(12, ge=1, le=100)):
    if status not in {"PENDING", "APPROVED", "REJECTED", "HIDDEN"}:
        raise AppError(422, "VALIDATION_ERROR", "Trạng thái không hợp lệ", {"status": "Trạng thái không hợp lệ"})
    items, total = search_documents(db, status=status, page=page, size=size)
    return page_result(items, page, size, total)


@router.get("/admin/documents/{document_id}")
def admin_document_detail(document_id: int, db: DB, user: Annotated[User, Depends(require_admin)]):
    return success(get_document(db, document_id, public=False))


@router.get("/admin/documents/{document_id}/preview")
def admin_document_preview(document_id: int, db: DB, user: Annotated[User, Depends(require_admin)]):
    document = db.scalar(select(Document).where(Document.id == document_id, Document.deleted_at.is_(None)))
    if document is None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    if document.file_type != "application/pdf" and not document.file_type.startswith("image/"):
        raise AppError(415, "PREVIEW_NOT_SUPPORTED", "Định dạng tài liệu không hỗ trợ xem trước")
    path = storage.locate(document.storage_key)
    if not path.is_file():
        raise AppError(404, "FILE_NOT_FOUND", "Không tìm thấy file tài liệu")
    return FileResponse(
        path,
        filename=document.original_file_name,
        media_type=document.file_type,
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.patch("/admin/documents/{document_id}/moderation")
def moderate_document(document_id: int, payload: ModerationInput, db: DB, admin: Annotated[User, Depends(require_admin)]):
    status = payload.status
    reason = payload.reason
    if status not in {"APPROVED", "REJECTED", "HIDDEN"}:
        raise AppError(422, "VALIDATION_ERROR", "Trạng thái kiểm duyệt không hợp lệ", {"status": "Chỉ chấp nhận APPROVED, REJECTED, HIDDEN"})
    doc = db.get(Document, document_id)
    if doc is None or doc.deleted_at is not None: raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    if status == "REJECTED" and not reason:
        raise AppError(422, "VALIDATION_ERROR", "Cần nhập lý do từ chối", {"reason": "Lý do không được để trống"})
    doc.status = status
    doc.rejection_reason = reason if status == "REJECTED" else None
    db.add(ModerationLog(document_id=doc.id, admin_id=admin.id, status=status, reason=reason))
    db.commit()
    return success({"id": doc.id, "status": doc.status, "rejectionReason": doc.rejection_reason})

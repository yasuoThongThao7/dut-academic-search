from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.entities import (
    AcademicTerm, Course, CourseOffering, Document, DocumentCategory, Faculty, Lecturer,
    Favorite, Major, Review, User, major_courses,
)

# ---- Độ tin cậy -----------------------------------------------------------
# Quy ước: Review.rating = 1 (Hữu ích) hoặc 0 (Không hữu ích).
MIN_VOTES_FOR_TRUST = 5      # dưới ngưỡng này chưa kết luận độ tin cậy
TRUST_HIGH_PERCENT = 80      # >= 80% hữu ích
TRUST_MEDIUM_PERCENT = 50    # >= 50% hữu ích

TRUST_LABELS = {
    "INSUFFICIENT": "Chưa đủ đánh giá",
    "HIGH": "Độ tin cậy cao",
    "MEDIUM": "Độ tin cậy trung bình",
    "LOW": "Độ tin cậy thấp",
}


def vote_stats(helpful: int, total: int) -> dict:
    helpful, total = int(helpful or 0), int(total or 0)
    if total < MIN_VOTES_FOR_TRUST:
        code = "INSUFFICIENT"
    elif helpful * 100 >= TRUST_HIGH_PERCENT * total:
        code = "HIGH"
    elif helpful * 100 >= TRUST_MEDIUM_PERCENT * total:
        code = "MEDIUM"
    else:
        code = "LOW"
    return {
        "helpfulCount": helpful,
        "notHelpfulCount": total - helpful,
        "reviewCount": total,
        "helpfulRatio": round(helpful / total, 4) if total else None,
        "trust": {"code": code, "label": TRUST_LABELS[code]},
    }


def vote_summary(db: Session, document_id: int) -> dict:
    helpful, total = db.execute(
        select(func.coalesce(func.sum(Review.rating), 0), func.count(Review.id))
        .where(Review.document_id == document_id)
    ).one()
    return vote_stats(helpful, total)


# ---- Liên kết ngoài -------------------------------------------------------
def detect_storage_source(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if host in {"drive.google.com", "docs.google.com"} or host.endswith(".google.com"):
        return "Google Drive"
    if host in {"1drv.ms", "onedrive.live.com"} or host.endswith(".sharepoint.com") or host.endswith(".onedrive.com"):
        return "OneDrive"
    return "Khác"


def validate_relations(db: Session, major_id: int, course_id: int, offering_id: int | None, category_code: str) -> int:
    linked = db.execute(select(Major, Course).join(
        major_courses, major_courses.c.major_id == Major.id
    ).join(Course, Course.id == major_courses.c.course_id).where(
        major_courses.c.major_id == major_id, major_courses.c.course_id == course_id
    )).first()
    if not linked:
        raise AppError(422, "INVALID_MAJOR_COURSE", "Môn học không thuộc chuyên ngành đã chọn", {"courseId": "Quan hệ chuyên ngành-môn học không hợp lệ"})
    major, course = linked
    if major.status != "ACTIVE" or course.status != "ACTIVE" or major.faculty.status != "ACTIVE":
        raise AppError(422, "INACTIVE_CATALOG", "Chỉ được liên kết dữ liệu đào tạo đang hoạt động")
    category = db.scalar(select(DocumentCategory).where(DocumentCategory.code == category_code))
    if not category:
        raise AppError(422, "INVALID_CATEGORY", "Danh mục tài liệu không tồn tại", {"categoryCode": "Danh mục không hợp lệ"})
    if offering_id is not None:
        offering = db.get(CourseOffering, offering_id)
        if offering is None or offering.course_id != course_id:
            raise AppError(422, "INVALID_COURSE_OFFERING", "Lớp học phần không thuộc môn học đã chọn", {"courseOfferingId": "Quan hệ lớp học phần-môn học không hợp lệ"})
        if offering.lecturer.status != "ACTIVE" or offering.term.status != "ACTIVE":
            raise AppError(422, "INACTIVE_COURSE_OFFERING", "Lớp học phần không còn hoạt động")
    return category.id


def document_payload(row) -> dict:
    document, category, faculty, major, course, lecturer, term, class_code, uploader, helpful, total = row
    return {
        "id": document.id, "title": document.title, "description": document.description,
        "category": {"code": category.code, "name": category.name},
        "major": {"id": major.id, "name": major.name,
                  "faculty": {"id": faculty.id, "name": faculty.name}},
        "course": {"id": course.id, "code": course.code, "name": course.name},
        "courseOffering": ({
            "id": document.course_offering_id,
            "classCode": class_code,
            "course": {"id": course.id, "code": course.code, "name": course.name},
            "lecturer": {"id": lecturer.id, "fullName": lecturer.full_name},
            "academicTerm": {"id": term.id, "name": term.name},
        } if lecturer and term else None),
        "lecturer": {"id": lecturer.id, "fullName": lecturer.full_name} if lecturer else None,
        "academicTerm": {"id": term.id, "name": term.name} if term else None,
        "uploader": {"id": uploader.id, "fullName": uploader.full_name},
        "storageSource": document.storage_source, "accessNote": document.access_note,
        "viewCount": document.view_count, "accessCount": document.download_count,
        **vote_stats(helpful, total),
        "createdAt": document.created_at.isoformat() if document.created_at else None,
    }


def search_documents(
    db: Session, *, q: str | None = None, faculty_id: int | None = None, major_id: int | None = None,
    course_id: int | None = None, lecturer_id: int | None = None, term_id: int | None = None,
    category_code: str | None = None, sort: str = "recent", page: int = 0, size: int = 12,
    status: str = "APPROVED", uploader_id: int | None = None,
    viewer_user_id: int | None = None, min_helpful_percent: int | None = None,
) -> tuple[list[dict], int]:
    votes = select(
        Review.document_id.label("doc_id"),
        func.sum(Review.rating).label("helpful"),
        func.count(Review.id).label("total"),
    ).group_by(Review.document_id).subquery()
    stmt = select(
        Document, DocumentCategory, Faculty, Major, Course, Lecturer, AcademicTerm, CourseOffering.class_code, User,
        votes.c.helpful, votes.c.total,
    ).join(Document.category).join(Document.major).join(Major.faculty).join(Document.course).join(Document.uploader)
    stmt = stmt.join(major_courses, and_(
        major_courses.c.major_id == Document.major_id,
        major_courses.c.course_id == Document.course_id,
    ))
    stmt = stmt.outerjoin(Document.offering).outerjoin(CourseOffering.lecturer).outerjoin(CourseOffering.term)
    stmt = stmt.outerjoin(votes, votes.c.doc_id == Document.id)
    conditions = [Document.status == status, Document.deleted_at.is_(None)]
    if faculty_id is not None: conditions.append(Faculty.id == faculty_id)
    if major_id is not None: conditions.append(Major.id == major_id)
    if course_id is not None: conditions.append(Course.id == course_id)
    if lecturer_id is not None: conditions.append(Lecturer.id == lecturer_id)
    if term_id is not None: conditions.append(AcademicTerm.id == term_id)
    if category_code: conditions.append(DocumentCategory.code == category_code)
    if uploader_id is not None: conditions.append(Document.uploader_id == uploader_id)
    if min_helpful_percent is not None:
        # So sánh bằng số nguyên (helpful*100 >= phần trăm * tổng) để tránh sai số số thực.
        # Tài liệu chưa có đánh giá nào (total NULL) bị loại khi bật bộ lọc này.
        conditions.append(votes.c.helpful * 100 >= min_helpful_percent * votes.c.total)
    if q:
        pattern = f"%{q.strip()}%"
        conditions.append(or_(Document.title.ilike(pattern), Document.description.ilike(pattern),
                              Course.code.ilike(pattern), Course.name.ilike(pattern),
                              Lecturer.full_name.ilike(pattern)))
    stmt = stmt.where(*conditions)
    count_stmt = (
        select(func.count(func.distinct(Document.id))).select_from(Document)
        .join(Document.major).join(Major.faculty).join(Document.course)
        .join(major_courses, and_(major_courses.c.major_id == Document.major_id, major_courses.c.course_id == Document.course_id))
        .join(Document.category).outerjoin(Document.offering)
        .outerjoin(CourseOffering.lecturer).outerjoin(CourseOffering.term)
        .outerjoin(votes, votes.c.doc_id == Document.id)
        .where(*conditions)
    )
    # Xếp theo tỷ lệ hữu ích đã làm mượt (Laplace): (hữu ích + 1) / (tổng + 2).
    # Tránh việc tài liệu có 1/1 lượt hữu ích đứng trên tài liệu 95/100.
    total_votes = func.coalesce(votes.c.total, 0)
    smoothed = (func.coalesce(votes.c.helpful, 0) + 1.0) / (total_votes + 2.0)
    sort = {"rating": "helpful", "downloads": "accessed"}.get(sort, sort)  # tên cũ vẫn dùng được
    orders = {
        "recent": [Document.created_at.desc()],
        "popular": [Document.view_count.desc()],
        "accessed": [Document.download_count.desc()],
        "helpful": [smoothed.desc(), total_votes.desc()],
    }.get(sort, [Document.created_at.desc()])
    stmt = stmt.order_by(*orders, Document.id.desc())
    total = db.scalar(count_stmt) or 0
    rows = db.execute(stmt.offset(page * size).limit(size)).all()
    items = [document_payload(row) for row in rows]
    if viewer_user_id is not None and items:
        document_ids = [item["id"] for item in items]
        favorite_ids = set(db.scalars(select(Favorite.document_id).where(
            Favorite.user_id == viewer_user_id, Favorite.document_id.in_(document_ids)
        )).all())
        for item in items:
            item["isFavorite"] = item["id"] in favorite_ids
    return items, total


def get_document(db: Session, document_id: int, *, public: bool = True, viewer_user_id: int | None = None):
    if public:
        query = select(Document).where(Document.id == document_id, Document.status == "APPROVED", Document.deleted_at.is_(None))
    else:
        query = select(Document).where(Document.id == document_id, Document.deleted_at.is_(None))
    document = db.scalar(query)
    if document is None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Không tìm thấy tài liệu")
    offering = document.offering
    result = {
        "id": document.id, "title": document.title, "description": document.description,
        "category": {"id": document.category.id, "code": document.category.code, "name": document.category.name},
        "major": {"id": document.major.id, "name": document.major.name,
                  "faculty": {"id": document.major.faculty.id, "name": document.major.faculty.name}},
        "course": {"id": document.course.id, "code": document.course.code, "name": document.course.name},
        "courseOffering": ({
            "id": offering.id,
            "classCode": offering.class_code,
            "course": {"id": document.course.id, "code": document.course.code, "name": document.course.name},
            "lecturer": {"id": offering.lecturer.id, "fullName": offering.lecturer.full_name},
            "academicTerm": {"id": offering.term.id, "name": offering.term.name},
        } if offering else None),
        "lecturer": {"id": offering.lecturer.id, "fullName": offering.lecturer.full_name} if offering else None,
        "academicTerm": {"id": offering.term.id, "name": offering.term.name} if offering else None,
        "uploader": {"id": document.uploader.id, "fullName": document.uploader.full_name},
        "storageSource": document.storage_source, "accessNote": document.access_note,
        "viewCount": document.view_count, "accessCount": document.download_count,
        **vote_summary(db, document_id),
        "createdAt": document.created_at.isoformat() if document.created_at else None,
        "status": document.status, "rejectionReason": document.rejection_reason,
    }
    if not public:
        # Chỉ chủ tài liệu / admin (các route public=False) mới thấy link trực tiếp.
        # Người dùng thường lấy link qua POST /documents/{id}/access để lượt truy cập được ghi nhận.
        result["externalUrl"] = document.external_url
    if viewer_user_id is not None:
        result["isFavorite"] = db.scalar(select(Favorite.id).where(
            Favorite.user_id == viewer_user_id, Favorite.document_id == document_id
        )) is not None
        result["myRating"] = db.scalar(select(Review.rating).where(
            Review.user_id == viewer_user_id, Review.document_id == document_id
        ))
    return result


def may_edit(document: Document, user: User) -> None:
    if user.role != "ADMIN" and document.uploader_id != user.id:
        raise AppError(403, "FORBIDDEN", "Bạn không có quyền sửa tài liệu này")


def soft_delete(document: Document) -> None:
    document.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
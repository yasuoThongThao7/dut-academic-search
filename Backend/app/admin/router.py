from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.admin.service import CATALOG, create_catalog, delete_catalog, list_users, set_major_courses, set_user_status, update_catalog
from app.admin.schemas import CatalogInput, MajorCoursesInput, UserStatusInput
from app.auth.schemas import AdminUserCreate
from app.auth.service import create_student, reset_password
from app.common.dependencies import DB, require_admin
from app.common.schemas import page_result, success
from app.core.exceptions import AppError
from app.documents.report_schemas import DocumentReportUpdate
from app.documents.service import get_document
from app.models.entities import Course, CourseOffering, Document, DocumentReport, Faculty, Major, ModerationLog, User, major_courses
from datetime import datetime, timezone

router = APIRouter(prefix="/admin", tags=["Administration"])
Admin = Annotated[User, Depends(require_admin)]


@router.get("/dashboard/stats")
def dashboard(db: DB, admin: Admin):
    activities = []
    students = db.execute(
        select(User.id, User.full_name, User.created_at)
        .where(User.role == "STUDENT")
        .order_by(User.created_at.desc()).limit(10)
    ).all()
    activities.extend({
        "type": "STUDENT_CREATED", "description": f"Tạo tài khoản sinh viên {row.full_name}",
        "createdAt": row.created_at.isoformat(), "entityId": row.id,
    } for row in students if row.created_at)
    documents = db.execute(
        select(Document.id, Document.title, Document.status, Document.created_at)
        .where(Document.deleted_at.is_(None))
        .order_by(Document.created_at.desc()).limit(10)
    ).all()
    activities.extend({
        "type": "DOCUMENT_UPLOADED", "description": f"Đăng tài liệu {row.title}",
        "createdAt": row.created_at.isoformat(), "entityId": row.id,
    } for row in documents if row.created_at)
    moderation = db.execute(
        select(ModerationLog.id, ModerationLog.document_id, ModerationLog.status, ModerationLog.created_at, Document.title)
        .join(Document, Document.id == ModerationLog.document_id)
        .order_by(ModerationLog.created_at.desc()).limit(10)
    ).all()
    activities.extend({
        "type": f"DOCUMENT_{row.status}", "description": f"{row.status}: {row.title}",
        "createdAt": row.created_at.isoformat(), "entityId": row.document_id,
    } for row in moderation if row.created_at)
    reports = db.execute(
        select(DocumentReport.id, DocumentReport.status, DocumentReport.created_at, Document.title)
        .join(Document, Document.id == DocumentReport.document_id)
        .order_by(DocumentReport.created_at.desc()).limit(10)
    ).all()
    activities.extend({
        "type": "DOCUMENT_REPORTED", "description": f"Báo cáo {row.status.lower()}: {row.title}",
        "createdAt": row.created_at.isoformat(), "entityId": row.id,
    } for row in reports if row.created_at)
    activities.sort(key=lambda activity: activity["createdAt"], reverse=True)
    return success({
        "totalStudents": db.scalar(select(func.count(User.id)).where(User.role == "STUDENT")) or 0,
        "totalDocuments": db.scalar(select(func.count(Document.id)).where(Document.deleted_at.is_(None))) or 0,
        "pendingDocuments": db.scalar(select(func.count(Document.id)).where(Document.status == "PENDING", Document.deleted_at.is_(None))) or 0,
        "approvedDocuments": db.scalar(select(func.count(Document.id)).where(Document.status == "APPROVED", Document.deleted_at.is_(None))) or 0,
        "rejectedDocuments": db.scalar(select(func.count(Document.id)).where(Document.status == "REJECTED", Document.deleted_at.is_(None))) or 0,
        "totalDownloads": db.scalar(select(func.coalesce(func.sum(Document.download_count), 0)).where(Document.deleted_at.is_(None))) or 0,
        "recentActivities": sorted(activities, key=lambda activity: activity["createdAt"], reverse=True)[:10],
    })


@router.get("/users")
def users(db: DB, admin: Admin, page: int = Query(0, ge=0), size: int = Query(12, ge=1, le=100)):
    items, total = list_users(db, page, size)
    return page_result(items, page, size, total)


@router.post("/users")
def create_user(body: AdminUserCreate, db: DB, admin: Admin):
    user, password = create_student(db, body.student_id, body.full_name, body.email, body.major_id)
    return success({"user": {"id": user.id, "studentId": user.student_id, "fullName": user.full_name,
                             "email": user.email, "majorId": user.major_id,
                             "forcePasswordChange": user.force_password_change}, "temporaryPassword": password})


@router.patch("/users/{user_id}/status")
def update_user_status(user_id: int, payload: UserStatusInput, db: DB, admin: Admin):
    user = set_user_status(db, user_id, payload.status)
    return success({"id": user.id, "status": user.status})


def report_payload(report: DocumentReport) -> dict:
    return {
        "id": report.id,
        "documentId": report.document_id,
        "documentTitle": report.document.title,
        "documentStatus": report.document.status,
        "reporter": {
            "id": report.reporter_id,
            "studentId": report.reporter.student_id,
            "fullName": report.reporter.full_name,
        },
        "reason": report.reason,
        "description": report.description,
        "status": report.status,
        "adminId": report.admin_id,
        "resolvedAt": report.resolved_at.isoformat() if report.resolved_at else None,
        "createdAt": report.created_at.isoformat() if report.created_at else None,
    }


@router.get("/reports")
def reports(
    db: DB, admin: Admin, status: str | None = None,
    page: int = Query(0, ge=0), size: int = Query(12, ge=1, le=100),
):
    if status is not None and status not in {"PENDING", "RESOLVED", "REJECTED"}:
        raise AppError(422, "VALIDATION_ERROR", "Trạng thái báo cáo không hợp lệ")
    conditions = [DocumentReport.status == status] if status else []
    total = db.scalar(select(func.count(DocumentReport.id)).where(*conditions)) or 0
    rows = db.scalars(
        select(DocumentReport).where(*conditions)
        .order_by(DocumentReport.created_at.desc(), DocumentReport.id.desc())
        .offset(page * size).limit(size)
    ).all()
    return page_result([report_payload(row) for row in rows], page, size, total)


@router.get("/reports/{report_id}")
def report_detail(report_id: int, db: DB, admin: Admin):
    report = db.get(DocumentReport, report_id)
    if report is None:
        raise AppError(404, "REPORT_NOT_FOUND", "Không tìm thấy báo cáo")
    return success({**report_payload(report), "document": get_document(db, report.document_id, public=False)})


@router.patch("/reports/{report_id}")
def update_report(report_id: int, payload: DocumentReportUpdate, db: DB, admin: Admin):
    report = db.get(DocumentReport, report_id)
    if report is None:
        raise AppError(404, "REPORT_NOT_FOUND", "Không tìm thấy báo cáo")
    if report.status != "PENDING":
        raise AppError(409, "REPORT_ALREADY_PROCESSED", "Báo cáo này đã được xử lý")
    report.status = payload.status
    report.admin_id = admin.id
    report.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if payload.hide_document:
        document = db.get(Document, report.document_id)
        if document is not None and document.status != "HIDDEN":
            document.status = "HIDDEN"
            document.rejection_reason = None
            db.add(ModerationLog(
                document_id=document.id, admin_id=admin.id, status="HIDDEN",
                reason=f"Document report #{report.id}",
            ))
    db.commit()
    return success(report_payload(report))


@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: int, db: DB, admin: Admin):
    user = db.get(User, user_id)
    if user is None or user.role != "STUDENT": raise AppError(404, "USER_NOT_FOUND", "Không tìm thấy sinh viên")
    return success({"temporaryPassword": reset_password(db, user), "forcePasswordChange": True})


@router.get("/faculties")
def admin_faculties(db: DB, admin: Admin):
    rows = db.scalars(select(Faculty).order_by(Faculty.id)).all()
    return success([{"id": x.id, "code": x.code, "name": x.name, "description": x.description, "status": x.status} for x in rows])


@router.get("/majors")
def admin_majors(db: DB, admin: Admin):
    rows = db.scalars(select(Major).order_by(Major.id)).all()
    return success([{"id": x.id, "facultyId": x.faculty_id, "code": x.code, "name": x.name, "status": x.status} for x in rows])


@router.get("/courses")
def admin_courses(db: DB, admin: Admin):
    rows = db.scalars(select(Course).order_by(Course.id)).all()
    return success([{"id": x.id, "code": x.code, "name": x.name, "credits": x.credits, "description": x.description, "status": x.status} for x in rows])


@router.get("/majors/{major_id}/courses")
def admin_major_courses(major_id: int, db: DB, admin: Admin):
    if db.get(Major, major_id) is None:
        raise AppError(404, "MAJOR_NOT_FOUND", "Không tìm thấy chuyên ngành")
    rows = db.scalars(select(Course).join(major_courses).where(major_courses.c.major_id == major_id)).all()
    return success([{"id": x.id, "code": x.code, "name": x.name, "credits": x.credits} for x in rows])


@router.put("/majors/{major_id}/courses")
def update_major_courses(major_id: int, payload: MajorCoursesInput, db: DB, admin: Admin):
    course_ids = payload.course_ids
    set_major_courses(db, major_id, course_ids)
    rows = db.scalars(
        select(Course).join(major_courses).where(major_courses.c.major_id == major_id).order_by(Course.name)
    ).all()
    return success([{"id": row.id, "code": row.code, "name": row.name, "credits": row.credits} for row in rows])


@router.get("/lecturers")
def admin_lecturers(db: DB, admin: Admin):
    from app.models.entities import Lecturer
    rows = db.scalars(select(Lecturer).order_by(Lecturer.id)).all()
    return success([{"id": x.id, "lecturerCode": x.lecturer_code, "fullName": x.full_name, "email": x.email, "facultyId": x.faculty_id, "status": x.status} for x in rows])


@router.get("/academic-terms")
def admin_terms(db: DB, admin: Admin):
    from app.models.entities import AcademicTerm
    rows = db.scalars(select(AcademicTerm).order_by(AcademicTerm.id)).all()
    return success([{"id": x.id, "code": x.code, "name": x.name, "startDate": x.start_date.isoformat(), "endDate": x.end_date.isoformat(), "status": x.status} for x in rows])


@router.get("/course-offerings")
def admin_offerings(db: DB, admin: Admin):
    rows = db.scalars(select(CourseOffering).order_by(CourseOffering.id)).all()
    return success([{"id": x.id, "courseId": x.course_id, "lecturerId": x.lecturer_id, "termId": x.term_id, "classCode": x.class_code} for x in rows])


def serialize_catalog(kind: str, row):
    if kind == "faculties": return {"id": row.id, "code": row.code, "name": row.name, "description": row.description, "status": row.status}
    if kind == "majors": return {"id": row.id, "facultyId": row.faculty_id, "code": row.code, "name": row.name, "status": row.status}
    if kind == "courses": return {"id": row.id, "code": row.code, "name": row.name, "credits": row.credits, "description": row.description, "status": row.status}
    if kind == "lecturers": return {"id": row.id, "lecturerCode": row.lecturer_code, "fullName": row.full_name, "email": row.email, "facultyId": row.faculty_id, "status": row.status}
    if kind == "academic-terms": return {"id": row.id, "code": row.code, "name": row.name, "startDate": row.start_date.isoformat(), "endDate": row.end_date.isoformat(), "status": row.status}
    return {"id": row.id, "courseId": row.course_id, "lecturerId": row.lecturer_id, "termId": row.term_id, "classCode": row.class_code}


def register_catalog_routes(kind: str) -> None:
    def create_route(payload: CatalogInput, db: DB, admin: Admin):
        return success(serialize_catalog(kind, create_catalog(db, kind, payload.model_dump(exclude_unset=True))))

    def update_route(item_id: int, payload: CatalogInput, db: DB, admin: Admin):
        return success(serialize_catalog(kind, update_catalog(db, kind, item_id, payload.model_dump(exclude_unset=True))))

    router.add_api_route(f"/{kind}", create_route, methods=["POST"], name=f"create_{kind}")
    router.add_api_route(f"/{kind}/{{item_id}}", update_route, methods=["PATCH"], name=f"update_{kind}")
    def delete_route(item_id: int, db: DB, admin: Admin):
        delete_catalog(db, kind, item_id)
        return success({"deleted": True})

    router.add_api_route(f"/{kind}/{{item_id}}", delete_route, methods=["DELETE"], name=f"delete_{kind}")


for _kind in CATALOG:
    register_catalog_routes(_kind)

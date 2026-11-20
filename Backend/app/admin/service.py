from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.service import create_student, reset_password
from app.core.exceptions import AppError
from app.core.security import hash_password
from app.models.entities import (
    AcademicTerm, Course, CourseOffering, Document, Faculty, Favorite, Lecturer, Major,
    Review, User, major_courses,
)


def normalize_fields(values: dict) -> dict:
    normalized = {}
    for key, value in values.items():
        converted = []
        for char in key:
            if char.isupper():
                converted.extend(("_", char.lower()))
            else:
                converted.append(char)
        normalized["".join(converted)] = value
    for field in ("start_date", "end_date"):
        if isinstance(normalized.get(field), str):
            try:
                normalized[field] = date.fromisoformat(normalized[field])
            except ValueError as exc:
                raise AppError(422, "VALIDATION_ERROR", "Ngày không hợp lệ", {field: "Ngày phải theo định dạng YYYY-MM-DD"}) from exc
    return normalized


CATALOG = {
    "faculties": (Faculty, {"code", "name", "description", "status"}),
    "majors": (Major, {"faculty_id", "code", "name", "status"}),
    "courses": (Course, {"code", "name", "credits", "description", "status"}),
    "lecturers": (Lecturer, {"lecturer_code", "full_name", "email", "faculty_id", "status"}),
    "academic-terms": (AcademicTerm, {"code", "name", "start_date", "end_date", "status"}),
    "course-offerings": (CourseOffering, {"course_id", "lecturer_id", "term_id", "class_code"}),
}
CATALOG_REQUIRED = {
    "faculties": {"code", "name"}, "majors": {"faculty_id", "code", "name"},
    "courses": {"code", "name", "credits"}, "lecturers": {"lecturer_code", "full_name", "faculty_id"},
    "academic-terms": {"code", "name", "start_date", "end_date"},
    "course-offerings": {"course_id", "lecturer_id", "term_id", "class_code"},
}


def create_catalog(db: Session, kind: str, values: dict):
    values = normalize_fields(values)
    model, allowed = CATALOG[kind]
    invalid = set(values) - allowed
    missing = allowed - set(values)
    if kind in {"faculties", "majors", "courses", "lecturers", "academic-terms", "course-offerings"}:
        optional = {"description", "email", "status"}
        missing -= optional
    if invalid or missing:
        raise AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ",
                       {key: "Trường không hợp lệ hoặc bị thiếu" for key in invalid | missing})
    required = CATALOG_REQUIRED[kind]
    absent = {key for key in required if values.get(key) is None}
    if absent:
        raise AppError(422, "VALIDATION_ERROR", "Thiếu dữ liệu bắt buộc",
                       {key: "Trường không được để trống" for key in absent})
    if "status" in values and values["status"] not in {"ACTIVE", "INACTIVE"}:
        raise AppError(422, "VALIDATION_ERROR", "Trạng thái chỉ được là ACTIVE hoặc INACTIVE",
                       {"status": "Trạng thái không hợp lệ"})
    if kind == "majors" and db.get(Faculty, values["faculty_id"]) is None:
        raise AppError(422, "INVALID_FACULTY", "Khoa không tồn tại", {"facultyId": "Khoa không hợp lệ"})
    if kind == "lecturers" and db.get(Faculty, values["faculty_id"]) is None:
        raise AppError(422, "INVALID_FACULTY", "Khoa không tồn tại", {"facultyId": "Khoa không hợp lệ"})
    if kind == "academic-terms" and values["end_date"] < values["start_date"]:
        raise AppError(422, "VALIDATION_ERROR", "Khoảng thời gian không hợp lệ",
                       {"endDate": "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu"})
    if kind == "course-offerings":
        from app.models.entities import AcademicTerm, Lecturer
        course = db.get(Course, values["course_id"])
        lecturer = db.get(Lecturer, values["lecturer_id"])
        term = db.get(AcademicTerm, values["term_id"])
        if course is None or lecturer is None or term is None:
            raise AppError(422, "INVALID_RELATION", "Môn học, giảng viên hoặc học kỳ không tồn tại")
        if course.status != "ACTIVE" or lecturer.status != "ACTIVE" or term.status != "ACTIVE":
            raise AppError(422, "INACTIVE_RELATION", "Chỉ tạo lớp học phần với dữ liệu đang hoạt động")
    row = model(**values)
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "CATALOG_CONFLICT", "Dữ liệu trùng lặp hoặc quan hệ không hợp lệ") from exc
    return row


def update_catalog(db: Session, kind: str, row_id: int, values: dict):
    values = normalize_fields(values)
    model, allowed = CATALOG[kind]
    row = db.get(model, row_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy dữ liệu")
    if set(values) - allowed:
        raise AppError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ")
    invalid_nulls = {key for key, value in values.items() if key in CATALOG_REQUIRED[kind] and value is None}
    if invalid_nulls:
        raise AppError(422, "VALIDATION_ERROR", "Trường bắt buộc không được để trống",
                       {key: "Trường không được để trống" for key in invalid_nulls})
    if "status" in values and values["status"] not in {"ACTIVE", "INACTIVE"}:
        raise AppError(422, "VALIDATION_ERROR", "Trạng thái chỉ được là ACTIVE hoặc INACTIVE",
                       {"status": "Trạng thái không hợp lệ"})
    for key, value in values.items():
        setattr(row, key, value)
    if kind == "academic-terms" and row.start_date and row.end_date and row.end_date < row.start_date:
        raise AppError(422, "VALIDATION_ERROR", "Khoảng thời gian không hợp lệ",
                       {"endDate": "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu"})
    if kind == "course-offerings":
        from app.models.entities import AcademicTerm, Lecturer
        course = db.get(Course, row.course_id)
        lecturer = db.get(Lecturer, row.lecturer_id)
        term = db.get(AcademicTerm, row.term_id)
        if course is None or lecturer is None or term is None:
            db.rollback()
            raise AppError(422, "INVALID_RELATION", "Môn học, giảng viên hoặc học kỳ không tồn tại")
        if course.status != "ACTIVE" or lecturer.status != "ACTIVE" or term.status != "ACTIVE":
            db.rollback()
            raise AppError(422, "INACTIVE_RELATION", "Chỉ tạo lớp học phần với dữ liệu đang hoạt động")
    if kind == "majors" and db.get(Faculty, row.faculty_id) is None:
        db.rollback()
        raise AppError(422, "INVALID_FACULTY", "Khoa không tồn tại", {"facultyId": "Khoa không hợp lệ"})
    if kind == "lecturers" and db.get(Faculty, row.faculty_id) is None:
        db.rollback()
        raise AppError(422, "INVALID_FACULTY", "Khoa không tồn tại", {"facultyId": "Khoa không hợp lệ"})
    if "status" in values and values["status"] not in {"ACTIVE", "INACTIVE"}:
        db.rollback()
        raise AppError(422, "VALIDATION_ERROR", "Trạng thái chỉ được là ACTIVE hoặc INACTIVE",
                       {"status": "Trạng thái không hợp lệ"})
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "CATALOG_CONFLICT", "Dữ liệu trùng lặp hoặc quan hệ không hợp lệ") from exc
    return row


def delete_catalog(db: Session, kind: str, row_id: int):
    model, _ = CATALOG[kind]
    row = db.get(model, row_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Không tìm thấy dữ liệu")
    if hasattr(row, "status"):
        row.status = "INACTIVE"
    else:
        db.delete(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "REFERENCED_RESOURCE", "Không thể xóa dữ liệu đang được tham chiếu") from exc


def set_major_courses(db: Session, major_id: int, course_ids: list[int]) -> None:
    if db.get(Major, major_id) is None:
        raise AppError(404, "MAJOR_NOT_FOUND", "Không tìm thấy chuyên ngành")
    course_ids = list(dict.fromkeys(course_ids))
    found = set(db.scalars(select(Course.id).where(Course.id.in_(course_ids))).all()) if course_ids else set()
    if found != set(course_ids):
        raise AppError(422, "INVALID_COURSE", "Một hoặc nhiều môn học không tồn tại")
    try:
        existing_ids = set(db.scalars(
            select(major_courses.c.course_id).where(major_courses.c.major_id == major_id)
        ).all())
        removed_ids = existing_ids - set(course_ids)
        added_ids = set(course_ids) - existing_ids
        if removed_ids:
            db.execute(major_courses.delete().where(
                major_courses.c.major_id == major_id,
                major_courses.c.course_id.in_(removed_ids),
            ))
        if added_ids:
            db.execute(major_courses.insert(), [
                {"major_id": major_id, "course_id": course_id} for course_id in added_ids
            ])
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(409, "REFERENCED_MAPPING", "Không thể bỏ môn học đang được tài liệu sử dụng") from exc


def list_users(db: Session, page: int, size: int):
    total = db.scalar(select(func.count(User.id)).where(User.role == "STUDENT")) or 0
    rows = db.execute(
        select(User, Major, Faculty)
        .outerjoin(Major, Major.id == User.major_id)
        .outerjoin(Faculty, Faculty.id == Major.faculty_id)
        .where(User.role == "STUDENT")
        .order_by(User.id.desc()).offset(page * size).limit(size)
    ).all()
    return [{
        "id": user.id, "studentId": user.student_id, "fullName": user.full_name, "email": user.email,
        "majorId": user.major_id, "status": user.status, "active": user.status == "ACTIVE",
        "major": {"id": major.id, "name": major.name} if major else None,
        "faculty": {"id": faculty.id, "name": faculty.name} if faculty else None,
        "forcePasswordChange": user.force_password_change,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    } for user, major, faculty in rows], total


def set_user_status(db: Session, user_id: int, status: str):
    user = db.get(User, user_id)
    if user is None or user.role != "STUDENT": raise AppError(404, "USER_NOT_FOUND", "Không tìm thấy sinh viên")
    if status not in {"ACTIVE", "LOCKED"}: raise AppError(422, "VALIDATION_ERROR", "Trạng thái không hợp lệ")
    user.status = status
    db.commit()
    return user

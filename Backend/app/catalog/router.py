from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.common.dependencies import DB
from app.common.schemas import success
from app.models.entities import AcademicTerm, Course, CourseOffering, DocumentCategory, Faculty, Lecturer, Major, major_courses

router = APIRouter(tags=["Catalog"])


@router.get("/faculties")
def faculties(db: DB):
    rows = db.scalars(select(Faculty).where(Faculty.status == "ACTIVE").order_by(Faculty.name)).all()
    return success([{"id": x.id, "code": x.code, "name": x.name, "description": x.description} for x in rows])


@router.get("/faculties/{faculty_id}/majors")
def faculty_majors(faculty_id: int, db: DB):
    rows = db.scalars(select(Major).where(Major.faculty_id == faculty_id, Major.status == "ACTIVE").order_by(Major.name)).all()
    return success([{"id": x.id, "facultyId": x.faculty_id, "code": x.code, "name": x.name} for x in rows])


@router.get("/majors/{major_id}/courses")
def major_courses_list(major_id: int, db: DB, q: str | None = None):
    stmt = select(Course).join(major_courses).where(major_courses.c.major_id == major_id, Course.status == "ACTIVE")
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(Course.name.ilike(pattern) | Course.code.ilike(pattern))
    rows = db.scalars(stmt.order_by(Course.name)).all()
    return success([{"id": x.id, "code": x.code, "name": x.name, "credits": x.credits} for x in rows])


@router.get("/courses/{course_id}/offerings")
def course_offerings(course_id: int, db: DB, term_id: int | None = Query(None, alias="termId")):
    stmt = select(CourseOffering).join(Course).join(CourseOffering.lecturer).join(CourseOffering.term).where(
        CourseOffering.course_id == course_id, Course.status == "ACTIVE",
        Lecturer.status == "ACTIVE", AcademicTerm.status == "ACTIVE",
    )
    if term_id is not None: stmt = stmt.where(CourseOffering.term_id == term_id)
    rows = db.scalars(stmt.options(joinedload(CourseOffering.lecturer), joinedload(CourseOffering.term))
                      .order_by(CourseOffering.class_code)).all()
    return success([{"id": x.id, "courseId": x.course_id, "lecturer": {"id": x.lecturer.id, "fullName": x.lecturer.full_name},
                     "academicTerm": {"id": x.term.id, "name": x.term.name}, "classCode": x.class_code} for x in rows])


@router.get("/lecturers")
def lecturers(db: DB, q: str | None = None, course_id: int | None = Query(None, alias="courseId"),
              term_id: int | None = Query(None, alias="termId")):
    stmt = select(Lecturer).where(Lecturer.status == "ACTIVE")
    if q: stmt = stmt.where(Lecturer.full_name.ilike(f"%{q.strip()}%") | Lecturer.lecturer_code.ilike(f"%{q.strip()}%"))
    if course_id is not None or term_id is not None:
        stmt = stmt.join(CourseOffering, CourseOffering.lecturer_id == Lecturer.id).join(Course).join(AcademicTerm)
        stmt = stmt.where(Course.status == "ACTIVE", AcademicTerm.status == "ACTIVE")
        if course_id is not None: stmt = stmt.where(CourseOffering.course_id == course_id)
        if term_id is not None: stmt = stmt.where(CourseOffering.term_id == term_id)
    rows = db.scalars(stmt.distinct().order_by(Lecturer.full_name)).all()
    return success([{"id": x.id, "lecturerCode": x.lecturer_code, "fullName": x.full_name, "email": x.email, "facultyId": x.faculty_id} for x in rows])


@router.get("/academic-terms")
def academic_terms(db: DB):
    rows = db.scalars(select(AcademicTerm).where(AcademicTerm.status == "ACTIVE").order_by(AcademicTerm.start_date.desc())).all()
    return success([{"id": x.id, "code": x.code, "name": x.name, "startDate": x.start_date.isoformat(), "endDate": x.end_date.isoformat()} for x in rows])


@router.get("/document-categories")
def document_categories(db: DB):
    rows = db.scalars(select(DocumentCategory).order_by(DocumentCategory.id)).all()
    return success([{"id": x.id, "code": x.code, "name": x.name} for x in rows])

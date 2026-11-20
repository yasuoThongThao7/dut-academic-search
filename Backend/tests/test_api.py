import os
import json
from datetime import date

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-long-enough-123456")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.entities import (
    AcademicTerm, Course, CourseOffering, Document, DocumentCategory, Faculty, Lecturer,
    Major, User, major_courses,
)


@pytest.fixture
def client(tmp_path):
    from app.storage.service import storage

    original_storage_root = storage.root
    storage.root = tmp_path
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    event.listen(engine, "connect", lambda conn, record: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with factory() as db:
        faculty = Faculty(code="ICT", name="Information Technology", status="ACTIVE")
        db.add(faculty)
        db.flush()
        major = Major(faculty_id=faculty.id, code="CS", name="Computer Science", status="ACTIVE")
        course = Course(code="CS101", name="Data Structures", credits=3, status="ACTIVE")
        lecturer = Lecturer(lecturer_code="L1", full_name="Lecturer Nguyen", faculty_id=faculty.id, status="ACTIVE")
        term = AcademicTerm(code="2026-1", name="Term 1", start_date=date(2026, 1, 1), end_date=date(2026, 6, 30), status="ACTIVE")
        category = DocumentCategory(code="EXAM", name="Exam")
        user = User(student_id="102230001", full_name="Student A", password_hash=hash_password("student-password"),
                    role="STUDENT", status="ACTIVE", force_password_change=False)
        admin = User(student_id="ADMIN001", full_name="Admin A", password_hash=hash_password("admin-password"),
                     role="ADMIN", status="ACTIVE", force_password_change=False)
        db.add_all([major, course, lecturer, term, category, user, admin])
        db.flush()
        db.execute(major_courses.insert().values(major_id=major.id, course_id=course.id))
        offering = CourseOffering(course_id=course.id, lecturer_id=lecturer.id, term_id=term.id, class_code="CS101.01")
        db.add(offering)
        db.flush()
        approved = Document(title="Data structures exam", description="Review notes", uploader_id=user.id,
                            major_id=major.id, course_id=course.id, course_offering_id=offering.id,
                            category_id=category.id, status="APPROVED", original_file_name="exam.pdf",
                            stored_file_name="missing.pdf", storage_key="missing.pdf", file_type="application/pdf", file_size=5)
        pending = Document(title="Pending hidden document", uploader_id=user.id, major_id=major.id,
                           course_id=course.id, category_id=category.id, status="PENDING",
                           original_file_name="pending.pdf", stored_file_name="pending.pdf", storage_key="pending.pdf",
                           file_type="application/pdf", file_size=5)
        db.add_all([approved, pending])
        db.commit()
        ids = {"faculty": faculty.id, "major": major.id, "course": course.id, "lecturer": lecturer.id, "term": term.id}
    with TestClient(app) as test_client:
        yield test_client, ids
    app.dependency_overrides.clear()
    storage.root = original_storage_root
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_login_refresh_rotation_and_admin_authorization(client):
    api, _ = client
    result = api.post("/api/v1/auth/login", json={"studentId": "102230001", "password": "student-password"})
    assert result.status_code == 200
    assert result.json()["data"]["user"]["role"] == "STUDENT"
    original_cookie = api.cookies.get("refreshToken")
    rotated = api.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    assert api.cookies.get("refreshToken") != original_cookie
    assert api.post("/api/v1/auth/refresh").status_code == 200
    assert api.get("/api/v1/admin/dashboard/stats", headers={"Authorization": f"Bearer {result.json()['data']['accessToken']}"}).status_code == 403


def test_search_approved_documents_combines_filters_and_hides_pending(client):
    api, ids = client
    params = {
        "q": "Lecturer Nguyen", "facultyId": ids["faculty"], "majorId": ids["major"],
        "courseId": ids["course"], "lecturerId": ids["lecturer"], "termId": ids["term"],
        "categoryCode": "EXAM", "sort": "recent", "page": 0, "size": 12,
    }
    response = api.get("/api/v1/documents", params=params)
    assert response.status_code == 200
    result = response.json()
    assert result["totalElements"] == 1
    assert result["data"][0]["course"]["code"] == "CS101"
    assert result["data"][0]["lecturer"]["fullName"] == "Lecturer Nguyen"
    assert api.get("/api/v1/documents", params={"q": "Pending hidden"}).json()["totalElements"] == 0


def test_openapi_has_no_registration_endpoint(client):
    api, _ = client
    paths = api.get("/openapi.json").json()["paths"]
    assert "/api/v1/auth/register" not in paths
    assert "/api/v1/documents/{document_id}/download" in paths


def test_upload_requires_major_course_relation_and_valid_pdf(client):
    api, ids = client
    login = api.post("/api/v1/auth/login", json={"studentId": "102230001", "password": "student-password"}).json()
    headers = {"Authorization": f"Bearer {login['data']['accessToken']}"}
    metadata = {
        "title": "New exam", "description": "Uploaded", "majorId": ids["major"],
        "courseId": ids["course"], "categoryCode": "EXAM",
    }
    response = api.post("/api/v1/documents", headers=headers,
                        data={"metadata": json.dumps(metadata)},
                        files={"file": ("exam.pdf", b"%PDF-1.7\nbody", "application/pdf")})
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "PENDING"
    bad_metadata = dict(metadata, majorId=99999)
    bad = api.post("/api/v1/documents", headers=headers,
                   data={"metadata": json.dumps(bad_metadata)},
                   files={"file": ("exam.pdf", b"%PDF-1.7\nbody", "application/pdf")})
    assert bad.status_code == 422
    invalid_file = api.post("/api/v1/documents", headers=headers,
                            data={"metadata": json.dumps(metadata)},
                            files={"file": ("exam.pdf", b"not a pdf", "application/pdf")})
    assert invalid_file.status_code == 400


def test_review_create_update_and_duplicate(client):
    api, _ = client
    login = api.post("/api/v1/auth/login", json={"studentId": "102230001", "password": "student-password"}).json()
    headers = {"Authorization": f"Bearer {login['data']['accessToken']}"}
    created = api.post("/api/v1/documents/1/reviews", headers=headers, json={"rating": 5, "content": "Useful"})
    assert created.status_code == 200
    assert created.json()["data"]["averageRating"] == 5
    assert api.post("/api/v1/documents/1/reviews", headers=headers, json={"rating": 4}).status_code == 409
    review_id = api.get("/api/v1/documents/1/reviews").json()["data"][0]["id"]
    updated = api.patch(f"/api/v1/reviews/{review_id}", headers=headers, json={"rating": 3})
    assert updated.status_code == 200
    assert updated.json()["data"]["averageRating"] == 3


def test_admin_student_provisioning_and_catalog_relationship_reads(client):
    api, ids = client
    login = api.post("/api/v1/auth/login", json={"studentId": "ADMIN001", "password": "admin-password"}).json()
    headers = {"Authorization": f"Bearer {login['data']['accessToken']}"}
    created = api.post("/api/v1/admin/users", headers=headers, json={
        "studentId": "102230002", "fullName": "Student B", "email": "b@example.com", "majorId": ids["major"],
    })
    assert created.status_code == 200
    assert created.json()["data"]["user"]["forcePasswordChange"] is True
    temp_password = created.json()["data"]["temporaryPassword"]
    assert api.post("/api/v1/auth/login", json={"studentId": "102230002", "password": temp_password}).status_code == 200
    duplicate = api.post("/api/v1/admin/users", headers=headers, json={
        "studentId": "102230002", "fullName": "Duplicate",
    })
    assert duplicate.status_code == 409
    assert api.get("/api/v1/courses/1/offerings", params={"termId": ids["term"]}).json()["data"][0]["classCode"] == "CS101.01"
    lecturers = api.get("/api/v1/lecturers", params={"courseId": ids["course"], "termId": ids["term"]})
    assert lecturers.status_code == 200
    assert len(lecturers.json()["data"]) == 1


def test_approved_document_download_is_streamed(client):
    from app.storage.service import storage

    api, _ = client
    storage.locate("missing.pdf").write_bytes(b"%PDF-1.7\ncontent")
    login = api.post("/api/v1/auth/login", json={"studentId": "102230001", "password": "student-password"}).json()
    response = api.get("/api/v1/documents/1/download",
                       headers={"Authorization": f"Bearer {login['data']['accessToken']}"})
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF-")


def test_preview_is_inline_and_rejects_non_public_documents(client):
    from app.storage.service import storage

    api, _ = client
    storage.locate("missing.pdf").write_bytes(b"%PDF-1.7\ncontent")
    response = api.get("/api/v1/documents/1/preview")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline;")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert api.get("/api/v1/documents/2/preview").status_code == 404


def test_admin_can_preview_pending_document_but_student_cannot(client):
    from app.storage.service import storage

    api, _ = client
    storage.locate("pending.pdf").write_bytes(b"%PDF-1.7\npending")
    student_token = api.post(
        "/api/v1/auth/login",
        json={"studentId": "102230001", "password": "student-password"},
    ).json()["data"]["accessToken"]
    path = "/api/v1/admin/documents/2/preview"
    assert api.get(path, headers={"Authorization": f"Bearer {student_token}"}).status_code == 403
    admin_token = api.post(
        "/api/v1/auth/login",
        json={"studentId": "ADMIN001", "password": "admin-password"},
    ).json()["data"]["accessToken"]
    response = api.get(path, headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("inline;")


def test_report_submission_admin_resolution_and_duplicate_pending(client):
    api, _ = client
    student_token = api.post(
        "/api/v1/auth/login",
        json={"studentId": "102230001", "password": "student-password"},
    ).json()["data"]["accessToken"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    payload = {"reason": "BROKEN_FILE", "description": "File không mở được"}
    created = api.post("/api/v1/documents/1/reports", headers=student_headers, json=payload)
    assert created.status_code == 200
    report_id = created.json()["data"]["id"]
    assert api.post("/api/v1/documents/1/reports", headers=student_headers, json=payload).status_code == 409

    admin_token = api.post(
        "/api/v1/auth/login",
        json={"studentId": "ADMIN001", "password": "admin-password"},
    ).json()["data"]["accessToken"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    report = api.get("/api/v1/admin/reports", headers=admin_headers)
    assert report.status_code == 200
    assert report.json()["data"][0]["id"] == report_id
    details = api.get(f"/api/v1/admin/reports/{report_id}", headers=admin_headers)
    assert details.json()["data"]["document"]["id"] == 1
    updated = api.patch(
        f"/api/v1/admin/reports/{report_id}",
        headers=admin_headers,
        json={"status": "RESOLVED"},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["status"] == "RESOLVED"


def test_document_patch_uses_metadata_multipart_and_resubmits_for_moderation(client):
    import json

    api, _ = client
    token = api.post(
        "/api/v1/auth/login",
        json={"studentId": "102230001", "password": "student-password"},
    ).json()["data"]["accessToken"]
    response = api.patch(
        "/api/v1/documents/1",
        headers={"Authorization": f"Bearer {token}"},
        data={"metadata": json.dumps({"title": "Updated title"})},
    )
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "PENDING"
    assert api.get("/api/v1/documents/1").status_code == 404


def test_favorite_state_is_returned_for_authenticated_search_and_detail(client):
    api, _ = client
    token = api.post(
        "/api/v1/auth/login",
        json={"studentId": "102230001", "password": "student-password"},
    ).json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    assert api.put("/api/v1/me/favorites/1", headers=headers).status_code == 200
    assert api.get("/api/v1/documents/1", headers=headers).json()["data"]["isFavorite"] is True
    assert api.get("/api/v1/documents", headers=headers).json()["data"][0]["isFavorite"] is True
    assert api.delete("/api/v1/me/favorites/1", headers=headers).status_code == 200
    assert api.get("/api/v1/documents/1", headers=headers).json()["data"]["isFavorite"] is False


def test_major_course_mapping_deduplicates_and_preserves_existing_document_links(client):
    api, ids = client
    admin_token = api.post(
        "/api/v1/auth/login",
        json={"studentId": "ADMIN001", "password": "admin-password"},
    ).json()["data"]["accessToken"]
    response = api.put(
        f"/api/v1/admin/majors/{ids['major']}/courses",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"courseIds": [ids["course"], ids["course"]]},
    )
    assert response.status_code == 200
    assert [course["id"] for course in response.json()["data"]] == [ids["course"]]
    assert api.get("/api/v1/documents").json()["totalElements"] == 1

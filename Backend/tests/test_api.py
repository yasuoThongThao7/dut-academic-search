import os
from datetime import date

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-long-enough-123456")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.entities import (
    AcademicTerm, Course, CourseOffering, Document, DocumentCategory, Faculty, Lecturer,
    Major, Review, User, major_courses,
)

STUDENT_A = ("102230001", "student-password")   # người đăng tài liệu 1 và 2
STUDENT_B = ("102230003", "student-b-password")  # người đánh giá (email: student.b@example.com)
ADMIN = ("ADMIN001", "admin-password")
DRIVE_URL = "https://drive.google.com/file/d/abc123/view"


@pytest.fixture
def client():
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
        user = User(student_id=STUDENT_A[0], full_name="Student A", password_hash=hash_password(STUDENT_A[1]),
                    role="STUDENT", status="ACTIVE", force_password_change=False)
        student_b = User(student_id=STUDENT_B[0], full_name="Student B", email="student.b@example.com",
                         password_hash=hash_password(STUDENT_B[1]),
                         role="STUDENT", status="ACTIVE", force_password_change=False)
        admin = User(student_id=ADMIN[0], full_name="Admin A", password_hash=hash_password(ADMIN[1]),
                     role="ADMIN", status="ACTIVE", force_password_change=False)
        db.add_all([major, course, lecturer, term, category, user, student_b, admin])
        db.flush()
        db.execute(major_courses.insert().values(major_id=major.id, course_id=course.id))
        offering = CourseOffering(course_id=course.id, lecturer_id=lecturer.id, term_id=term.id, class_code="CS101.01")
        db.add(offering)
        db.flush()
        approved = Document(title="Data structures exam", description="Review notes", uploader_id=user.id,
                            major_id=major.id, course_id=course.id, course_offering_id=offering.id,
                            category_id=category.id, status="APPROVED", external_url=DRIVE_URL,
                            storage_source="Google Drive", access_note="Dùng email sinh viên để xem")
        pending = Document(title="Pending hidden document", uploader_id=user.id, major_id=major.id,
                           course_id=course.id, category_id=category.id, status="PENDING",
                           external_url="https://1drv.ms/b/s!pending", storage_source="OneDrive")
        db.add_all([approved, pending])
        db.commit()
        ids = {"faculty": faculty.id, "major": major.id, "course": course.id, "lecturer": lecturer.id,
               "term": term.id, "session_factory": factory}
    with TestClient(app) as test_client:
        yield test_client, ids
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def login_headers(api, credentials):
    student_id, password = credentials
    data = api.post("/api/v1/auth/login", json={"studentId": student_id, "password": password}).json()
    return {"Authorization": f"Bearer {data['data']['accessToken']}"}


# ---------------------------------------------------------------- Đăng nhập
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


def test_login_accepts_student_id_or_email(client):
    api, _ = client
    by_id = api.post("/api/v1/auth/login", json={"studentId": STUDENT_B[0], "password": STUDENT_B[1]})
    by_email = api.post("/api/v1/auth/login", json={"studentId": "student.b@example.com", "password": STUDENT_B[1]})
    assert by_id.status_code == 200
    assert by_email.status_code == 200
    assert by_email.json()["data"]["user"]["studentId"] == STUDENT_B[0]
    wrong = api.post("/api/v1/auth/login", json={"studentId": "student.b@example.com", "password": "sai-mat-khau"})
    assert wrong.status_code == 401


# ---------------------------------------------------------------- Tìm kiếm
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


def test_openapi_exposes_link_endpoints_and_no_file_endpoints(client):
    api, _ = client
    paths = api.get("/openapi.json").json()["paths"]
    assert "/api/v1/auth/register" not in paths
    assert "/api/v1/documents/{document_id}/access" in paths
    assert "/api/v1/documents/{document_id}/download" not in paths
    assert "/api/v1/documents/{document_id}/preview" not in paths
    assert "/api/v1/admin/documents/{document_id}/preview" not in paths


# ---------------------------------------------------------------- Tài liệu = liên kết ngoài
def test_create_document_with_external_link_and_validation(client):
    api, ids = client
    headers = login_headers(api, STUDENT_A)
    body = {
        "title": "New exam", "description": "Shared by link", "majorId": ids["major"],
        "courseId": ids["course"], "categoryCode": "EXAM",
        "externalUrl": "https://1drv.ms/b/s!abc", "accessNote": "Cần đăng nhập email trường",
        "isShareConfirmed": True,
    }
    created = api.post("/api/v1/documents", headers=headers, json=body)
    assert created.status_code == 200
    assert created.json()["data"]["status"] == "PENDING"
    doc_id = created.json()["data"]["id"]

    # Admin thấy link và nguồn lưu trữ do server tự nhận diện
    detail = api.get(f"/api/v1/admin/documents/{doc_id}", headers=login_headers(api, ADMIN)).json()["data"]
    assert detail["externalUrl"] == "https://1drv.ms/b/s!abc"
    assert detail["storageSource"] == "OneDrive"
    assert detail["accessNote"] == "Cần đăng nhập email trường"

    # Dữ liệu không hợp lệ
    assert api.post("/api/v1/documents", headers=headers, json=dict(body, majorId=99999)).status_code == 422
    assert api.post("/api/v1/documents", headers=headers, json=dict(body, externalUrl="ftp://server/file")).status_code == 422
    assert api.post("/api/v1/documents", headers=headers, json=dict(body, externalUrl="https://a.com/x y")).status_code == 422
    assert api.post("/api/v1/documents", headers=headers, json=dict(body, externalUrl="https://u:p@a.com/x")).status_code == 422
    assert api.post("/api/v1/documents", headers=headers, json=dict(body, description="x" * 501)).status_code == 422
    assert api.post("/api/v1/documents", headers=headers, json=dict(body, isShareConfirmed=False)).status_code == 422
    missing = {k: v for k, v in body.items() if k != "externalUrl"}
    assert api.post("/api/v1/documents", headers=headers, json=missing).status_code == 422
    # Description đúng 500 ký tự vẫn hợp lệ
    assert api.post("/api/v1/documents", headers=headers, json=dict(body, description="x" * 500)).status_code == 200


def test_public_detail_hides_link_and_access_endpoint_counts_visits(client):
    api, _ = client
    public = api.get("/api/v1/documents/1").json()["data"]
    assert "externalUrl" not in public
    assert public["storageSource"] == "Google Drive"
    assert public["accessCount"] == 0

    assert api.post("/api/v1/documents/1/access").status_code in (401, 403)   # cần đăng nhập
    headers = login_headers(api, STUDENT_B)
    first = api.post("/api/v1/documents/1/access", headers=headers)
    assert first.status_code == 200
    assert first.json()["data"]["externalUrl"] == DRIVE_URL
    assert first.json()["data"]["accessCount"] == 1
    assert api.post("/api/v1/documents/1/access", headers=headers).json()["data"]["accessCount"] == 2
    assert api.get("/api/v1/documents/1").json()["data"]["accessCount"] == 2
    # Tài liệu chưa duyệt không truy cập được
    assert api.post("/api/v1/documents/2/access", headers=headers).status_code == 404


def test_document_patch_is_json_and_resubmits_for_moderation(client):
    api, _ = client
    headers = login_headers(api, STUDENT_A)
    response = api.patch("/api/v1/documents/1", headers=headers, json={"title": "Updated title"})
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "PENDING"
    assert api.get("/api/v1/documents/1").status_code == 404   # chờ duyệt lại nên bị ẩn

    updated = api.patch("/api/v1/documents/1", headers=headers, json={"externalUrl": "https://1drv.ms/x/new"})
    assert updated.status_code == 200
    detail = api.get("/api/v1/admin/documents/1", headers=login_headers(api, ADMIN)).json()["data"]
    assert detail["externalUrl"] == "https://1drv.ms/x/new"
    assert detail["storageSource"] == "OneDrive"

    assert api.patch("/api/v1/documents/1", headers=headers, json={"externalUrl": None}).status_code == 422
    assert api.patch("/api/v1/documents/1", headers=headers, json={"isShareConfirmed": False}).status_code == 422
    assert api.patch("/api/v1/documents/1", headers=headers, json={"description": "x" * 501}).status_code == 422


# ---------------------------------------------------------------- Đánh giá Hữu ích / Không hữu ích
def test_review_vote_create_update_duplicate_and_validation(client):
    api, _ = client
    voter = login_headers(api, STUDENT_B)
    created = api.post("/api/v1/documents/1/reviews", headers=voter, json={"rating": 1, "content": "Useful"})
    assert created.status_code == 200
    data = created.json()["data"]
    assert data["helpfulCount"] == 1 and data["notHelpfulCount"] == 0 and data["reviewCount"] == 1
    assert data["helpfulRatio"] == 1.0
    assert data["trust"]["code"] == "INSUFFICIENT"      # mới 1 lượt, chưa đủ 5

    assert api.post("/api/v1/documents/1/reviews", headers=voter, json={"rating": 0}).status_code == 409
    assert api.post("/api/v1/documents/1/reviews", headers=voter, json={"rating": 5}).status_code == 422
    assert api.post("/api/v1/documents/1/reviews", headers=voter, json={"rating": -1}).status_code == 422

    review_id = api.get("/api/v1/documents/1/reviews").json()["data"][0]["id"]
    updated = api.patch(f"/api/v1/reviews/{review_id}", headers=voter, json={"rating": 0})
    assert updated.status_code == 200
    assert updated.json()["data"]["helpfulCount"] == 0
    assert updated.json()["data"]["notHelpfulCount"] == 1
    assert api.patch(f"/api/v1/reviews/{review_id}", headers=voter, json={"rating": 3}).status_code == 422
    assert api.get("/api/v1/documents/1", headers=voter).json()["data"]["myRating"] == 0


def test_uploader_cannot_review_own_document(client):
    api, _ = client
    response = api.post("/api/v1/documents/1/reviews", headers=login_headers(api, STUDENT_A), json={"rating": 1})
    assert response.status_code == 403


def test_trust_label_thresholds():
    from app.documents.service import vote_stats

    assert vote_stats(0, 0)["helpfulRatio"] is None
    assert vote_stats(0, 0)["trust"]["code"] == "INSUFFICIENT"
    assert vote_stats(4, 4)["trust"]["code"] == "INSUFFICIENT"   # dưới 5 lượt
    assert vote_stats(4, 5)["trust"]["code"] == "HIGH"           # 80%
    assert vote_stats(3, 5)["trust"]["code"] == "MEDIUM"         # 60%
    assert vote_stats(5, 10)["trust"]["code"] == "MEDIUM"        # đúng 50%
    assert vote_stats(2, 5)["trust"]["code"] == "LOW"            # 40%
    assert vote_stats(2, 5)["notHelpfulCount"] == 3
    assert vote_stats(1, 3)["helpfulRatio"] == 0.3333


def test_helpful_sort_uses_smoothed_ratio_and_filter_by_percent(client):
    api, ids = client
    with ids["session_factory"]() as db:
        uploader = db.scalar(select(User.id).where(User.student_id == STUDENT_A[0]))
        voter_b = db.scalar(select(User.id).where(User.student_id == STUDENT_B[0]))
        category = db.scalar(select(DocumentCategory.id))
        second = Document(title="Second exam", uploader_id=uploader, major_id=ids["major"], course_id=ids["course"],
                          category_id=category, status="APPROVED", external_url="https://onedrive.live.com/x",
                          storage_source="OneDrive")
        db.add(second)
        db.flush()
        extra = [User(student_id=f"U{i}", full_name=f"User {i}", password_hash="x", role="STUDENT",
                      status="ACTIVE", force_password_change=False) for i in range(5)]
        db.add_all(extra)
        db.flush()
        # Tài liệu 1: 1/1 hữu ích (100%, nhưng chỉ 1 lượt)
        db.add(Review(document_id=1, user_id=voter_b, rating=1))
        # Tài liệu "Second exam": 4/5 hữu ích (80%, đủ 5 lượt)
        for i, user in enumerate(extra):
            db.add(Review(document_id=second.id, user_id=user.id, rating=0 if i == 4 else 1))
        db.commit()

    result = api.get("/api/v1/documents", params={"sort": "helpful"}).json()
    assert [d["title"] for d in result["data"]] == ["Second exam", "Data structures exam"]
    assert result["data"][0]["helpfulCount"] == 4
    assert result["data"][0]["helpfulRatio"] == 0.8
    assert result["data"][0]["trust"]["code"] == "HIGH"
    assert result["data"][1]["trust"]["code"] == "INSUFFICIENT"

    only_perfect = api.get("/api/v1/documents", params={"minHelpfulPercent": 90}).json()
    assert only_perfect["totalElements"] == 1
    assert only_perfect["data"][0]["title"] == "Data structures exam"
    assert api.get("/api/v1/documents", params={"minHelpfulPercent": 80}).json()["totalElements"] == 2
    assert api.get("/api/v1/documents", params={"minHelpfulPercent": 101}).status_code == 422
    # Tên sort cũ vẫn dùng được trong thời gian frontend chưa sửa
    assert api.get("/api/v1/documents", params={"sort": "rating"}).status_code == 200
    assert api.get("/api/v1/documents", params={"sort": "downloads"}).status_code == 200


# ---------------------------------------------------------------- Admin, báo cáo, yêu thích
def test_admin_student_provisioning_and_catalog_relationship_reads(client):
    api, ids = client
    login = api.post("/api/v1/auth/login", json={"studentId": "ADMIN001", "password": "admin-password"}).json()
    headers = {"Authorization": f"Bearer {login['data']['accessToken']}"}
    created = api.post("/api/v1/admin/users", headers=headers, json={
        "studentId": "102230002", "fullName": "Student C", "email": "c@example.com", "majorId": ids["major"],
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


def test_report_submission_admin_resolution_and_duplicate_pending(client):
    api, _ = client
    student_headers = login_headers(api, STUDENT_A)
    payload = {"reason": "BROKEN_LINK", "description": "Liên kết không mở được"}
    created = api.post("/api/v1/documents/1/reports", headers=student_headers, json=payload)
    assert created.status_code == 200
    report_id = created.json()["data"]["id"]
    assert api.post("/api/v1/documents/1/reports", headers=student_headers, json=payload).status_code == 409
    assert api.post("/api/v1/documents/1/reports", headers=login_headers(api, STUDENT_B),
                    json={"reason": "NO_ACCESS"}).status_code == 200
    assert api.post("/api/v1/documents/1/reports", headers=student_headers,
                    json={"reason": "BROKEN_FILE"}).status_code == 422   # lý do cũ không còn hợp lệ

    admin_headers = login_headers(api, ADMIN)
    report = api.get("/api/v1/admin/reports", headers=admin_headers)
    assert report.status_code == 200
    assert report_id in [r["id"] for r in report.json()["data"]]
    details = api.get(f"/api/v1/admin/reports/{report_id}", headers=admin_headers)
    assert details.json()["data"]["document"]["id"] == 1
    updated = api.patch(f"/api/v1/admin/reports/{report_id}", headers=admin_headers, json={"status": "RESOLVED"})
    assert updated.status_code == 200
    assert updated.json()["data"]["status"] == "RESOLVED"


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
from datetime import date, datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, Enum, ForeignKey, ForeignKeyConstraint,
    Index, Integer, String, Table, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


major_courses = Table(
    "major_courses", Base.metadata,
    Column("major_id", ForeignKey("majors.id", ondelete="RESTRICT"), primary_key=True),
    Column("course_id", ForeignKey("courses.id", ondelete="RESTRICT"), primary_key=True),
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    major_id: Mapped[int | None] = mapped_column(ForeignKey("majors.id", ondelete="RESTRICT"), index=True)
    role: Mapped[str] = mapped_column(Enum("ADMIN", "STUDENT", name="user_role"), default="STUDENT")
    status: Mapped[str] = mapped_column(Enum("ACTIVE", "LOCKED", name="user_status"), default="ACTIVE")
    force_password_change: Mapped[bool] = mapped_column(Boolean, default=False)


class Faculty(Base):
    __tablename__ = "faculties"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Enum("ACTIVE", "INACTIVE", name="faculty_status"), default="ACTIVE")


class Major(Base):
    __tablename__ = "majors"
    __table_args__ = (UniqueConstraint("faculty_id", "code", name="uq_major_faculty_code"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculties.id", ondelete="RESTRICT"), index=True)
    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(Enum("ACTIVE", "INACTIVE", name="major_status"), default="ACTIVE")
    faculty: Mapped[Faculty] = relationship()


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    credits: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Enum("ACTIVE", "INACTIVE", name="course_status"), default="ACTIVE")
    majors: Mapped[list[Major]] = relationship(secondary=major_courses, backref="courses")


class Lecturer(Base):
    __tablename__ = "lecturers"
    id: Mapped[int] = mapped_column(primary_key=True)
    lecturer_code: Mapped[str] = mapped_column(String(32), unique=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculties.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(Enum("ACTIVE", "INACTIVE", name="lecturer_status"), default="ACTIVE")
    faculty: Mapped[Faculty] = relationship()


class AcademicTerm(Base):
    __tablename__ = "academic_terms"
    __table_args__ = (CheckConstraint("end_date >= start_date", name="ck_term_date_range"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Enum("ACTIVE", "INACTIVE", name="term_status"), default="ACTIVE")


class CourseOffering(Base):
    __tablename__ = "course_offerings"
    __table_args__ = (
        UniqueConstraint("id", "course_id", name="uq_offering_id_course"),
        UniqueConstraint("course_id", "lecturer_id", "term_id", "class_code", name="uq_offering_class"),
        Index("ix_offering_course_term", "course_id", "term_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"))
    lecturer_id: Mapped[int] = mapped_column(ForeignKey("lecturers.id", ondelete="RESTRICT"))
    term_id: Mapped[int] = mapped_column(ForeignKey("academic_terms.id", ondelete="RESTRICT"))
    class_code: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    course: Mapped[Course] = relationship()
    lecturer: Mapped[Lecturer] = relationship()
    term: Mapped[AcademicTerm] = relationship()


class DocumentCategory(Base):
    __tablename__ = "document_categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(100))


class Document(TimestampMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        ForeignKeyConstraint(["major_id", "course_id"], ["major_courses.major_id", "major_courses.course_id"], name="fk_document_major_course"),
        ForeignKeyConstraint(["course_offering_id", "course_id"], ["course_offerings.id", "course_offerings.course_id"], name="fk_document_offering_course"),
        Index("ix_document_status_created", "status", "created_at"),
        Index("ix_document_major", "major_id"),
        Index("ix_document_course", "course_id"),
        Index("ix_document_category", "category_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    major_id: Mapped[int] = mapped_column(ForeignKey("majors.id", ondelete="RESTRICT"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"))
    course_offering_id: Mapped[int | None] = mapped_column(Integer)
    category_id: Mapped[int] = mapped_column(ForeignKey("document_categories.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(Enum("PENDING", "APPROVED", "REJECTED", "HIDDEN", name="document_status"), default="PENDING")
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    original_file_name: Mapped[str] = mapped_column(String(255))
    stored_file_name: Mapped[str] = mapped_column(String(100))
    storage_key: Mapped[str] = mapped_column(String(255), unique=True)
    file_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    download_count: Mapped[int] = mapped_column(Integer, default=0)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    uploader: Mapped[User] = relationship()
    major: Mapped[Major] = relationship()
    course: Mapped[Course] = relationship()
    offering: Mapped[CourseOffering | None] = relationship(
        primaryjoin="and_(Document.course_offering_id == CourseOffering.id, Document.course_id == CourseOffering.course_id)",
        viewonly=True,
    )
    category: Mapped[DocumentCategory] = relationship()


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("document_id", "user_id", name="uq_review_document_user"), CheckConstraint("rating >= 1 AND rating <= 5"))
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="RESTRICT"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    rating: Mapped[int] = mapped_column(Integer)
    content: Mapped[str | None] = mapped_column(Text)
    user: Mapped[User] = relationship()


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_favorite_user_document"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DownloadLog(Base):
    __tablename__ = "download_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="RESTRICT"))
    downloaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ModerationLog(Base):
    __tablename__ = "moderation_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="RESTRICT"))
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DocumentReport(Base):
    __tablename__ = "document_reports"
    __table_args__ = (
        Index("ix_report_status_created", "status", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="RESTRICT"), index=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    reason: Mapped[str] = mapped_column(String(40))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Enum("PENDING", "RESOLVED", "REJECTED", name="report_status"), default="PENDING")
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    document: Mapped[Document] = relationship()
    reporter: Mapped[User] = relationship(foreign_keys=[reporter_id])
    admin: Mapped[User | None] = relationship(foreign_keys=[admin_id])

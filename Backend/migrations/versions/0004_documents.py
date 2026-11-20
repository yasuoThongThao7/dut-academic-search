"""Create categories and documents; seed supported document categories."""
from alembic import op
from sqlalchemy import insert

from app.core.database import Base
from app.models import entities

revision = "0004_documents"
down_revision = "0003_course_offerings"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for name in ("document_categories", "documents"):
        Base.metadata.tables[name].create(bind=bind)
    categories = [
        {"code": "EXAM", "name": "Đề thi"},
        {"code": "REPORT", "name": "Báo cáo"},
        {"code": "SLIDE", "name": "Slide"},
        {"code": "LECTURE_NOTE", "name": "Bài giảng"},
        {"code": "ASSIGNMENT", "name": "Bài tập"},
        {"code": "PROJECT", "name": "Đồ án"},
        {"code": "OTHER", "name": "Khác"},
    ]
    table = Base.metadata.tables["document_categories"]
    bind.execute(insert(table), categories)


def downgrade():
    bind = op.get_bind()
    Base.metadata.tables["documents"].drop(bind=bind)
    Base.metadata.tables["document_categories"].drop(bind=bind)

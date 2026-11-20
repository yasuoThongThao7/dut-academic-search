"""Create lecturers, academic terms, and course offerings."""
from alembic import op

from app.core.database import Base
from app.models import entities

revision = "0003_course_offerings"
down_revision = "0002_courses"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for name in ("lecturers", "academic_terms", "course_offerings"):
        Base.metadata.tables[name].create(bind=bind)


def downgrade():
    bind = op.get_bind()
    for name in ("course_offerings", "academic_terms", "lecturers"):
        Base.metadata.tables[name].drop(bind=bind)

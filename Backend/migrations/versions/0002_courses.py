"""Create courses and major-course mappings."""
from alembic import op

from app.core.database import Base
from app.models import entities

revision = "0002_courses"
down_revision = "0001_training_users"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for name in ("courses", "major_courses"):
        Base.metadata.tables[name].create(bind=bind)


def downgrade():
    bind = op.get_bind()
    for name in ("major_courses", "courses"):
        Base.metadata.tables[name].drop(bind=bind)

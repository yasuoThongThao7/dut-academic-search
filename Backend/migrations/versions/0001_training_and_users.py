"""Create faculties, majors, and users."""
from alembic import op

from app.core.database import Base
from app.models import entities

revision = "0001_training_users"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for name in ("faculties", "majors", "users"):
        Base.metadata.tables[name].create(bind=bind)


def downgrade():
    bind = op.get_bind()
    for name in ("users", "majors", "faculties"):
        Base.metadata.tables[name].drop(bind=bind)

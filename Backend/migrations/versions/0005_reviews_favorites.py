"""Create review, favorites, and download log tables."""
from alembic import op

from app.core.database import Base
from app.models import entities

revision = "0005_user_activity"
down_revision = "0004_documents"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for name in ("reviews", "favorites", "download_logs"):
        Base.metadata.tables[name].create(bind=bind)


def downgrade():
    bind = op.get_bind()
    for name in ("download_logs", "favorites", "reviews"):
        Base.metadata.tables[name].drop(bind=bind)

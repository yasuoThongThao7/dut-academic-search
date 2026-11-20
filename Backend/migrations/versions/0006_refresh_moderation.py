"""Create refresh token and moderation audit tables."""
from alembic import op

from app.core.database import Base
from app.models import entities

revision = "0006_refresh_moderation"
down_revision = "0005_user_activity"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for name in ("refresh_tokens", "moderation_logs"):
        Base.metadata.tables[name].create(bind=bind)


def downgrade():
    bind = op.get_bind()
    for name in ("moderation_logs", "refresh_tokens"):
        Base.metadata.tables[name].drop(bind=bind)

"""Add document reports."""
from alembic import op

from app.core.database import Base
from app.models import entities

revision = "0007_document_reports"
down_revision = "0006_refresh_moderation"
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.tables["document_reports"].create(bind=op.get_bind())


def downgrade():
    Base.metadata.tables["document_reports"].drop(bind=op.get_bind())

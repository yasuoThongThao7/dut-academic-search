"""external link and helpful votes

Revision ID: 0008_external_link_votes
Revises: 0007_document_reports
Create Date: 2026-11-21 11:56:17.380210
"""
from alembic import op
import sqlalchemy as sa


revision = '0008_external_link_votes'
down_revision = '0007_document_reports'
branch_labels = None
depends_on = None


"""Chuyển sang liên kết ngoài + đánh giá Hữu ích/Không hữu ích.

Dán phần import + upgrade/downgrade này vào file do `alembic revision -m "..."` tạo ra
(giữ nguyên revision / down_revision mà Alembic đã sinh).

Migration an toàn khi DB đã chạy SQL của Gemini: cột nào có rồi thì bỏ qua.
"""
import sqlalchemy as sa
from alembic import op


def _columns(bind, table):
    return {c["name"] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    is_mysql = bind.dialect.name == "mysql"

    # 1) documents: thêm cột liên kết ngoài (bỏ qua cột đã có)
    existing = _columns(bind, "documents")
    with op.batch_alter_table("documents") as batch:
        if "external_url" not in existing:
            batch.add_column(sa.Column("external_url", sa.String(1000), nullable=True))
        if "storage_source" not in existing:
            batch.add_column(sa.Column("storage_source", sa.String(100), nullable=True))
        if "access_note" not in existing:
            batch.add_column(sa.Column("access_note", sa.String(255), nullable=True))
        if "is_share_confirmed" not in existing:
            batch.add_column(sa.Column("is_share_confirmed", sa.Boolean(), nullable=False, server_default="1"))
        # các cột file cũ chuyển sang cho phép NULL
        batch.alter_column("original_file_name", existing_type=sa.String(255), nullable=True)
        batch.alter_column("stored_file_name", existing_type=sa.String(100), nullable=True)
        batch.alter_column("storage_key", existing_type=sa.String(255), nullable=True)
        batch.alter_column("file_type", existing_type=sa.String(100), nullable=True)
        batch.alter_column("file_size", existing_type=sa.Integer(), nullable=True)

    # 2) reviews: rating chuyển từ 1-5 sao sang 1 (Hữu ích) / 0 (Không hữu ích)
    if is_mysql:
        # Kiểm tra TRƯỚC khi sửa gì, để lỗi không xảy ra sau bước đổi dữ liệu (bước đó không được chạy lại).
        null_count = bind.execute(sa.text("SELECT COUNT(*) FROM reviews WHERE rating IS NULL")).scalar()
        if null_count:
            raise RuntimeError(
                f"Còn {null_count} đánh giá có rating NULL. Hãy xử lý (xoá hoặc gán 0/1) rồi chạy lại migration."
            )
        old_checks = bind.execute(sa.text(
            "SELECT tc.CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS tc "
            "JOIN information_schema.CHECK_CONSTRAINTS cc "
            "  ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME "
            "WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'reviews' "
            "  AND tc.CONSTRAINT_TYPE = 'CHECK' AND cc.CHECK_CLAUSE LIKE '%rating%'"
        )).scalars().all()
        for name in old_checks:
            op.execute(f"ALTER TABLE reviews DROP CHECK `{name}`")

        # Đánh giá cũ: 4-5 sao => Hữu ích (1), 1-3 sao => Không hữu ích (0). CHỈ CHẠY MỘT LẦN.
        op.execute("UPDATE reviews SET rating = CASE WHEN rating >= 4 THEN 1 ELSE 0 END WHERE rating IS NOT NULL")
        op.alter_column("reviews", "rating", existing_type=sa.Integer(), nullable=False)
        op.execute("ALTER TABLE reviews ADD CONSTRAINT ck_review_rating CHECK (rating IN (0, 1))")

    # 3) Phương án A không dùng bảng document_votes (nếu Gemini đã tạo thì xoá)
    op.execute("DROP TABLE IF EXISTS document_votes")


def downgrade() -> None:
    raise NotImplementedError(
        "Không hỗ trợ downgrade: đổi 1-5 sao sang 0/1 làm mất dữ liệu gốc. Hãy khôi phục từ bản sao lưu."
    )

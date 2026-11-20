import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.exceptions import AppError
from app.core.security import hash_password
from app.models.entities import User


def main() -> None:
    student_id = settings.bootstrap_admin_student_id
    password = settings.bootstrap_admin_password
    if not student_id or not password or len(password) < 12:
        raise SystemExit("Set BOOTSTRAP_ADMIN_STUDENT_ID and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.")
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.student_id == student_id))
        if existing:
            raise SystemExit("The configured MSSV already exists; no account was changed.")
        admin = User(student_id=student_id, full_name="DUT Administrator", password_hash=hash_password(password),
                     role="ADMIN", status="ACTIVE", force_password_change=True)
        db.add(admin)
        db.commit()
        print(f"Created administrator account for MSSV {student_id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

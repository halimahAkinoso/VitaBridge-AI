import os

from pydantic import EmailStr, TypeAdapter

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import User


def main():
    name = os.getenv("INITIAL_ADMIN_NAME", "").strip()
    raw_email = os.getenv("INITIAL_ADMIN_EMAIL", "").strip()
    password = os.getenv("INITIAL_ADMIN_PASSWORD", "")
    configured_values = (name, raw_email, password)

    if not any(configured_values):
        return
    if not all(configured_values):
        raise RuntimeError(
            "Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and "
            "INITIAL_ADMIN_PASSWORD together."
        )
    if len(name) < 2 or not 12 <= len(password) <= 128:
        raise RuntimeError(
            "The initial administrator name or password does not meet requirements."
        )

    email = str(TypeAdapter(EmailStr).validate_python(raw_email)).lower()
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(User).filter(User.role == "admin").first():
            return
        if db.query(User).filter(User.email == email).first():
            raise RuntimeError(
                "INITIAL_ADMIN_EMAIL already belongs to a non-administrator account."
            )

        db.add(
            User(
                name=name,
                email=email,
                role="admin",
                password_hash=hash_password(password),
                language="en",
                is_active=True,
            )
        )
        db.commit()
        print("Initial demo administrator created.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

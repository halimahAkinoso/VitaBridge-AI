from getpass import getpass
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User

db = SessionLocal()
try:
    if db.query(User).filter(User.role == "admin").first():
        print("Administrator already exists.")
    else:
        name = input("Administrator name: ").strip()
        email = input("Administrator email: ").strip().lower()
        password = getpass("Password (minimum 12 characters): ")
        confirm = getpass("Confirm password: ")

        if len(name) < 2 or len(password) < 12 or password != confirm:
            print("Invalid name or password.")
        elif db.query(User).filter(User.email == email).first():
            print("Email already exists.")
        else:
            db.add(User(name=name, email=email, role="admin",
                        password_hash=hash_password(password),
                        language="en", is_active=True))
            db.commit()
            print("ADMINISTRATOR CREATED SUCCESSFULLY.")
finally:
    db.close()

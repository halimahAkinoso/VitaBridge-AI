
from getpass import getpass

from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models import User

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    if db.query(User).filter(User.role == "admin").first():
        print("An administrator already exists.")
    else:
        name = input("Administrator name: ").strip()
        email = input("Administrator email: ").strip().lower()

        password = getpass("Password (minimum 12 characters): ")
        confirmation = getpass("Confirm password: ")

        if len(name) < 2:
            print("Name must contain at least 2 characters.")
        elif len(password) < 12 or password != confirmation:
            print("Password is too short or the passwords do not match.")
        elif db.query(User).filter(User.email == email).first():
            print("This email already belongs to an account.")
        else:
            admin = User(
                name=name,
                email=email,
                role="admin",
                password_hash=hash_password(password),
                language="en",
                is_active=True,
            )

            db.add(admin)
            db.commit()

            print("\nAdministrator created successfully.")
            print("Role: admin")
            print("You can now sign in through Practitioner Access.")

except Exception as error:
    db.rollback()
    print(f"Setup failed: {error}")

finally:
    db.close()

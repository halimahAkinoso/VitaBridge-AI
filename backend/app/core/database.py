from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os

APP_ENV = os.getenv("APP_ENV", "development").lower()
configured_database_url = os.getenv("DATABASE_URL")
if APP_ENV in {"demo", "production"} and not configured_database_url:
    raise RuntimeError("DATABASE_URL must be configured outside development.")

DATABASE_URL = configured_database_url or "sqlite:///./vitabridge.db"
engine=create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal=sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base=declarative_base()
def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()


def ensure_screening_submission_id():
    if "screenings" not in inspect(engine).get_table_names():
        return

    column_names = {
        column["name"]
        for column in inspect(engine).get_columns("screenings")
    }

    if "submission_id" not in column_names:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE screenings ADD COLUMN submission_id VARCHAR(64)")
            )

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "ix_screenings_submission_id ON screenings (submission_id)"
            )
        )

"""Merge accounts and linked records from vitabridge_secure.db into vitabridge.db."""
import sqlite3
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
TARGET_PATH = BACKEND_DIR / "vitabridge.db"
SOURCE_PATH = BACKEND_DIR / "vitabridge_secure.db"

MIGRATION_COLUMNS = {
    "screenings": {
        "clinician_note": "TEXT",
        "clinician_id": "INTEGER",
        "reviewed_at": "TIMESTAMP",
        "review_decision": "VARCHAR(30)",
    },
    "referrals": {
        "screening_id": "INTEGER",
        "updated_at": "TIMESTAMP",
    },
}


def quoted(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def table_columns(connection: sqlite3.Connection, table: str, schema: str = "main"):
    return [
        row[1]
        for row in connection.execute(
            f"PRAGMA {schema}.table_info({quoted(table)})"
        )
    ]


def merge():
    if not TARGET_PATH.is_file() or not SOURCE_PATH.is_file():
        raise FileNotFoundError("Both VitaBridge database files must exist.")

    connection = sqlite3.connect(TARGET_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 30000")
    connection.execute("ATTACH DATABASE ? AS legacy", (str(SOURCE_PATH),))

    imported = {table: 0 for table in ("users", "persons", "screenings", "referrals", "notifications")}
    skipped_conflicts = 0

    try:
        connection.execute("BEGIN IMMEDIATE")

        for table, columns in MIGRATION_COLUMNS.items():
            target_columns = set(table_columns(connection, table))
            for name, sql_type in columns.items():
                if name not in target_columns:
                    connection.execute(
                        f"ALTER TABLE {quoted(table)} "
                        f"ADD COLUMN {quoted(name)} {sql_type}"
                    )

        existing_users = {
            row["email"].strip().lower(): row["id"]
            for row in connection.execute("SELECT id, email FROM users")
        }
        user_ids = {}

        for source_user in connection.execute(
            "SELECT * FROM legacy.users ORDER BY id"
        ):
            email_key = source_user["email"].strip().lower()
            if email_key in existing_users:
                skipped_conflicts += 1
                continue

            columns = [
                column
                for column in table_columns(connection, "users")
                if column != "id" and column in source_user.keys()
            ]
            values = [source_user[column] for column in columns]
            cursor = connection.execute(
                f"INSERT INTO users ({', '.join(quoted(c) for c in columns)}) "
                f"VALUES ({', '.join('?' for _ in columns)})",
                values,
            )
            user_ids[source_user["id"]] = cursor.lastrowid
            existing_users[email_key] = cursor.lastrowid
            imported["users"] += 1

        person_ids = {}
        for source_person in connection.execute(
            "SELECT * FROM legacy.persons ORDER BY id"
        ):
            owner_id = user_ids.get(source_person["owner_id"])
            if owner_id is None:
                continue

            columns = [
                column
                for column in table_columns(connection, "persons")
                if column != "id" and column in source_person.keys()
            ]
            values = [
                owner_id if column == "owner_id" else source_person[column]
                for column in columns
            ]
            cursor = connection.execute(
                f"INSERT INTO persons ({', '.join(quoted(c) for c in columns)}) "
                f"VALUES ({', '.join('?' for _ in columns)})",
                values,
            )
            person_ids[source_person["id"]] = cursor.lastrowid
            imported["persons"] += 1

        screening_ids = {}
        for source_screening in connection.execute(
            "SELECT * FROM legacy.screenings ORDER BY id"
        ):
            person_id = person_ids.get(source_screening["person_id"])
            if person_id is None:
                continue

            columns = [
                column
                for column in table_columns(connection, "screenings")
                if column != "id" and column in source_screening.keys()
            ]
            values = []
            for column in columns:
                value = source_screening[column]
                if column == "person_id":
                    value = person_id
                elif column == "clinician_id" and value is not None:
                    value = user_ids.get(value)
                    if value is None:
                        raise ValueError(
                            "A legacy screening references a user that was not imported."
                        )
                values.append(value)
            cursor = connection.execute(
                f"INSERT INTO screenings ({', '.join(quoted(c) for c in columns)}) "
                f"VALUES ({', '.join('?' for _ in columns)})",
                values,
            )
            screening_ids[source_screening["id"]] = cursor.lastrowid
            imported["screenings"] += 1

        for source_referral in connection.execute(
            "SELECT * FROM legacy.referrals ORDER BY id"
        ):
            person_id = person_ids.get(source_referral["person_id"])
            if person_id is None:
                continue

            columns = [
                column
                for column in table_columns(connection, "referrals")
                if column != "id" and column in source_referral.keys()
            ]
            values = []
            for column in columns:
                value = source_referral[column]
                if column == "person_id":
                    value = person_id
                elif column == "screening_id" and value is not None:
                    value = screening_ids.get(value)
                    if value is None:
                        raise ValueError(
                            "A legacy referral references a screening that was not imported."
                        )
                values.append(value)
            connection.execute(
                f"INSERT INTO referrals ({', '.join(quoted(c) for c in columns)}) "
                f"VALUES ({', '.join('?' for _ in columns)})",
                values,
            )
            imported["referrals"] += 1

        for source_notification in connection.execute(
            "SELECT * FROM legacy.notifications ORDER BY id"
        ):
            person_id = person_ids.get(source_notification["person_id"])
            if person_id is None:
                continue

            columns = [
                column
                for column in table_columns(connection, "notifications")
                if column != "id" and column in source_notification.keys()
            ]
            values = [
                person_id if column == "person_id" else source_notification[column]
                for column in columns
            ]
            connection.execute(
                f"INSERT INTO notifications ({', '.join(quoted(c) for c in columns)}) "
                f"VALUES ({', '.join('?' for _ in columns)})",
                values,
            )
            imported["notifications"] += 1

        violations = connection.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise RuntimeError(
                f"Merge would leave {len(violations)} foreign-key violation(s)."
            )

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print("Imported:", ", ".join(f"{key}={value}" for key, value in imported.items()))
    print(f"Skipped duplicate-email conflicts: {skipped_conflicts}")


if __name__ == "__main__":
    merge()

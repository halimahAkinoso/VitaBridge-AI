from datetime import date

from fastapi.testclient import TestClient
from argon2 import PasswordHasher

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models import Person, Screening, User


client = TestClient(app)
PASSWORD = "Synthetic-Password-123"


def test_login_roles_and_session_restore():
    adult = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Adult",
            "email": "adult.login@example.com",
            "password": PASSWORD,
            "role": "adult",
        },
    )
    assert adult.status_code == 201, adult.text

    login = client.post(
        "/api/auth/login",
        json={
            "email": "ADULT.LOGIN@EXAMPLE.COM",
            "password": PASSWORD,
        },
    )
    assert login.status_code == 200, login.text
    token = login.json()["token"]
    assert login.json()["user"]["role"] == "adult"

    me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "adult.login@example.com"
    assert me.json()["role"] == "adult"
    assert client.get(
        "/api/screening/instruments",
        headers={"Authorization": f"Bearer {token}"},
    ).status_code == 200


def test_login_rejects_bad_password_and_missing_token():
    response = client.post(
        "/api/auth/login",
        json={
            "email": "adult.login@example.com",
            "password": "incorrect-password",
        },
    )
    assert response.status_code == 401

    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_parent_and_practitioner_accounts_can_sign_in():
    parent = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Parent",
            "email": "parent.login@example.com",
            "password": PASSWORD,
            "role": "parent",
        },
    )
    assert parent.status_code == 201, parent.text
    parent_login = client.post(
        "/api/auth/login",
        json={"email": "parent.login@example.com", "password": PASSWORD},
    )
    assert parent_login.status_code == 200
    assert parent_login.json()["user"]["role"] == "parent"
    parent_token = parent_login.json()["token"]

    instruments = client.get(
        "/api/screening/instruments",
        headers={"Authorization": f"Bearer {parent_token}"},
    )
    assert instruments.status_code == 200, instruments.text
    assert any(
        item["code"] == "vitabridge_surveillance"
        and item["available"]
        for item in instruments.json()["instruments"]
    )

    db = SessionLocal()
    try:
        db.add(
            User(
                name="Synthetic Administrator",
                email="admin.login@example.com",
                role="admin",
                password_hash=hash_password(PASSWORD),
            )
        )
        db.commit()
    finally:
        db.close()

    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin.login@example.com", "password": PASSWORD},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["token"]

    created = client.post(
        "/api/auth/admin/create-doctor",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Synthetic Doctor",
            "email": "doctor.login@example.com",
            "password": PASSWORD,
        },
    )
    assert created.status_code == 201, created.text

    doctor_login = client.post(
        "/api/auth/login",
        json={"email": "doctor.login@example.com", "password": PASSWORD},
    )
    assert doctor_login.status_code == 200
    assert doctor_login.json()["user"]["role"] == "doctor"


def test_legacy_argon2_password_upgrades_after_login():
    password = "Synthetic-Legacy-Password-123"
    db = SessionLocal()
    try:
        user = User(
            name="Synthetic Legacy Account",
            email="legacy.login@example.com",
            role="adult",
            password_hash=PasswordHasher().hash(password),
        )
        db.add(user)
        db.commit()
        user_id = user.id
    finally:
        db.close()

    response = client.post(
        "/api/auth/login",
        json={"email": "legacy.login@example.com", "password": password},
    )
    assert response.status_code == 200, response.text

    db = SessionLocal()
    try:
        upgraded = db.query(User).filter(User.id == user_id).one()
        assert upgraded.password_hash.startswith("pbkdf2_sha256$")
    finally:
        db.close()


def test_child_observation_submission_is_idempotent():
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Observation Parent",
            "email": "observation.parent@example.com",
            "password": PASSWORD,
            "role": "parent",
        },
    )
    assert registration.status_code == 201, registration.text
    user_id = registration.json()["user"]["id"]

    child_dob = date(date.today().year - 2, 1, 1).isoformat()
    db = SessionLocal()
    try:
        db.add(
            Person(
                owner_id=user_id,
                name="Synthetic Child",
                dob=child_dob,
                type="child",
                sex="Female",
            )
        )
        db.commit()
    finally:
        db.close()

    token = registration.json()["token"]
    payload = {
        "answers": {"social_1": "Yes"},
        "submission_id": "synthetic-child-observation-1",
    }
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post("/api/screening/child", json=payload, headers=headers)
    retry = client.post("/api/screening/child", json=payload, headers=headers)
    assert first.status_code == 200, first.text
    assert retry.status_code == 200, retry.text
    assert retry.json()["screening"]["id"] == first.json()["screening"]["id"]

    conflict = client.post(
        "/api/screening/child",
        json={
            **payload,
            "answers": {"social_1": "Sometimes"},
        },
        headers=headers,
    )
    assert conflict.status_code == 409

    db = SessionLocal()
    try:
        assert (
            db.query(Screening)
            .filter(Screening.submission_id == payload["submission_id"])
            .count()
            == 1
        )
    finally:
        db.close()


def test_adult_profile_accepts_arabic_without_default_nationality():
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Abu Dhabi Adult",
            "email": "adult.arabic@example.com",
            "password": PASSWORD,
            "role": "adult",
        },
    )
    assert registration.status_code == 201, registration.text

    birth_date = date(date.today().year - 60, 1, 1).isoformat()
    response = client.put(
        "/api/screening/adult/profile",
        headers={
            "Authorization": f"Bearer {registration.json()['token']}",
        },
        json={
            "name": "Synthetic Abu Dhabi Adult",
            "dob": birth_date,
            "sex": "Female",
            "language": "ar",
            "education": "Tertiary education",
            "culture": "Synthetic background",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["profile"]["language"] == "ar"
    assert response.json()["profile"]["nationality"] is None

    response = client.put(
        "/api/screening/adult/profile",
        headers={
            "Authorization": f"Bearer {registration.json()['token']}",
        },
        json={
            "name": "Synthetic Abu Dhabi Adult",
            "dob": birth_date,
            "sex": "Female",
            "language": "en",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["profile"]["education"] == "Tertiary education"
    assert response.json()["profile"]["culture"] == "Synthetic background"

    unsupported_language = client.put(
        "/api/screening/adult/profile",
        headers={
            "Authorization": f"Bearer {registration.json()['token']}",
        },
        json={
            "name": "Synthetic Abu Dhabi Adult",
            "dob": birth_date,
            "sex": "Female",
            "language": "fr",
        },
    )
    assert unsupported_language.status_code == 422


def test_adult_history_includes_saved_baseline_and_hearing_vision():
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic History Adult",
            "email": "adult.history@example.com",
            "password": PASSWORD,
            "role": "adult",
        },
    )
    assert registration.status_code == 201, registration.text
    headers = {
        "Authorization": f"Bearer {registration.json()['token']}",
    }

    profile = client.put(
        "/api/screening/adult/profile",
        headers=headers,
        json={
            "name": "Synthetic History Adult",
            "dob": date(date.today().year - 60, 1, 1).isoformat(),
            "sex": "Prefer not to say",
            "language": "en",
        },
    )
    assert profile.status_code == 200, profile.text

    baseline = client.post(
        "/api/screening/adult/baseline",
        headers=headers,
        json={
            "health_conditions": ["None of the above"],
            "blood_pressure_history": "Normal",
            "sleep_quality": "Good",
            "physical_activity": "Moderately active",
            "social_engagement": "Often",
            "mood": "Good",
            "memory_concerns": "No concerns",
        },
    )
    assert baseline.status_code == 200, baseline.text

    hearing_vision = client.post(
        "/api/screening/adult/hearing-vision",
        headers=headers,
        json={
            "responses": {
                "hearing_difficulty": "Never",
                "vision_difficulty": "Sometimes",
            },
            "completed_at": "2026-01-02T03:04:05Z",
        },
    )
    assert hearing_vision.status_code == 200, hearing_vision.text

    repeated_hearing_vision = client.post(
        "/api/screening/adult/hearing-vision",
        headers=headers,
        json={
            "responses": {
                "hearing_difficulty": "Often",
                "vision_difficulty": "Never",
            },
            "completed_at": "2026-02-03T04:05:06Z",
        },
    )
    assert repeated_hearing_vision.status_code == 200, repeated_hearing_vision.text

    history = client.get(
        "/api/screening/adult/history",
        headers=headers,
    )
    assert history.status_code == 200, history.text
    data = history.json()
    assert data["assessment_count"] == 3
    assessments = {
        item["assessment"]: item
        for item in data["assessments"]
    }
    assert assessments["adult_health_assessment"]["completed_at"]
    assert assessments["adult_health_assessment"]["responses"][
        "sleep_quality"
    ] == "Good"
    hearing_history = [
        item
        for item in data["assessments"]
        if item["assessment"] == "adult_hearing_vision"
    ]
    assert len(hearing_history) == 2
    assert hearing_history[0]["completed_at"] == "2026-02-03T04:05:06Z"
    assert hearing_history[0]["responses"]["hearing_difficulty"] == "Often"
    assert hearing_history[1]["completed_at"] == "2026-01-02T03:04:05Z"
    assert hearing_history[1]["responses"]["vision_difficulty"] == "Sometimes"

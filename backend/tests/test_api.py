from datetime import date, datetime, timezone

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
            "systolic_bp_mmhg": 121,
            "diastolic_bp_mmhg": 79,
            "blood_glucose_mmol_l": 5.2,
            "cholesterol_mmol_l": 4.1,
            "weight_kg": 68.5,
            "sleep_quality": "Good",
            "sleep_hours": 7.5,
            "snoring": "Not sure",
            "physical_activity": "Moderately active",
            "social_engagement": "Often",
            "everyday_function": "No change",
            "mood": "Good",
            "memory_concerns": "No concerns",
            "family_history": "Not sure",
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
    assert assessments["adult_health_assessment"]["responses"][
        "blood_glucose_mmol_l"
    ] == 5.2
    assert "additional_notes" not in assessments["adult_health_assessment"]["responses"]
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


def test_adult_prevention_agent_uses_real_data_and_records_check_ins():
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Prevention Adult",
            "email": "adult.prevention@example.com",
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
            "name": "Synthetic Prevention Adult",
            "dob": date(date.today().year - 60, 1, 1).isoformat(),
            "sex": "Prefer not to say",
            "language": "en",
        },
    )
    assert profile.status_code == 200, profile.text

    overview = client.get("/api/agent/overview", headers=headers)
    assert overview.status_code == 200, overview.text
    data = overview.json()
    assert data["assessment_status"]["baseline"] == "not_started"
    assert data["assessment_status"]["cognitive"] == "approval_pending"
    assert data["cognitive_screening"]["available"] is False
    assert "no cognitive score" in data["cognitive_screening"]["message"].lower()
    assert len(data["prevention_plan"]) == 6
    assert data["next_best_action"]["route"] == "/adult/screening/baseline"

    empty_checkin = client.post(
        "/api/agent/check-in",
        headers=headers,
        json={},
    )
    assert empty_checkin.status_code == 422

    first = client.post(
        "/api/agent/check-in",
        headers=headers,
        json={"sleep_hours": 6.5, "mood_score": 3},
    )
    assert first.status_code == 200, first.text
    updated = client.post(
        "/api/agent/check-in",
        headers=headers,
        json={"mood_score": 4},
    )
    assert updated.status_code == 200, updated.text

    check_ins = client.get("/api/agent/check-ins", headers=headers)
    assert check_ins.status_code == 200, check_ins.text
    assert len(check_ins.json()["check_ins"]) == 1
    assert check_ins.json()["check_ins"][0]["sleep_hours"] == 6.5
    assert check_ins.json()["check_ins"][0]["mood_score"] == 4

    history = client.get(
        "/api/screening/adult/history",
        headers=headers,
    )
    assert history.status_code == 200, history.text
    assert any(
        item["assessment"] == "daily_checkin"
        for item in history.json()["assessments"]
    )

    cognitive_answer = client.post(
        "/api/agent/chat",
        headers=headers,
        json={"message": "What is my cognitive score?"},
    )
    assert cognitive_answer.status_code == 200, cognitive_answer.text
    assert "no approved cognitive screening result" in cognitive_answer.json()["reply"].lower()

    urgent_answer = client.post(
        "/api/agent/chat",
        headers=headers,
        json={"message": "I am worried about self-harm"},
    )
    assert urgent_answer.status_code == 200, urgent_answer.text
    assert urgent_answer.json()["urgent_human_support"] is True
    assert client.get("/api/agent/overview").status_code == 401


def test_passport_and_notifications_are_account_scoped():
    first = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Passport Adult",
            "email": "adult.passport@example.com",
            "password": PASSWORD,
            "role": "adult",
        },
    )
    second = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Other Adult",
            "email": "adult.passport.other@example.com",
            "password": PASSWORD,
            "role": "adult",
        },
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    token = first.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    profile = client.put(
        "/api/screening/adult/profile",
        headers=headers,
        json={
            "name": "Synthetic Passport Adult",
            "dob": date(date.today().year - 60, 1, 1).isoformat(),
            "sex": "Prefer not to say",
            "language": "en",
        },
    )
    assert profile.status_code == 200, profile.text
    person_id = profile.json()["profile"]["id"]

    passport = client.get(
        f"/api/passport/{person_id}",
        headers=headers,
    )
    assert passport.status_code == 200, passport.text
    assert passport.json()["member"]["name"] == "Synthetic Passport Adult"
    assert "Cognitive screening (approved instrument pending)" in passport.json()["member"]["due"]
    own_family = client.get(
        "/api/passport/family/me",
        headers=headers,
    )
    assert own_family.status_code == 200, own_family.text
    assert [member["name"] for member in own_family.json()["family"]] == [
        "Synthetic Passport Adult"
    ]

    notifications = client.get(
        f"/api/notifications/{person_id}",
        headers=headers,
    )
    assert notifications.status_code == 200, notifications.text
    assert any(
        item["id"] == "adult-baseline"
        for item in notifications.json()["notifications"]
    )

    other_owner_id = second.json()["user"]["id"]
    assert client.get(
        f"/api/passport/family/{other_owner_id}",
        headers=headers,
    ).status_code == 403
    assert client.get(
        f"/api/passport/{person_id}"
    ).status_code == 401
    other_headers = {
        "Authorization": f"Bearer {second.json()['token']}",
    }
    other_family = client.get(
        "/api/passport/family/me",
        headers=other_headers,
    )
    assert other_family.status_code == 200, other_family.text
    assert client.get(
        f"/api/passport/{person_id}",
        headers=other_headers,
    ).status_code == 404


def test_arabic_adult_profile_receives_nura_guidance_in_arabic():
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Arabic Adult",
            "email": "adult.nura.arabic@example.com",
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
            "name": "Synthetic Arabic Adult",
            "dob": date(date.today().year - 60, 1, 1).isoformat(),
            "sex": "Prefer not to say",
            "language": "ar",
        },
    )
    assert profile.status_code == 200, profile.text

    overview = client.get("/api/agent/overview", headers=headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["language"] == "ar"
    assert "أكمل" in overview.json()["next_best_action"]["detail"]

    answer = client.post(
        "/api/agent/chat",
        headers=headers,
        json={"message": "ما خطوتي التالية؟"},
    )
    assert answer.status_code == 200, answer.text
    assert "مرحباً" in answer.json()["reply"]

    urgent_answer = client.post(
        "/api/agent/chat",
        headers=headers,
        json={"message": "أفكر بالانتحار"},
    )
    assert urgent_answer.status_code == 200, urgent_answer.text
    assert urgent_answer.json()["urgent_human_support"] is True
    assert "خدمات الطوارئ" in urgent_answer.json()["reply"]


def test_adult_clinician_review_requires_clinician_and_creates_referral():
    registration = client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Review Adult",
            "email": "adult.review@example.com",
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
            "name": "Synthetic Review Adult",
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
            "health_conditions": ["Prefer not to say"],
            "blood_pressure_history": "Prefer not to say",
            "sleep_quality": "Poor",
            "physical_activity": "Lightly active",
            "social_engagement": "Sometimes",
            "mood": "Good",
            "memory_concerns": "Occasional forgetfulness",
        },
    )
    assert baseline.status_code == 200, baseline.text
    hearing_vision = client.post(
        "/api/screening/adult/hearing-vision",
        headers=headers,
        json={
            "responses": {
                "hearing_difficulty": "Often",
                "hearing_environment": "Often",
                "hearing_aid": "No",
                "vision_difficulty": "Never",
                "vision_reading": "Never",
                "vision_support": "No",
            },
        },
    )
    assert hearing_vision.status_code == 200, hearing_vision.text

    db = SessionLocal()
    try:
        clinician = User(
            name="Synthetic Clinician",
            email="clinician.adult.review@example.com",
            role="doctor",
            password_hash=hash_password(PASSWORD),
        )
        db.add(clinician)
        db.commit()
    finally:
        db.close()
    clinician_login = client.post(
        "/api/auth/login",
        json={
            "email": "clinician.adult.review@example.com",
            "password": PASSWORD,
        },
    )
    assert clinician_login.status_code == 200
    clinician_headers = {
        "Authorization": f"Bearer {clinician_login.json()['token']}",
    }
    person_id = profile.json()["profile"]["id"]

    assert client.get(
        "/api/screening/clinician/adult-queue",
        headers=headers,
    ).status_code == 403
    queue = client.get(
        "/api/screening/clinician/adult-queue",
        headers=clinician_headers,
    )
    assert queue.status_code == 200, queue.text
    assert any(item["person_id"] == person_id for item in queue.json()["adults"])

    pending_result = client.get("/api/agent/results", headers=headers)
    assert pending_result.status_code == 200, pending_result.text
    assert pending_result.json()["result"]["available"] is False
    assert pending_result.json()["result"]["status"] == "PENDING_REVIEW"

    review_payload = {
        "decision": "WATCH",
        "risk": "MODERATE",
        "note": "Synthetic clinician review note.",
        "next_action": "Discuss hearing follow-up with your care team.",
    }
    watch_review = client.post(
        f"/api/screening/clinician/adult-review/{person_id}",
        headers=clinician_headers,
        json=review_payload,
    )
    assert watch_review.status_code == 200, watch_review.text
    assert watch_review.json()["referral"] is None

    result = client.get("/api/agent/results", headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["result"]["status"] == "WATCH"
    assert result.json()["result"]["risk"] == "MODERATE"
    assert result.json()["result"]["source"] == "clinician_review"
    assert result.json()["reported_context"] == [
        "memory concerns",
        "poor sleep",
        "hearing difficulty",
    ]

    plan = client.get("/api/agent/plan", headers=headers)
    assert plan.status_code == 200, plan.text
    assert plan.json()["count"] == 1
    assert len(plan.json()["actions"]) == 1
    assert plan.json()["actions"][0]["detail"] == review_payload["next_action"]

    explanation = client.post(
        "/api/agent/chat",
        headers=headers,
        json={"message": "Explain my result"},
    )
    assert explanation.status_code == 200, explanation.text
    assert "status WATCH and risk MODERATE" in explanation.json()["reply"]
    assert review_payload["next_action"] in explanation.json()["reply"]
    assert "does not establish a cause" in explanation.json()["reply"]

    updated_hearing_vision = client.post(
        "/api/screening/adult/hearing-vision",
        headers=headers,
        json={
            "responses": {
                "hearing_difficulty": "Sometimes",
                "hearing_environment": "Sometimes",
                "hearing_aid": "No",
                "vision_difficulty": "Never",
                "vision_reading": "Never",
                "vision_support": "No",
            },
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert updated_hearing_vision.status_code == 200, updated_hearing_vision.text
    refreshed_result = client.get("/api/agent/results", headers=headers)
    assert refreshed_result.status_code == 200, refreshed_result.text
    assert refreshed_result.json()["result"]["status"] == "PENDING_REVIEW"
    assert refreshed_result.json()["result"]["risk"] == "NOT_ASSESSED"

    referral_payload = {
        **review_payload,
        "decision": "REFER",
        "next_action": "Contact the primary care team about this referral.",
    }
    missing_specialty = client.post(
        f"/api/screening/clinician/adult-review/{person_id}",
        headers=clinician_headers,
        json=referral_payload,
    )
    assert missing_specialty.status_code == 422

    review = client.post(
        f"/api/screening/clinician/adult-review/{person_id}",
        headers=clinician_headers,
        json={**referral_payload, "referral_specialty": "Primary Care"},
    )
    assert review.status_code == 200, review.text
    assert review.json()["review"]["risk"] == "MODERATE"
    assert review.json()["referral"]["status"] == "OPEN"

    history = client.get(
        "/api/screening/adult/history",
        headers=headers,
    )
    assert history.status_code == 200, history.text
    assert any(
        item["assessment"] == "adult_clinical_review"
        and item["responses"]["reviewed_by"] == "Synthetic Clinician"
        for item in history.json()["assessments"]
    )
    referrals = client.get("/api/screening/referrals", headers=headers)
    assert referrals.status_code == 200
    assert any(
        item["id"] == review.json()["referral"]["id"]
        for item in referrals.json()["referrals"]
    )

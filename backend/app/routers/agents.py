from datetime import date, datetime, timedelta, timezone
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (
    AdultClinicalReview,
    Person,
    Referral,
    Screening,
    User,
    WellbeingCheckIn,
)
from app.routers.users import get_current_user
from app.services.agent import build_nura_context
from app.services.clinical_question_planner import build_monitoring_plan
from app.services.safety import check_red_flags, safety_disclaimer

router = APIRouter()
logger = logging.getLogger(__name__)
ABU_DHABI = timezone(timedelta(hours=4), name="Asia/Abu_Dhabi")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class CheckInRequest(BaseModel):
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    mood_score: Optional[int] = Field(default=None, ge=1, le=5)


class NudgeRequest(BaseModel):
    barrier: str = Field(min_length=1, max_length=100)


class MonitoringPlanRequest(BaseModel):
    check_in: dict = Field(default_factory=dict)


def _get_person(current_user: User, db: Session) -> Person:
    if current_user.role not in ("adult", "parent"):
        raise HTTPException(
            status_code=403,
            detail="This account cannot access a prevention journey.",
        )

    person_type = "adult" if current_user.role == "adult" else "child"
    person = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == person_type,
        )
        .order_by(Person.id.asc())
        .first()
    )
    if not person:
        raise HTTPException(
            status_code=404,
            detail="Complete the health profile before using the prevention agent.",
        )
    return person


def _assessment(person: Person, key: str) -> dict:
    baseline = person.baseline or {}
    history = baseline.get("adult_assessment_history", [])
    if isinstance(history, list):
        matching = [
            item
            for item in history
            if isinstance(item, dict) and item.get("assessment") == key
        ]
        if matching:
            return max(
                matching,
                key=lambda item: item.get("completed_at") or "",
            )

    legacy = baseline.get(key)
    if not isinstance(legacy, dict):
        return {}
    if key == "adult_hearing_vision":
        return {
            **legacy,
            "responses": legacy.get("responses", {}),
        }
    return {
        **legacy,
        "responses": {
            field: value
            for field, value in legacy.items()
            if field != "completed_at"
        },
    }


def _open_referrals(db: Session, person_id: int) -> list[Referral]:
    return (
        db.query(Referral)
        .filter(
            Referral.person_id == person_id,
            Referral.status.notin_(("COMPLETED", "CANCELLED")),
        )
        .order_by(Referral.created_at.asc())
        .all()
    )


def _latest_clinician_review(
    db: Session,
    person_id: int,
) -> Optional[AdultClinicalReview]:
    return (
        db.query(AdultClinicalReview)
        .filter(AdultClinicalReview.person_id == person_id)
        .order_by(AdultClinicalReview.created_at.desc())
        .first()
    )


def _result_status(decision: str) -> str:
    if decision in ("WATCH", "MONITOR"):
        return "WATCH"
    if decision in ("ACT", "FOLLOW_UP"):
        return "ACT"
    if decision == "REFER":
        return "REFER"
    return "NOT_ASSESSED"


def _utc_datetime(value: object) -> Optional[datetime]:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _has_newer_assessment(
    person: Person,
    review: AdultClinicalReview,
) -> bool:
    reviewed_at = _utc_datetime(review.created_at)
    assessment_times = [
        _utc_datetime(_assessment(person, key).get("completed_at"))
        for key in ("adult_health_assessment", "adult_hearing_vision")
    ]
    latest_assessment = max(
        (value for value in assessment_times if value is not None),
        default=None,
    )
    return bool(
        latest_assessment
        and (reviewed_at is None or latest_assessment > reviewed_at)
    )


def _clinical_result(
    person: Person,
    db: Session,
) -> dict:
    review = _latest_clinician_review(db, person.id)
    if not review:
        return {
            "available": False,
            "status": "PENDING_REVIEW",
            "risk": "NOT_ASSESSED",
            "recommendation": None,
            "reviewed_at": None,
            "source": None,
            "message": (
                "Your responses are saved. A clinician must review them before "
                "a result status or risk level can be shown."
            ),
        }

    if _has_newer_assessment(person, review):
        return {
            "available": False,
            "status": "PENDING_REVIEW",
            "risk": "NOT_ASSESSED",
            "recommendation": None,
            "reviewed_at": None,
            "source": None,
            "message": (
                "You saved newer assessment responses after the last clinician "
                "review. A clinician must review the updated information before "
                "a result status or risk level is shown."
            ),
        }

    return {
        "available": True,
        "status": _result_status(review.decision),
        "risk": review.risk,
        "recommendation": review.next_action,
        "reviewed_at": (
            review.created_at.isoformat()
            if review.created_at
            else None
        ),
        "source": "clinician_review",
        "message": (
            "Status and risk are entered by your clinician; they are not "
            "generated from the questionnaire."
        ),
    }


def _reported_result_context(person: Person) -> list[str]:
    baseline = _assessment(person, "adult_health_assessment").get("responses", {})
    sensory = _assessment(person, "adult_hearing_vision").get("responses", {})
    baseline = baseline if isinstance(baseline, dict) else {}
    sensory = sensory if isinstance(sensory, dict) else {}
    context = []

    memory = str(baseline.get("memory_concerns", "")).lower()
    if memory and not any(
        phrase in memory for phrase in ("no concerns", "prefer not to say")
    ):
        context.append("memory concerns")
    sleep = str(baseline.get("sleep_quality", "")).lower()
    if sleep in ("poor", "very poor"):
        context.append("poor sleep")
    if sensory.get("hearing_difficulty") in ("Often", "Always"):
        context.append("hearing difficulty")
    if sensory.get("vision_difficulty") in ("Often", "Always"):
        context.append("vision difficulty")
    return context


def _prevention_plan(
    baseline_assessment: dict,
    sensory_assessment: dict,
) -> list[dict]:
    baseline = baseline_assessment.get("responses", {})
    sensory = sensory_assessment.get("responses", {})
    baseline = baseline if isinstance(baseline, dict) else {}
    sensory = sensory if isinstance(sensory, dict) else {}

    hearing_concern = sensory.get("hearing_difficulty") in ("Often", "Always")
    vision_concern = sensory.get("vision_difficulty") in ("Often", "Always")
    bp_history = str(baseline.get("blood_pressure_history", "")).lower()
    sleep_quality = str(baseline.get("sleep_quality", "")).lower()
    mood = str(baseline.get("mood", "")).lower()
    function_change = str(baseline.get("everyday_function", "")).lower()
    metabolic_values = [
        f"{label}: {baseline[field]}"
        for field, label in (
            ("systolic_bp_mmhg", "systolic blood pressure (mmHg)"),
            ("diastolic_bp_mmhg", "diastolic blood pressure (mmHg)"),
            ("blood_glucose_mmol_l", "blood glucose (mmol/L)"),
            ("cholesterol_mmol_l", "total cholesterol (mmol/L)"),
            ("weight_kg", "weight (kg)"),
        )
        if baseline.get(field) is not None
    ]

    return [
        {
            "domain": "Cognitive",
            "action": "Ask your care team whether an approved cognitive screening instrument is available.",
            "basis": "No cognitive assessment or score is currently recorded.",
            "status": "approval_pending",
        },
        {
            "domain": "Functional",
            "action": (
                "Discuss changes in everyday activities or independence with your care team."
                if function_change in ("a little harder", "much harder")
                else "Tell your care team if everyday activities or independence change."
            ),
            "basis": (
                f"Your self-report is: {baseline.get('everyday_function')}."
                if function_change
                else "A functional assessment has not yet been recorded."
            ),
            "status": "self_reported" if function_change else "not_recorded",
        },
        {
            "domain": "Physical",
            "action": (
                "Discuss hearing or vision difficulties with a healthcare professional."
                if hearing_concern or vision_concern
                else "Keep hearing and vision follow-up in your routine care plan."
            ),
            "basis": (
                "Based on your self-reported hearing and vision responses."
                if sensory
                else "The hearing and vision questionnaire is not yet complete."
            ),
            "status": "self_reported" if sensory else "not_recorded",
        },
        {
            "domain": "Metabolic",
            "action": "Review blood pressure, glucose, cholesterol, and weight with your care team.",
            "basis": (
                "; ".join(metabolic_values)
                if metabolic_values
                else f"Your reported blood-pressure history is {baseline.get('blood_pressure_history')}."
                if baseline.get("blood_pressure_history")
                else "No laboratory or measured metabolic results are connected."
            ),
            "status": "self_reported" if (bp_history or metabolic_values) else "not_connected",
        },
        {
            "domain": "Sleep",
            "action": "Use the morning check-in to record sleep; discuss ongoing concerns with your care team.",
            "basis": (
                f"Your baseline self-report describes sleep as {baseline.get('sleep_quality')}."
                if sleep_quality
                else "Sleep duration and quality have not been recorded."
            ),
            "status": "self_reported" if sleep_quality else "not_recorded",
        },
        {
            "domain": "Mental wellbeing",
            "action": "Use the daily mood check-in and reach out to someone you trust if low mood persists.",
            "basis": (
                f"Your baseline self-report describes mood as {baseline.get('mood')}."
                if mood
                else "No mood check-in has been recorded."
            ),
            "status": "self_reported" if mood else "not_recorded",
        },
    ]


def _build_overview(
    person: Person,
    db: Session,
) -> dict:
    baseline_assessment = _assessment(person, "adult_health_assessment")
    sensory_assessment = _assessment(person, "adult_hearing_vision")
    today = datetime.now(ABU_DHABI).date()
    today_checkin = (
        db.query(WellbeingCheckIn)
        .filter(
            WellbeingCheckIn.person_id == person.id,
            WellbeingCheckIn.local_date == today.isoformat(),
        )
        .first()
    )
    checkins = (
        db.query(WellbeingCheckIn)
        .filter(WellbeingCheckIn.person_id == person.id)
        .order_by(WellbeingCheckIn.local_date.desc())
        .limit(14)
        .all()
    )
    referrals = _open_referrals(db, person.id)
    latest_review = _latest_clinician_review(db, person.id)
    clinical_result = _clinical_result(person, db)
    review_is_current = clinical_result["available"]
    baseline_complete = bool(baseline_assessment)
    sensory_complete = bool(sensory_assessment)
    responses = sensory_assessment.get("responses", {})
    responses = responses if isinstance(responses, dict) else {}
    sensory_concern = any(
        responses.get(key) in ("Often", "Always")
        for key in ("hearing_difficulty", "vision_difficulty")
    )

    if not baseline_complete:
        action = {
            "title": "Build your health baseline",
            "detail": "Complete the self-reported health and wellbeing baseline.",
            "route": "/adult/screening/baseline",
        }
    elif not sensory_complete:
        action = {
            "title": "Complete hearing and vision",
            "detail": "Record your hearing and vision experiences.",
            "route": "/adult/screening/hearing-vision",
        }
    elif referrals:
        action = {
            "title": "Follow up on an open referral",
            "detail": f"Check the status of your {referrals[0].specialty or 'healthcare'} referral with your care team.",
            "route": "/screening/referrals",
        }
    elif latest_review and review_is_current:
        action = {
            "title": "Follow your clinician's recommendation",
            "detail": latest_review.next_action,
            "route": "/adult/history",
        }
    elif sensory_concern:
        action = {
            "title": "Discuss sensory changes with your care team",
            "detail": "Your answers report hearing or vision difficulty; the questionnaire is not a diagnosis.",
            "route": "/screening/referrals",
        }
    elif not today_checkin:
        action = {
            "title": "Complete your morning check-in",
            "detail": "Record how you slept and how you are feeling today.",
            "route": "/adult/check-in",
        }
    else:
        action = {
            "title": "Ask about approved cognitive screening",
            "detail": "Cognitive screening remains unavailable until an approved instrument is authorized.",
            "route": "/adult/history",
        }

    if person.language == "ar":
        arabic_action_details = {
            "Build your health baseline": "أكمل المعلومات الصحية الأساسية التي تقدمها بنفسك.",
            "Complete hearing and vision": "سجّل ملاحظاتك عن السمع والبصر.",
            "Follow up on an open referral": "تابع إحالتك مع فريق الرعاية الصحية.",
            "Follow your clinician's recommendation": latest_review.next_action if latest_review else action["detail"],
            "Discuss sensory changes with your care team": "تحدث مع فريق الرعاية الصحية عن أي تغيّر في السمع أو البصر.",
            "Complete your morning check-in": "سجّل مدة نومك وشعورك اليوم.",
            "Ask about approved cognitive screening": "اسأل فريق الرعاية عن توفر فحص معرفي معتمد.",
        }
        action["detail"] = arabic_action_details.get(
            action["title"],
            "راجع الخطوة التالية مع فريق الرعاية الصحية.",
        )

    sorted_checkins = sorted(checkins, key=lambda item: item.local_date)
    recent = [
        item
        for item in sorted_checkins
        if date.fromisoformat(item.local_date) >= today - timedelta(days=6)
    ]
    previous = [
        item
        for item in sorted_checkins
        if today - timedelta(days=13)
        <= date.fromisoformat(item.local_date)
        < today - timedelta(days=6)
    ]
    change_observations = []
    for field, label in (
        ("sleep_hours", "sleep duration"),
        ("mood_score", "mood check-in"),
    ):
        recent_values = [getattr(item, field) for item in recent if getattr(item, field) is not None]
        previous_values = [getattr(item, field) for item in previous if getattr(item, field) is not None]
        if len(recent_values) >= 3 and len(previous_values) >= 3:
            recent_average = sum(recent_values) / len(recent_values)
            previous_average = sum(previous_values) / len(previous_values)
            change_observations.append(
                {
                    "measure": label,
                    "previous_period_average": round(previous_average, 1),
                    "recent_period_average": round(recent_average, 1),
                    "difference": round(recent_average - previous_average, 1),
                    "interpretation": "Descriptive self-report trend only; not a clinical change or risk score.",
                }
            )

    return {
        "person_id": person.id,
        "person_name": person.name,
        "language": person.language or "en",
        "assessment_status": {
            "baseline": "completed" if baseline_complete else "not_started",
            "hearing_vision": "completed" if sensory_complete else "not_started",
            "cognitive": "approval_pending",
        },
        "cognitive_screening": {
            "available": False,
            "message": "An approved instrument, permissions, and clinical authorization are required. No cognitive score is available.",
        },
        "today_check_in": (
            {
                "date": today_checkin.local_date,
                "sleep_hours": today_checkin.sleep_hours,
                "mood_score": today_checkin.mood_score,
            }
            if today_checkin
            else None
        ),
        "next_best_action": action,
        "prevention_plan": _prevention_plan(
            baseline_assessment,
            sensory_assessment,
        ),
        "open_referrals": [
            {
                "id": referral.id,
                "specialty": referral.specialty,
                "status": referral.status,
                "created_at": (
                    referral.created_at.isoformat()
                    if referral.created_at
                    else None
                ),
            }
            for referral in referrals
        ],
        "latest_clinician_review": (
            {
                "decision": latest_review.decision,
                "risk": latest_review.risk,
                "recommendation": latest_review.next_action,
                "reviewed_at": (
                    latest_review.created_at.isoformat()
                    if latest_review.created_at
                    else None
                ),
            }
            if latest_review and review_is_current
            else None
        ),
        "self_reported_change_observations": change_observations,
        "check_in_count_last_14_days": len(checkins),
        "disclaimer": safety_disclaimer(),
    }


@router.get("/overview")
def prevention_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="The adult prevention overview requires an adult account.",
        )
    return _build_overview(person, db)


@router.get("/results")
def adult_results(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="Adult results require an adult account.",
        )
    return {
        "person_id": person.id,
        "person_name": person.name,
        "result": _clinical_result(person, db),
        "reported_context": _reported_result_context(person),
        "disclaimer": safety_disclaimer(),
    }


@router.get("/plan")
def adult_action_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="The adult action plan requires an adult account.",
        )

    result = _clinical_result(person, db)
    if result["available"] and result["recommendation"]:
        action = {
            "title": "Your clinician's recommended next action",
            "detail": result["recommendation"],
            "source": "clinician_review",
        }
    else:
        next_action = _build_overview(person, db)["next_best_action"]
        action = {
            **next_action,
            "source": "saved_profile_and_assessments",
        }

    return {
        "actions": [action],
        "count": 1,
        "result_status": result["status"],
        "booking_available": False,
        "disclaimer": (
            "This is one next step based on saved information. VitaBridge "
            "does not book appointments or replace clinician advice."
        ),
    }


@router.post("/check-in")
def save_daily_check_in(
    payload: CheckInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="Daily adult check-ins require an adult account.",
        )
    if payload.sleep_hours is None and payload.mood_score is None:
        raise HTTPException(
            status_code=422,
            detail="Enter your sleep duration, mood, or both.",
        )

    local_date = datetime.now(ABU_DHABI).date().isoformat()
    check_in = (
        db.query(WellbeingCheckIn)
        .filter(
            WellbeingCheckIn.person_id == person.id,
            WellbeingCheckIn.local_date == local_date,
        )
        .first()
    )
    if check_in is None:
        check_in = WellbeingCheckIn(
            person_id=person.id,
            local_date=local_date,
        )
        db.add(check_in)
    if payload.sleep_hours is not None:
        check_in.sleep_hours = payload.sleep_hours
    if payload.mood_score is not None:
        check_in.mood_score = payload.mood_score

    try:
        db.commit()
        db.refresh(check_in)
    except IntegrityError:
        db.rollback()
        check_in = (
            db.query(WellbeingCheckIn)
            .filter(
                WellbeingCheckIn.person_id == person.id,
                WellbeingCheckIn.local_date == local_date,
            )
            .first()
        )
        if check_in is None:
            raise HTTPException(
                status_code=500,
                detail="Unable to save your check-in. Please try again.",
            )
        if payload.sleep_hours is not None:
            check_in.sleep_hours = payload.sleep_hours
        if payload.mood_score is not None:
            check_in.mood_score = payload.mood_score
        try:
            db.commit()
            db.refresh(check_in)
        except SQLAlchemyError as error:
            db.rollback()
            logger.exception("Unable to update concurrent daily check-in")
            raise HTTPException(
                status_code=500,
                detail="Unable to save your check-in. Please try again.",
            ) from error
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Unable to save daily wellbeing check-in")
        raise HTTPException(
            status_code=500,
            detail="Unable to save your check-in. Please try again.",
        ) from error

    return {
        "success": True,
        "message": "Your check-in has been saved.",
        "check_in": {
            "date": check_in.local_date,
            "sleep_hours": check_in.sleep_hours,
            "mood_score": check_in.mood_score,
        },
        "updated_today": True,
        "disclaimer": "Check-ins are self-reported wellbeing notes, not a medical assessment.",
    }


@router.get("/check-ins")
def list_daily_check_ins(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="Adult check-ins require an adult account.",
        )
    records = (
        db.query(WellbeingCheckIn)
        .filter(WellbeingCheckIn.person_id == person.id)
        .order_by(WellbeingCheckIn.local_date.desc())
        .all()
    )
    return {
        "check_ins": [
            {
                "date": record.local_date,
                "sleep_hours": record.sleep_hours,
                "mood_score": record.mood_score,
                "created_at": (
                    record.created_at.isoformat()
                    if record.created_at
                    else None
                ),
            }
            for record in records
        ]
    }


def _saved_age(person: Person) -> tuple[Optional[int], Optional[int]]:
    if not person.dob:
        return None, None
    try:
        dob = date.fromisoformat(person.dob.replace("/", "-"))
    except ValueError:
        return None, None

    today = date.today()
    years = today.year - dob.year - (
        (today.month, today.day) < (dob.month, dob.day)
    )
    months = (today.year - dob.year) * 12 + today.month - dob.month
    if today.day < dob.day:
        months -= 1
    return years, months


def _format_nura_reply(
    language: str,
    meaning: str,
    factors: str,
    improvements: list[str],
    next_steps: str,
    question: str,
    action: str,
) -> str:
    if language == "ar":
        return (
            f"1. ماذا يعني ذلك لك\n{meaning}\n\n"
            f"2. ما الذي قد يؤثر فيه\n{factors}\n\n"
            "3. ما الذي يمكنك تحسينه\n"
            + "\n".join(f"- {item}" for item in improvements)
            + f"\n\n4. ما الذي سيحدث بعد ذلك\n{next_steps} {question}\n\n"
            f"5. أفضل خطوة تالية واحدة\n**{action}**"
        )
    return (
        f"1. WHAT THIS MEANS FOR YOU\n{meaning}\n\n"
        f"2. WHAT COULD BE AFFECTING IT\n{factors}\n\n"
        "3. WHAT YOU CAN IMPROVE\n"
        + "\n".join(f"- {item}" for item in improvements)
        + f"\n\n4. WHAT HAPPENS NEXT\n{next_steps} {question}\n\n"
        f"5. ONE NEXT BEST ACTION\n**{action}**"
    )


def _saved_value(value, arabic: bool) -> str:
    if value is None or value == "":
        return "غير مسجل" if arabic else "not recorded"
    if not arabic:
        return str(value)
    translations = {
        "Never": "أبداً",
        "Sometimes": "أحياناً",
        "Often": "غالباً",
        "Always": "دائماً",
        "No": "لا",
        "Yes": "نعم",
        "Good": "جيد",
        "Poor": "ضعيف",
        "Very poor": "ضعيف جداً",
        "Excellent": "ممتاز",
        "Prefer not to say": "أفضل عدم الإجابة",
        "en": "الإنجليزية",
        "ar": "العربية",
    }
    return translations.get(str(value), str(value))


def _adult_nura_reply(
    message: str,
    person: Person,
    db: Session,
    overview: dict,
) -> str:
    language = person.language or "en"
    arabic = language == "ar"
    lowered = message.lower()
    baseline = _assessment(person, "adult_health_assessment").get(
        "responses", {}
    )
    sensory = _assessment(person, "adult_hearing_vision").get(
        "responses", {}
    )
    baseline = baseline if isinstance(baseline, dict) else {}
    sensory = sensory if isinstance(sensory, dict) else {}
    result = _clinical_result(person, db)
    age, _ = _saved_age(person)
    check_in = overview.get("today_check_in")
    if not check_in:
        latest_check_in = (
            db.query(WellbeingCheckIn)
            .filter(WellbeingCheckIn.person_id == person.id)
            .order_by(WellbeingCheckIn.local_date.desc())
            .first()
        )
        if latest_check_in:
            check_in = {
                "date": latest_check_in.local_date,
                "sleep_hours": latest_check_in.sleep_hours,
                "mood_score": latest_check_in.mood_score,
            }
    nura_context = build_nura_context(
        person=person,
        age=age,
        baseline=baseline,
        sensory=sensory,
        check_in=check_in,
        clinical_result=result,
        open_loops=overview.get("open_referrals", []),
        next_action=overview["next_best_action"],
    )
    name = nura_context["person"]["name"] or ("" if arabic else "You")

    measurements = []
    for key, label in (
        ("systolic_bp_mmhg", "ضغط الدم الانقباضي" if arabic else "systolic BP"),
        ("diastolic_bp_mmhg", "ضغط الدم الانبساطي" if arabic else "diastolic BP"),
        ("blood_glucose_mmol_l", "الجلوكوز" if arabic else "glucose"),
        ("cholesterol_mmol_l", "الكوليسترول" if arabic else "cholesterol"),
        ("weight_kg", "الوزن" if arabic else "weight"),
    ):
        value = nura_context["baseline"]["measurements"].get(key)
        if value is not None:
            measurements.append(f"{label} {value}")
    check_in = check_in or {}
    sleep_hours = nura_context["baseline"]["sleep_hours"]
    if sleep_hours is not None:
        measurements.append(
            f"{'ساعات النوم' if arabic else 'sleep'} {sleep_hours}"
        )

    if age is None:
        identity = name if arabic else f"{name}"
    elif arabic:
        identity = f"{name}، بعمر {age} عاماً"
    else:
        identity = f"{name}, age {age}"

    if result["available"]:
        status = nura_context["status"]
        risk = nura_context["risk"]
        if arabic:
            meaning = (
                f"{identity}: سجّل الطبيب الحالة {status} ومستوى المخاطر "
                f"{risk}. هذه نتيجة أدخلها الطبيب وليست تشخيصاً، ولا توجد "
                "درجة معرفية معتمدة محفوظة. "
            )
        else:
            meaning = (
                f"{identity}: your clinician recorded status {status} and "
                f"risk {risk}. These clinician-entered results are not a diagnosis; "
                "no approved cognitive score is saved. "
            )
    elif arabic:
        meaning = (
            f"{identity}: إجاباتك الصحية معلومات تقدمها بنفسك، ولا توجد "
            "حالة مسجلة من الطبيب. لا توجد درجة معرفية معتمدة، بما فيها MoCA. "
            "الفحص يحدد الحاجة للمتابعة ولا يشخّص المرض. "
        )
    else:
        meaning = (
            f"{identity}: your health answers are self-reported, and no "
            "clinician-entered status is saved yet. No approved cognitive score, "
            "including MoCA, is available. "
            "Screening identifies risk, not disease. "
        )

    if measurements:
        meaning += (
            "القياسات المحفوظة: " if arabic else "Saved measurements: "
        ) + ", ".join(measurements) + "."
    else:
        meaning += (
            "لا توجد قياسات رقمية محفوظة."
            if arabic
            else "No numeric measurements are saved."
        )

    hearing = _saved_value(sensory.get("hearing_difficulty"), arabic)
    vision = _saved_value(sensory.get("vision_difficulty"), arabic)
    sleep_quality = _saved_value(baseline.get("sleep_quality"), arabic)
    mood = _saved_value(
        check_in.get("mood_score")
        if check_in.get("mood_score") is not None
        else baseline.get("mood"),
        arabic,
    )
    education = _saved_value(person.education, arabic)
    culture = _saved_value(person.culture, arabic)
    language_label = _saved_value(person.language, arabic)
    if nura_context["additional_information"]:
        recent_illness_context = (
            "المرض الحديث غير مسجل كحقل مستقل؛ توجد معلومات إضافية محفوظة."
            if arabic
            else "Recent illness is not a separate field; saved additional information is available."
        )
    else:
        recent_illness_context = (
            "المرض الحديث والراحة الرقمية: غير مسجلين."
            if arabic
            else "recent illness and digital comfort: not recorded."
        )
    if arabic:
        factors = (
            f"السمع: {hearing}؛ البصر: {vision}؛ النوم: {sleep_quality}؛ "
            f"المزاج: {mood}؛ اللغة: {language_label}؛ التعليم: {education}؛ "
            f"الخلفية الثقافية: {culture}؛ {recent_illness_context}"
        )
        if sensory.get("hearing_difficulty") in ("Often", "Always") or sensory.get("vision_difficulty") in ("Often", "Always"):
            factors += (
                " قد تؤثر صعوبة السمع أو البصر في الأداء أثناء الفحص المعرفي، "
                "لكن الإجابات لا تشخّص فقداناً حسياً ولا تثبت سبباً."
            )
        improvements = [
            (
                "أخبر فريق الرعاية بوقت حدوث صعوبة السمع أو البصر التي أبلغت عنها."
                if sensory.get("hearing_difficulty") in ("Often", "Always")
                or sensory.get("vision_difficulty") in ("Often", "Always")
                else "سجّل أي تغيّر تلاحظه في السمع أو البصر."
            ),
            "أضف مدة النوم في تسجيل المتابعة اليومي.",
            "دوّن أي تغيّر في الذاكرة أو الأنشطة اليومية لمناقشته مع فريق الرعاية.",
        ]
    else:
        factors = (
            f"Hearing: {hearing}; vision: {vision}; sleep: {sleep_quality}; "
            f"mood: {mood}; language: {language_label}; education: {education}; "
            f"cultural background: {culture}; {recent_illness_context} "
            "Digital comfort: not recorded."
        )
        if sensory.get("hearing_difficulty") in ("Often", "Always") or sensory.get("vision_difficulty") in ("Often", "Always"):
            factors += (
                " Hearing or vision difficulty can affect performance on cognitive screening, "
                "but these answers do not diagnose sensory loss or establish a cause."
            )
        improvements = [
            (
                "Tell your care team when the hearing or vision difficulty you reported occurs."
                if sensory.get("hearing_difficulty") in ("Often", "Always")
                or sensory.get("vision_difficulty") in ("Often", "Always")
                else "Note any change you notice in hearing or vision."
            ),
            "Log sleep duration in your next daily check-in.",
            "Write down any change in memory or daily activities for your care team.",
        ]

    reported_context = _reported_result_context(person)
    if reported_context and not arabic:
        factors += (
            " Saved self-reports also mention "
            + ", ".join(reported_context)
            + "; these may be relevant context but do not establish a cause."
        )
    elif reported_context:
        factors += (
            " وتشير المعلومات التي قدمتها بنفسك إلى "
            + "، ".join(reported_context)
            + "؛ وقد تساعد في فهم السياق لكنها لا تثبت سبباً."
        )

    next_action = overview["next_best_action"]
    action_title = next_action["title"]
    if action_title == "Discuss sensory changes with your care team":
        if sensory.get("hearing_difficulty") in ("Often", "Always"):
            reason = (
                "أبلغت عن صعوبة في السمع "
                + (
                    "بشكل متكرر."
                    if sensory.get("hearing_difficulty") == "Often"
                    else "دائماً."
                )
                if arabic
                else (
                    "you reported hearing difficulty: "
                    f"{sensory.get('hearing_difficulty')}."
                )
            )
        elif sensory.get("vision_difficulty") in ("Often", "Always"):
            reason = (
                "أبلغت عن صعوبة في البصر "
                + (
                    "بشكل متكرر."
                    if sensory.get("vision_difficulty") == "Often"
                    else "دائماً."
                )
                if arabic
                else (
                    "you reported vision difficulty: "
                    f"{sensory.get('vision_difficulty')}."
                )
            )
        else:
            reason = (
                "إجابات السمع أو البصر المسجلة تشير إلى الحاجة للمناقشة."
                if arabic
                else "your saved hearing or vision answers indicate this should be discussed."
            )
        action = (
            "أخبر فريق الرعاية بصعوبة السمع أو البصر التي أبلغت عنها."
            if arabic
            else "Tell your care team about the hearing or vision difficulty you reported."
        )
        next_steps = (
            f"سبب هذه الخطوة هو أن {reason} الإجابة ليست تشخيصاً. "
            "لا يوجد موعد متابعة مسجل؛ اسأل فريق الرعاية عن التوقيت المناسب."
            if arabic
            else f"This follows because {reason} A questionnaire is not a diagnosis. "
            "No follow-up date is saved; ask your care team when to review it."
        )
    elif action_title == "Follow up on an open referral":
        action = (
            "تحقق مع فريق الرعاية من حالة الإحالة المفتوحة."
            if arabic
            else "Check the status of your open referral with your care team."
        )
        next_steps = (
            "توجد إحالة مفتوحة في ملفك. تواصل مع فريق الإحالة هذا الأسبوع لتأكيد الخطوة التالية."
            if arabic
            else "An open referral is saved. Contact the referral team this week to confirm the next step."
        )
    elif action_title == "Follow your clinician's recommendation":
        action = result["recommendation"] or next_action["detail"]
        next_steps = (
            "هذه الخطوة مأخوذة من توصية الطبيب المسجلة. لا يوجد موعد إعادة تقييم محفوظ."
            if arabic
            else "This action comes from your clinician's saved recommendation. No recheck date is recorded."
        )
    elif action_title == "Build your health baseline":
        action = (
            "أكمل تسجيل المعلومات الصحية الأساسية."
            if arabic
            else "Complete your saved health and wellbeing baseline."
        )
        next_steps = (
            "لم يتم حفظ خط الأساس الصحي بعد، لذلك لا توجد نقطة بداية للمقارنة."
            if arabic
            else "The health baseline is not saved yet, so there is no starting point for comparison."
        )
    elif action_title == "Complete hearing and vision":
        action = (
            "أكمل تسجيل إجابات السمع والبصر."
            if arabic
            else "Record your hearing and vision responses."
        )
        next_steps = (
            "لم يتم حفظ إجابات السمع والبصر بعد. أكملها قبل مراجعة الوقاية التالية."
            if arabic
            else "Hearing and vision responses are not saved yet. Complete them before your next prevention review."
        )
    elif action_title == "Complete your morning check-in":
        action = (
            "سجّل نومك ومزاجك اليوم."
            if arabic
            else "Record today's sleep and mood check-in."
        )
        next_steps = (
            "لم يتم حفظ متابعة اليوم. سجّل النوم والمزاج اليوم."
            if arabic
            else "Today's check-in is not saved. Record sleep and mood today."
        )
    else:
        action = (
            "اسأل فريق الرعاية عن توفر فحص معرفي معتمد."
            if arabic
            else "Ask your care team whether approved cognitive screening is available."
        )
        next_steps = (
            "لا توجد نتيجة معرفية محفوظة، ولا يُنشئ التطبيق درجة. اسأل فريق الرعاية عن أداة معتمدة."
            if arabic
            else "No cognitive result is saved and the app does not create a score. Ask your care team about an approved instrument."
        )

    if any(term in lowered for term in ("barrier", "missed", "appointment", "transport", "cost")):
        question = (
            "ما العائق الأهم بالنسبة لك: الوقت، أو المواصلات، أو اللغة، أو القلق؟"
            if arabic
            else "What is the main barrier: time, transport, language, or worry?"
        )
    elif nura_context["additional_information"]:
        question = (
            "هل تتضمن المعلومات الإضافية المحفوظة مرضاً حديثاً أو تغيّراً في شعورك؟"
            if arabic
            else "Does your saved additional information mention a recent illness or change in how you feel?"
        )
    else:
        question = (
            "هل ترغب في مشاركة عائق أو تجهيز سؤال لفريق الرعاية؟"
            if arabic
            else "Would you like to share a barrier or prepare a question for your care team?"
        )

    if result["available"] and result["status"] == "REFER":
        next_steps = (
            "هذه الحالة تحتاج إلى مراجعة مختص صحي. تواصل مع طبيبك الآن لمناقشة الخطوة التالية. "
            + next_steps
            if arabic
            else "This needs clinician review. Please contact your clinician now to discuss the next step. "
            + next_steps
        )

    return _format_nura_reply(
        language,
        meaning.strip(),
        factors,
        improvements,
        next_steps,
        question,
        action,
    )


def _child_nura_context(person: Person, db: Session) -> dict:
    screenings = (
        db.query(Screening)
        .filter(
            Screening.person_id == person.id,
            Screening.kind == "CHILD_DEVELOPMENT",
        )
        .order_by(Screening.created_at.desc(), Screening.id.desc())
        .all()
    )
    referrals = _open_referrals(db, person.id)
    latest = screenings[0] if screenings else None
    age_years, age_months = _saved_age(person)
    if referrals:
        action = {
            "title": "Follow up on an open referral",
            "detail": f"Check the status of your {referrals[0].specialty or 'healthcare'} referral with your care team.",
            "route": "/screening/history",
        }
    elif latest and latest.clinician_reviewed and latest.next_action:
        action = {
            "title": "Follow your clinician's recommendation",
            "detail": latest.next_action,
            "route": "/screening/history",
        }
    elif latest:
        action = {
            "title": "Get the developmental screening reviewed",
            "detail": "Ask your care team to review the saved developmental screening.",
            "route": "/screening/history",
        }
    else:
        action = {
            "title": "Check the next Well-Child Visit",
            "detail": "Ask your care team which of the 14 Well-Child Visits is due for your child's age.",
            "route": "/screening/instruments",
        }

    latest_data = None
    if latest:
        raw_answers = latest.raw_answers or {}
        milestones = raw_answers.get("milestones", {})
        growth = raw_answers.get("growth", {})
        milestone_areas = [
            str(key)
            for key, value in milestones.items()
            if isinstance(milestones, dict) and value is not None and value != ""
        ] if isinstance(milestones, dict) else []
        growth_measurements = {}
        if isinstance(growth, dict):
            units = {
                "weight_kg": "kg",
                "height_cm": "cm",
                "head_circumference_cm": "cm",
            }
            growth_measurements = {
                str(key): {
                    "value": value,
                    "unit": units.get(str(key)),
                }
                for key, value in growth.items()
                if isinstance(value, (int, float)) and not isinstance(value, bool)
            }
        latest_data = {
            "age_months": latest.visit_no,
            "created_at": (
                latest.created_at.isoformat()
                if latest.created_at
                else None
            ),
            "instrument_name": raw_answers.get("instrument_name"),
            "milestone_areas_saved": (
                len(milestones) if isinstance(milestones, dict) else 0
            ),
            "milestone_areas": milestone_areas,
            "growth_measures_saved": (
                len(growth) if isinstance(growth, dict) else 0
            ),
            "growth_measurements": growth_measurements,
            "clinician_reviewed": bool(latest.clinician_reviewed),
            "status": latest.status,
            "risk": latest.risk if latest.clinician_reviewed else None,
            "next_action": (
                latest.next_action if latest.clinician_reviewed else None
            ),
        }

    return {
        "person_type": "child",
        "person_id": person.id,
        "person_name": person.name,
        "language": person.language or "en",
        "age_years": age_years,
        "age_months": age_months,
        "next_best_action": action,
        "latest_screening": latest_data,
        "open_referrals": [
            {
                "specialty": referral.specialty,
                "status": referral.status,
            }
            for referral in referrals
        ],
    }


def _child_nura_reply(
    message: str,
    person: Person,
    context: dict,
) -> str:
    arabic = person.language == "ar"
    latest = context["latest_screening"]
    _, age_months = _saved_age(person)
    age_text = (
        f"عمر الطفل {age_months} شهراً"
        if arabic and age_months is not None
        else (
            f"your child is {age_months} months old"
            if age_months is not None
            else ""
        )
    )
    identity = (
        f"{person.name}، {age_text}"
        if arabic
        else f"{person.name}, {age_text}".strip(", ")
    )

    if latest and latest["clinician_reviewed"] and latest["risk"] != "NOT_ASSESSED":
        risk = latest["risk"]
        meaning = (
            f"{identity}: راجع الطبيب سجل النمو المحفوظ وسجّل مستوى المتابعة {risk}. "
            "هذا توجيه متابعة وليس تشخيصاً."
            if arabic
            else (
                f"{identity}: your clinician reviewed the saved developmental record "
                f"and recorded follow-up level {risk}. This is guidance, not a diagnosis."
            )
        )
    elif latest and latest["clinician_reviewed"]:
        visit_age = latest["age_months"]
        meaning = (
            f"{identity}: راجع الطبيب سجل النمو المحفوظ من عمر {visit_age} شهراً، "
            "لكنه لم يسجل مستوى مخاطر. هذا ليس تشخيصاً."
            if arabic
            else (
                f"{identity}: your clinician reviewed the developmental record from "
                f"age {visit_age} months but did not record a risk level. This is not a diagnosis."
            )
        )
    elif latest:
        visit_age = latest["age_months"]
        meaning = (
            f"{identity}: يوجد سجل نمو محفوظ من عمر {visit_age} شهراً، "
            "وهو بانتظار مراجعة الطبيب. لم تُسجل نتيجة أو درجة."
            if arabic
            else (
                f"{identity}: a developmental record is saved from age {visit_age} months "
                "and is awaiting clinician review. No result or score is recorded."
            )
        )
    else:
        meaning = (
            f"{identity}: لا يوجد سجل فحص نمو محفوظ حتى الآن. "
            "لن أخمّن نتيجة أو درجة."
            if arabic
            else f"{identity}: no developmental screening record is saved yet. I will not guess a result or score."
        )

    if latest:
        milestone_areas = latest["milestone_areas"]
        if arabic:
            milestone_labels = {
                "communication": "التواصل",
                "language": "اللغة",
                "motor": "الحركة",
                "social": "التفاعل الاجتماعي",
                "social_emotional": "التفاعل الاجتماعي والعاطفي",
                "cognitive": "التطور المعرفي",
            }
            milestone_areas = [
                milestone_labels.get(area, area)
                for area in milestone_areas
            ]
        growth_measurements = latest["growth_measurements"]
        growth_labels = {
            "weight_kg": ("الوزن", "kg") if arabic else ("weight", "kg"),
            "height_cm": ("الطول", "cm") if arabic else ("height", "cm"),
            "head_circumference_cm": (
                ("محيط الرأس", "cm")
                if arabic
                else ("head circumference", "cm")
            ),
        }
        growth_details = [
            f"{growth_labels.get(key, (key, data['unit']))[0]} "
            f"{data['value']}{' ' + data['unit'] if data['unit'] else ''}"
            for key, data in growth_measurements.items()
        ]
        if milestone_areas or growth_details:
            if arabic:
                meaning += (
                    " المجالات المسجلة: "
                    + ("، ".join(milestone_areas) or "غير مسجل")
                    + "؛ قياسات النمو: "
                    + ("، ".join(growth_details) or "غير مسجلة")
                    + "."
                )
            else:
                meaning += (
                    " Saved milestone areas: "
                    + (", ".join(milestone_areas) or "not recorded")
                    + "; growth measurements: "
                    + (", ".join(growth_details) or "not recorded")
                    + "."
                )
        factors = (
            f"المراحل: {', '.join(milestone_areas) or 'غير مسجل'}؛ "
            f"قياسات النمو: {', '.join(growth_details) or 'غير مسجلة'}؛ "
            "النوم والتغذية والمرض الحديث: غير مسجل في هذا الفحص."
            if arabic
            else (
                f"Milestones: {', '.join(milestone_areas) or 'not recorded'}; "
                f"growth measurements: {', '.join(growth_details) or 'not recorded'}; "
                "sleep, feeding, and recent illness: not recorded in this screening."
            )
        )
    else:
        factors = (
            "لا يوجد فحص نمو محفوظ؛ معلومات النوم والتغذية والمرض الحديث غير مسجلة."
            if arabic
            else "No developmental screening is saved; sleep, feeding, and recent illness are not recorded."
        )

    improvements = (
        [
            "اقرأ أو غنِّ مع طفلك خمس دقائق يومياً.",
            "دوّن ملاحظة واحدة عن التواصل أو الحركة أثناء اللعب الآمن.",
            "اكتب أي سؤال عن النوم أو التغذية أو النمو لفريق الرعاية.",
        ]
        if arabic
        else [
            "Read or sing together for five minutes today.",
            "Note one communication or movement observation during safe play.",
            "Write down any sleep, feeding, or growth question for the care team.",
        ]
    )

    if context["open_referrals"]:
        action = (
            "تحقق مع فريق الرعاية من حالة الإحالة المفتوحة هذا الأسبوع."
            if arabic
            else "Check the open referral status with your care team this week."
        )
        next_steps = (
            "هناك إحالة مفتوحة محفوظة في الملف. تواصل مع فريق الرعاية هذا الأسبوع لتأكيد الخطوة التالية."
            if arabic
            else "An open referral is saved. Contact the care team this week to confirm the next step."
        )
    elif latest and not latest["clinician_reviewed"]:
        action = (
            "اطلب من فريق الرعاية مراجعة سجل النمو المحفوظ."
            if arabic
            else "Ask your care team to review the saved developmental screening."
        )
        next_steps = (
            "السجل بانتظار مراجعة الطبيب ولا توجد نتيجة أو درجة بعد. لا يوجد تاريخ مراجعة مسجل."
            if arabic
            else "The record is awaiting clinician review, with no result or score yet. No review date is saved."
        )
    elif latest and latest["clinician_reviewed"]:
        action = latest["next_action"] or context["next_best_action"]["detail"]
        next_steps = (
            "اتبع توصية الطبيب المسجلة. لا يوجد موعد متابعة آخر مسجل."
            if arabic
            else "Follow the clinician-entered recommendation. No later follow-up date is saved."
        )
    else:
        action = (
            "اسأل فريق الرعاية عن زيارة الطفل الوقائية المستحقة لعمره."
            if arabic
            else "Ask your care team which Well-Child Visit (1–14) is due for your child's age."
        )
        next_steps = (
            "لا يوجد سجل فحص محفوظ، ولا يظهر موعد زيارة محدد في الملف."
            if arabic
            else "No screening record or specific visit due date is saved."
        )

    if any(
        term in message.lower()
        for term in ("barrier", "missed", "transport", "عائق", "مواصلات", "فاتني")
    ):
        question = (
            "ما الذي يجعل زيارة الطفل الوقائية صعبة: الوقت، أو المواصلات، أو اللغة، أو القلق؟"
            if arabic
            else "What makes the Well-Child Visit difficult: time, transport, language, or worry?"
        )
    else:
        question = (
            "هل يوجد تغيير حديث في النوم أو التغذية أو النمو تريد تدوينه؟"
            if arabic
            else "Is there a recent change in sleep, feeding, or development you would like to note?"
        )

    if latest and latest["risk"] == "URGENT_REVIEW":
        next_steps = (
            "سجّل الطبيب أن مراجعة مختص مطلوبة بشكل عاجل. تواصل مع طبيب طفلك الآن. "
            + next_steps
            if arabic
            else "Your clinician recorded that urgent review is needed. Contact your child's clinician now. "
            + next_steps
        )
        action = (
            "تواصل مع طبيب طفلك الآن بشأن المراجعة العاجلة."
            if arabic
            else "Contact your child's clinician now about the urgent review."
        )

    return _format_nura_reply(
        person.language or "en",
        meaning,
        factors,
        improvements,
        next_steps,
        question,
        action,
    )


@router.get("/nura-context")
def nura_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role == "adult":
        overview = _build_overview(person, db)
        return {
            "person_type": "adult",
            "person_name": person.name,
            "language": person.language or "en",
            "next_best_action": overview["next_best_action"],
        }
    return _child_nura_context(person, db)


@router.post("/chat")
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    message = payload.message.strip()
    red_flags = check_red_flags(message)
    if red_flags:
        reply = (
            "أقدّر مشاركتك. لا تستطيع نورة تقييم الحالات الطارئة. يُرجى "
            "الاتصال بخدمات الطوارئ المحلية أو بمختص صحي الآن، والبقاء مع "
            "شخص تثق به إن أمكن."
            if person.language == "ar"
            else (
                "I'm glad you shared this. Nura cannot assess an emergency. "
                "Please contact your local emergency service or a qualified "
                "healthcare professional now, and if possible stay with someone "
                "you trust."
            )
        )
        return {
            "reply": reply,
            "urgent_human_support": True,
            "disclaimer": safety_disclaimer(),
        }

    if current_user.role == "adult":
        overview = _build_overview(person, db)
        reply = _adult_nura_reply(message, person, db, overview)
    else:
        context = _child_nura_context(person, db)
        reply = _child_nura_reply(message, person, context)

    return {
        "reply": reply,
        "urgent_human_support": False,
        "disclaimer": safety_disclaimer(),
    }


@router.post("/nudge")
def nudge(
    payload: NudgeRequest,
    current_user: User = Depends(get_current_user),
):
    barrier = payload.barrier.strip().lower()
    prompt = {
        "transport": "Would transport or finding a nearby clinic make the next step easier?",
        "time": "Would you like to choose a convenient time to contact your care team?",
        "worry": "Would a plain-language explanation of what to expect help you feel more prepared?",
        "value": "Would it help to review why this follow-up was recommended with your clinician?",
        "cost": "Would you like to ask your care team about available coverage or lower-cost options?",
        "language": "Would you prefer to discuss this in another language with your care team?",
    }
    return {
        "barrier": barrier,
        "support_prompt": prompt.get(
            barrier,
            "What would make your next preventive-care step easier?",
        ),
        "booking_available": False,
        "message": "Nura cannot verify clinic availability or book appointments.",
    }


@router.post("/proactive-check")
def proactive(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="The adult prevention overview requires an adult account.",
        )
    overview = _build_overview(person, db)
    return {
        "next_best_action": overview["next_best_action"],
        "today_check_in": overview["today_check_in"],
        "open_referrals": overview["open_referrals"],
        "source": "Saved profile, assessment, check-in, and referral records.",
    }


@router.post("/monitoring-plan")
def monitoring_plan(
    payload: MonitoringPlanRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("adult", "parent"):
        raise HTTPException(
            status_code=403,
            detail="This account cannot access a monitoring plan.",
        )
    population = "adult" if current_user.role == "adult" else "child"
    return build_monitoring_plan(
        {
            "population": population,
            "check_in": payload.check_in,
        }
    )

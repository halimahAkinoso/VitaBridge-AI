from datetime import date, datetime, timedelta, timezone
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import AdultClinicalReview, Person, Referral, User, WellbeingCheckIn
from app.routers.users import get_current_user
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


@router.post("/chat")
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _get_person(current_user, db)
    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="Nura's adult prevention guide requires an adult account.",
        )

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

    lowered = message.lower()
    overview = _build_overview(person, db)
    if person.language == "ar":
        if any(
            term in lowered
            for term in (
                "نتيجتي",
                "اشرح النتيجة",
                "نتائجي",
                "explain my result",
                "explain my results",
                "what is my result",
            )
        ):
            result = _clinical_result(person, db)
            if result["available"]:
                context = _reported_result_context(person)
                context_text = (
                    " تتضمن إجاباتك أيضاً: "
                    + "، ".join(context)
                    + ". قد تفيد هذه المعلومات الطبيب في فهم السياق، لكنها لا تثبت وجود سبب."
                    if context
                    else ""
                )
                reply = (
                    f"سجّل طبيبك الحالة {result['status']} ومستوى المخاطر "
                    f"{result['risk']}. هذه معلومات أدخلها الطبيب وليست "
                    "تشخيصاً أو درجة أنشأها الذكاء الاصطناعي. الخطوة "
                    f"الموصى بها: {result['recommendation']}"
                    f"{context_text}"
                )
            else:
                reply = (
                    "تم حفظ إجاباتك، لكنها بانتظار مراجعة الطبيب. لا "
                    "يحسب التطبيق حالة أو مستوى مخاطر من الاستبيان."
                )
        elif any(
            term in lowered
            for term in (
                "موا",
                "إدراكي",
                "الإدراك",
                "الفحص المعرفي",
                "الذاكرة",
                "نتيجة الفحص",
            )
        ):
            reply = (
                "لا توجد نتيجة لفحص معرفي معتمد في ملفك، لذلك لا يمكنني "
                "تفسير نتيجة أو تقدير درجة. لن يتوفر الفحص إلا بعد اعتماد "
                "أداة مناسبة والحصول على الموافقات السريرية اللازمة."
            )
        elif any(term in lowered for term in ("فاتني", "عائق", "مواصلات", "تكلفة", "حجز", "موعد", "قلق")):
            reply = (
                "لنجعل الخطوة التالية أسهل. ما العائق الأهم بالنسبة لك: "
                "الوقت، أو المواصلات، أو التكلفة، أو اللغة، أو القلق، أو "
                "شيء آخر؟ يمكنني مساعدتك في تجهيز أسئلة لفريق الرعاية، "
                "لكن لا أستطيع حجز موعد أو تأكيد توفره."
            )
        elif any(term in lowered for term in ("السمع", "النظر", "الرؤية", "الأذن", "العين")):
            reply = (
                "إجاباتك عن السمع والبصر هي معلومات تقدمها بنفسك وليست "
                "فحصاً تشخيصياً. إذا لاحظت تغيّراً، يمكنك مناقشته مع مختص "
                "صحي مؤهل."
            )
        else:
            reply = (
                "مرحباً، أنا نورة. يمكنني شرح خطوات الوقاية المسجلة "
                "ومساعدتك على التفكير في العوائق وتجهيز أسئلة لفريق الرعاية. "
                "لا أقدم تشخيصاً ولا أحجز المواعيد. خطوتك التالية: "
                f"{overview['next_best_action']['detail']}"
            )
        return {
            "reply": reply,
            "urgent_human_support": False,
            "disclaimer": "نورة دليل للمعلومات وليست بديلاً عن المختص الصحي أو التشخيص الطبي.",
        }

    if any(term in lowered for term in ("explain my result", "explain my results", "what is my result")):
        result = _clinical_result(person, db)
        if result["available"]:
            context = _reported_result_context(person)
            context_text = (
                " Your self-reported information also mentions "
                + ", ".join(context)
                + ". This may be relevant context for your clinician, but it does not establish a cause."
                if context
                else ""
            )
            reply = (
                f"Your clinician recorded status {result['status']} and "
                f"risk {result['risk']}. These were entered by your clinician; "
                "they are not an AI-generated score or diagnosis. "
                f"The recommended next step is: {result['recommendation']}."
                f"{context_text}"
            )
        else:
            reply = (
                "Your responses are saved and awaiting clinician review. "
                "VitaBridge does not calculate a status or risk level from "
                "the questionnaire."
            )
    elif any(term in lowered for term in ("moca", "cognitive score", "memory score", "screening result")):
        reply = (
            "There is no approved cognitive screening result recorded in "
            "your profile, so I cannot interpret or estimate a cognitive "
            "score. Cognitive screening will become available only when an "
            "approved instrument and clinical authorization are in place. "
            f"For now, your next step is: {overview['next_best_action']['detail']}"
        )
    elif any(term in lowered for term in ("missed", "barrier", "transport", "cost", "booking", "appointment")):
        reply = (
            "Let's make the next step easier. What is the main barrier: "
            "finding a convenient time, transport, cost, language, worry, "
            "or something else? I can help you prepare questions for your "
            "care team, but I cannot book or confirm a clinic appointment."
        )
    elif any(term in lowered for term in ("hearing", "vision", "eyes", "ears")):
        reply = (
            "Your hearing and vision answers are self-reported and do not "
            "test or diagnose a condition. If you have noticed a change, "
            "consider discussing it with a qualified healthcare professional. "
            f"{overview['next_best_action']['detail']}"
        )
    else:
        reply = (
            f"Hi, I'm Nura. Your next best action is: "
            f"{overview['next_best_action']['detail']} "
            "I can explain your saved baseline, help think through a barrier, "
            "or suggest questions to bring to your care team."
        )

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

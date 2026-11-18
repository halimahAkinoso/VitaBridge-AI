
from datetime import date, datetime, timezone
from typing import Any, Optional, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.database import get_db
from app.models import (
    AdultClinicalReview,
    User,
    Person,
    Screening,
    Referral,
    WellbeingCheckIn,
)
from app.routers.users import get_current_user
from app.services.instrument_registry import list_instruments


router = APIRouter()


# =========================================================
# COMMON DATE UTILITIES
# =========================================================

def parse_date_of_birth(value: Optional[str]) -> date:
    if not value:
        raise HTTPException(
            status_code=400,
            detail="Date of birth is missing.",
        )

    for date_format in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(value.strip(), date_format).date()
        except ValueError:
            continue

    raise HTTPException(
        status_code=400,
        detail="The saved date of birth is invalid.",
    )


def calculate_age_in_months(dob: date) -> int:
    today = date.today()

    months = (
        (today.year - dob.year) * 12
        + today.month - dob.month
    )

    if today.day < dob.day:
        months -= 1

    return months


def calculate_age_in_years(dob: date) -> int:
    today = date.today()

    years = today.year - dob.year

    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1

    return years


# =========================================================
# CHILD SCREENING REQUEST
# =========================================================

class ChildScreeningRequest(BaseModel):
    age_months: Optional[int] = Field(
        default=None,
        ge=0,
        le=120,
    )

    milestones: dict[str, Any] = Field(default_factory=dict)
    growth: dict[str, Any] = Field(default_factory=dict)
    answers: dict[str, Any] = Field(default_factory=dict)

    instrument_name: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    instrument_version: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    submission_id: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=64,
    )


# =========================================================
# ADULT PROFILE REQUEST
# =========================================================

class AdultProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    dob: date

    sex: Optional[str] = Field(default=None, max_length=30)
    nationality: Optional[str] = Field(
        default=None,
        max_length=100,
    )
    language: Literal["en", "ar"] = "en"
    education: Optional[str] = Field(default=None, max_length=100)
    culture: Optional[str] = Field(default=None, max_length=100)


# =========================================================
# ADULT BASELINE REQUEST
# =========================================================

class AdultBaselineRequest(BaseModel):
    health_conditions: list[str] = Field(default_factory=list)

    blood_pressure_history: str = Field(min_length=1, max_length=100)
    systolic_bp_mmhg: Optional[float] = Field(default=None, ge=50, le=300)
    diastolic_bp_mmhg: Optional[float] = Field(default=None, ge=30, le=200)
    blood_glucose_mmol_l: Optional[float] = Field(default=None, ge=0, le=60)
    cholesterol_mmol_l: Optional[float] = Field(default=None, ge=0, le=60)
    weight_kg: Optional[float] = Field(default=None, ge=1, le=500)
    sleep_quality: str = Field(min_length=1, max_length=100)
    sleep_hours: Optional[float] = Field(default=None, ge=0, le=24)
    snoring: Optional[str] = Field(default=None, max_length=50)
    physical_activity: str = Field(min_length=1, max_length=100)
    social_engagement: str = Field(min_length=1, max_length=100)
    everyday_function: Optional[str] = Field(default=None, max_length=100)
    mood: str = Field(min_length=1, max_length=100)
    memory_concerns: str = Field(min_length=1, max_length=150)
    family_history: Optional[str] = Field(default=None, max_length=100)

    additional_notes: str = Field(
        default="",
        max_length=1000,
    )




# =========================================================
# ADULT HEARING AND VISION REQUEST
# =========================================================

class AdultHearingVisionRequest(BaseModel):
    responses: dict[str, str] = Field(default_factory=dict)
    completed_at: Optional[str] = Field(default=None, max_length=50)


class AdultClinicalReviewRequest(BaseModel):
    decision: Literal[
        "WATCH",
        "ACT",
        "REFER",
        "MONITOR",
        "FOLLOW_UP",
    ]
    risk: Literal["NOT_ASSESSED", "LOW", "MODERATE", "ELEVATED"] = "NOT_ASSESSED"
    note: str = Field(min_length=3, max_length=2000)
    next_action: str = Field(min_length=3, max_length=255)
    referral_specialty: Optional[str] = Field(default=None, max_length=100)


# =========================================================
# CHILD CLINICIAN REVIEW REQUEST
# =========================================================

class ChildReviewRequest(BaseModel):
    decision: Literal["MONITOR", "FOLLOW_UP", "REFER"]

    clinician_note: str = Field(
        min_length=3,
        max_length=2000,
    )

    next_action: str = Field(
        min_length=3,
        max_length=255,
    )

    risk: Literal[
        "NOT_ASSESSED",
        "FOLLOW_UP_RECOMMENDED",
        "URGENT_REVIEW",
    ]

    referral_specialty: Optional[str] = Field(
        default=None,
        max_length=100,
    )


# =========================================================
# REFERRAL STATUS REQUEST
# =========================================================

class ReferralStatusRequest(BaseModel):
    status: Literal[
        "OPEN",
        "SCHEDULED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
    ]


# =========================================================
# ACCESS CONTROL
# =========================================================

def get_parent_child(
    current_user: User,
    db: Session,
) -> Person:

    if current_user.role != "parent":
        raise HTTPException(
            status_code=403,
            detail="A parent account is required for child screening.",
        )

    child = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == "child",
        )
        .order_by(Person.id.asc())
        .first()
    )

    if not child:
        raise HTTPException(
            status_code=404,
            detail="Complete the child profile before screening.",
        )

    return child


def get_adult_person(
    current_user: User,
    db: Session,
) -> Person:

    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="An adult account is required.",
        )

    person = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == "adult",
        )
        .order_by(Person.id.asc())
        .first()
    )

    return person


def require_clinician(current_user: User):

    if current_user.role not in ("doctor", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Authorised clinician access is required.",
        )


def verify_child_eligibility(child: Person) -> int:

    dob = parse_date_of_birth(child.dob)
    age_months = calculate_age_in_months(dob)

    if age_months < 1 or age_months > 72:
        raise HTTPException(
            status_code=403,
            detail=(
                "This child is outside the developmental "
                "screening age range of 1 to 72 completed months."
            ),
        )

    return age_months


def validate_adult_eligibility(dob: date) -> int:

    if dob > date.today():
        raise HTTPException(
            status_code=400,
            detail="Date of birth cannot be in the future.",
        )

    age = calculate_age_in_years(dob)

    if age < 50 or age > 75:
        raise HTTPException(
            status_code=403,
            detail=(
                "The VitaBridge adult screening pathway "
                "is available for ages 50 to 75."
            ),
        )

    return age


# =========================================================
# SCREENING SERIALIZATION
# =========================================================

def serialize_screening(record: Screening) -> dict:

    return {
        "id": record.id,
        "person_id": record.person_id,
        "kind": record.kind,
        "visit_no": record.visit_no,
        "age_months": (
            record.visit_no
            if record.kind == "CHILD_DEVELOPMENT"
            else None
        ),
        "scores": record.scores or {},
        "raw_answers": record.raw_answers or {},
        "risk": record.risk,
        "status": record.status,
        "ai_summary": record.ai_summary,
        "next_action": record.next_action,
        "clinician_reviewed": record.clinician_reviewed,
        "created_at": (
            record.created_at.isoformat()
            if record.created_at
            else None
        ),
    }


# =========================================================
# CHILD DEVELOPMENT SCREENING
# =========================================================

@router.post("/child")
def child_screen(
    payload: ChildScreeningRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    child = get_parent_child(current_user, db)

    actual_age_months = verify_child_eligibility(child)

    if (
        payload.age_months is not None
        and payload.age_months != actual_age_months
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The submitted age does not match the child's "
                "saved date of birth. Refresh the profile."
            ),
        )

    raw_answers = {
        "milestones": payload.milestones,
        "growth": payload.growth,
        "answers": payload.answers,
        "instrument_name": payload.instrument_name,
        "instrument_version": payload.instrument_version,
        "notes": payload.notes,
    }

    if payload.submission_id:
        existing = (
            db.query(Screening)
            .filter(Screening.submission_id == payload.submission_id)
            .first()
        )
        if existing:
            if (
                existing.person_id != child.id
                or existing.raw_answers != raw_answers
            ):
                raise HTTPException(
                    status_code=409,
                    detail="This submission ID has already been used for different responses.",
                )
            return {
                "message": "Child screening record already saved.",
                "screening": serialize_screening(existing),
                "clinical_assessment_completed": False,
                "review_required": True,
            }

    record = Screening(
        person_id=child.id,
        kind="CHILD_DEVELOPMENT",
        visit_no=actual_age_months,
        scores={},
        raw_answers=raw_answers,
        risk="NOT_ASSESSED",
        status="PENDING_REVIEW",
        ai_summary=None,
        modifiable_factors=[],
        next_action=(
            "Await review by an authorised healthcare professional."
        ),
        clinician_reviewed=False,
        submission_id=payload.submission_id,
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)

    except IntegrityError:
        db.rollback()
        if not payload.submission_id:
            raise HTTPException(
                status_code=500,
                detail="Unable to save the child screening record.",
            )

        existing = (
            db.query(Screening)
            .filter(Screening.submission_id == payload.submission_id)
            .first()
        )
        if (
            existing
            and existing.person_id == child.id
            and existing.raw_answers == raw_answers
        ):
            return {
                "message": "Child screening record already saved.",
                "screening": serialize_screening(existing),
                "clinical_assessment_completed": False,
                "review_required": True,
            }
        raise HTTPException(
            status_code=409,
            detail="This observation has already been submitted.",
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the child screening record.",
        )

    return {
        "message": "Child screening record saved successfully.",
        "screening": serialize_screening(record),
        "clinical_assessment_completed": False,
        "review_required": True,
    }


@router.get("/instruments")
def screening_instruments(
    pathway: Optional[Literal["child", "adult"]] = None,
    current_user: User = Depends(get_current_user),
):
    role_pathway = {
        "parent": "child",
        "adult": "adult",
    }.get(current_user.role)

    if current_user.role in ("doctor", "admin"):
        allowed = {"child", "adult"}
    elif role_pathway:
        allowed = {role_pathway}
    else:
        raise HTTPException(
            status_code=403,
            detail="This account cannot access screening instruments.",
        )

    requested = {pathway} if pathway else allowed
    if not requested.issubset(allowed):
        raise HTTPException(
            status_code=403,
            detail="This account cannot access that screening pathway.",
        )

    instruments = []
    if "child" in requested:
        instruments = [
            {
                **instrument,
                "pathway": "child",
                "available": instrument["status"] == "active_prototype",
            }
            for instrument in list_instruments()
        ]

    return {
        "pathway": pathway,
        "instruments": instruments,
    }


# =========================================================
# ADULT PROFILE
# =========================================================

@router.get("/adult/profile")
def get_adult_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    person = get_adult_person(current_user, db)

    if not person:
        return {
            "profile_complete": False,
            "eligible": False,
            "profile": None,
        }

    dob = parse_date_of_birth(person.dob)
    age = validate_adult_eligibility(dob)

    complete = bool(
        person.name
        and person.dob
        and person.sex
    )

    return {
        "profile_complete": complete,
        "eligible": True,
        "age": age,
        "profile": {
            "id": person.id,
            "name": person.name,
            "dob": person.dob,
            "sex": person.sex,
            "nationality": person.nationality,
            "language": person.language,
            "education": person.education,
            "culture": person.culture,
            "hearing": person.hearing,
            "vision": person.vision,
            "baseline": person.baseline or {},
        },
    }


@router.put("/adult/profile")
def save_adult_profile(
    payload: AdultProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="An adult account is required.",
        )

    age = validate_adult_eligibility(payload.dob)

    person = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == "adult",
        )
        .first()
    )

    if not person:
        person = Person(
            owner_id=current_user.id,
            type="adult",
            baseline={},
        )
        db.add(person)

    person.name = payload.name.strip()
    person.dob = payload.dob.isoformat()
    person.sex = payload.sex
    person.nationality = payload.nationality
    person.language = payload.language
    fields_set = (
        payload.model_fields_set
        if hasattr(payload, "model_fields_set")
        else payload.__fields_set__
    )
    if "education" in fields_set:
        person.education = payload.education
    if "culture" in fields_set:
        person.culture = payload.culture

    if person.baseline is None:
        person.baseline = {}

    try:
        db.commit()
        db.refresh(person)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the adult profile.",
        )

    return {
        "message": "Adult profile saved successfully.",
        "profile_complete": True,
        "eligible": True,
        "age": age,
        "profile": {
            "id": person.id,
            "name": person.name,
            "dob": person.dob,
            "sex": person.sex,
            "nationality": person.nationality,
            "language": person.language,
            "education": person.education,
            "culture": person.culture,
        },
    }


# =========================================================
# ADULT BASELINE ASSESSMENT
# =========================================================

ADULT_BASELINE_TITLES = {
    "adult_health_assessment": "Health and wellbeing baseline",
    "adult_hearing_vision": "Hearing and vision",
}


def append_adult_assessment_history(
    baseline: dict[str, Any],
    assessment_id: str,
    title: str,
    responses: dict[str, Any],
    completed_at: str,
) -> None:
    history = baseline.get("adult_assessment_history")
    if not isinstance(history, list):
        history = []

    if not history:
        for legacy_id, legacy_title in ADULT_BASELINE_TITLES.items():
            legacy = baseline.get(legacy_id)
            if not isinstance(legacy, dict):
                continue
            legacy_responses = (
                legacy.get("responses", {})
                if legacy_id == "adult_hearing_vision"
                else {
                    key: value
                    for key, value in legacy.items()
                    if key != "completed_at" and value is not None and value != ""
                }
            )
            history.append(
                {
                    "id": f"legacy-{legacy_id}",
                    "assessment": legacy_id,
                    "title": legacy_title,
                    "completed_at": legacy.get("completed_at"),
                    "responses": (
                        legacy_responses
                        if isinstance(legacy_responses, dict)
                        else {}
                    ),
                    "status": legacy.get("status", "COMPLETED"),
                    "clinical_score_generated": False,
                }
            )

    history.append(
        {
            "id": uuid4().hex,
            "assessment": assessment_id,
            "title": title,
            "completed_at": completed_at,
            "responses": responses,
            "status": "COMPLETED",
            "clinical_score_generated": False,
        }
    )
    baseline["adult_assessment_history"] = history


@router.post("/adult/baseline")
def save_adult_baseline(
    payload: AdultBaselineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    person = get_adult_person(current_user, db)

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Complete your adult profile first.",
        )

    if not person.dob:
        raise HTTPException(
            status_code=400,
            detail="Your date of birth is missing.",
        )

    validate_adult_eligibility(
        parse_date_of_birth(person.dob)
    )

    baseline = dict(person.baseline or {})

    assessment = (
        payload.model_dump()
        if hasattr(payload, "model_dump")
        else payload.dict()
    )
    assessment["completed_at"] = datetime.now(timezone.utc).isoformat()
    append_adult_assessment_history(
        baseline,
        "adult_health_assessment",
        ADULT_BASELINE_TITLES["adult_health_assessment"],
        {
            key: value
            for key, value in assessment.items()
            if key != "completed_at" and value is not None and value != ""
        },
        assessment["completed_at"],
    )
    baseline["adult_health_assessment"] = assessment

    person.baseline = baseline

    try:
        db.commit()
        db.refresh(person)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the adult baseline assessment.",
        )

    return {
        "success": True,
        "message": "Adult baseline assessment saved.",
        "assessment": "adult_health_assessment",
        "clinical_score_generated": False,
    }




# =========================================================
# ADULT HEARING AND VISION SCREENING
# =========================================================

@router.post("/adult/hearing-vision")
def save_adult_hearing_vision(
    payload: AdultHearingVisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = get_adult_person(current_user, db)

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Complete your adult profile first.",
        )

    if not person.dob:
        raise HTTPException(
            status_code=400,
            detail="Your date of birth is missing.",
        )

    validate_adult_eligibility(
        parse_date_of_birth(person.dob)
    )

    if not payload.responses:
        raise HTTPException(
            status_code=422,
            detail="At least one hearing or vision response is required.",
        )

    baseline = dict(person.baseline or {})
    completed_at = payload.completed_at or datetime.now(timezone.utc).isoformat()
    assessment = {
        "responses": payload.responses,
        "completed_at": completed_at,
        "status": "COMPLETED",
        "clinical_score_generated": False,
    }
    append_adult_assessment_history(
        baseline,
        "adult_hearing_vision",
        ADULT_BASELINE_TITLES["adult_hearing_vision"],
        payload.responses,
        completed_at,
    )
    baseline["adult_hearing_vision"] = assessment

    person.baseline = baseline

    try:
        db.commit()
        db.refresh(person)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save hearing and vision responses.",
        )

    return {
        "success": True,
        "message": "Hearing and vision responses saved.",
        "assessment": "adult_hearing_vision",
        "clinical_score_generated": False,
    }


@router.get("/adult/history")
def adult_screening_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = get_adult_person(current_user, db)

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Complete your adult profile before viewing history.",
        )

    baseline = person.baseline or {}
    history = baseline.get("adult_assessment_history")
    assessments = (
        [item for item in history if isinstance(item, dict)]
        if isinstance(history, list) and history
        else []
    )

    if not assessments:
        for assessment_id, title in ADULT_BASELINE_TITLES.items():
            assessment = baseline.get(assessment_id)
            if not isinstance(assessment, dict):
                continue

            responses = (
                assessment.get("responses", {})
                if assessment_id == "adult_hearing_vision"
                else {
                    key: value
                    for key, value in assessment.items()
                    if key != "completed_at" and value is not None and value != ""
                }
            )
            assessments.append(
                {
                    "id": f"legacy-{assessment_id}",
                    "assessment": assessment_id,
                    "title": title,
                    "completed_at": assessment.get("completed_at"),
                    "responses": (
                        responses if isinstance(responses, dict) else {}
                    ),
                    "status": assessment.get("status", "COMPLETED"),
                    "clinical_score_generated": False,
                }
            )

    screening_records = (
        db.query(Screening)
        .filter(Screening.person_id == person.id)
        .order_by(Screening.created_at.desc())
        .all()
    )

    for record in screening_records:
        raw_answers = record.raw_answers or {}
        responses = (
            raw_answers.get("answers", raw_answers)
            if isinstance(raw_answers, dict)
            else {}
        )
        assessments.append(
            {
                "id": f"screening-{record.id}",
                "assessment": record.kind,
                "title": record.kind.replace("_", " ").title(),
                "completed_at": (
                    record.created_at.isoformat()
                    if record.created_at
                    else None
                ),
                "responses": responses if isinstance(responses, dict) else {},
                "status": record.status,
                "clinical_score_generated": bool(record.scores),
            }
        )

    check_ins = (
        db.query(WellbeingCheckIn)
        .filter(WellbeingCheckIn.person_id == person.id)
        .order_by(WellbeingCheckIn.local_date.desc())
        .all()
    )
    for check_in in check_ins:
        responses = {}
        if check_in.sleep_hours is not None:
            responses["sleep_hours"] = check_in.sleep_hours
        if check_in.mood_score is not None:
            responses["mood_score"] = check_in.mood_score
        assessments.append(
            {
                "id": f"check-in-{check_in.id}",
                "assessment": "daily_checkin",
                "title": "Daily wellbeing check-in",
                "completed_at": (
                    check_in.created_at.isoformat()
                    if check_in.created_at
                    else check_in.local_date
                ),
                "responses": responses,
                "status": "RECORDED",
                "clinical_score_generated": False,
            }
        )

    clinical_reviews = (
        db.query(AdultClinicalReview, User.name)
        .join(User, AdultClinicalReview.reviewer_id == User.id)
        .filter(AdultClinicalReview.person_id == person.id)
        .order_by(AdultClinicalReview.created_at.desc())
        .all()
    )
    for review, reviewer_name in clinical_reviews:
        assessments.append(
            {
                "id": f"clinical-review-{review.id}",
                "assessment": "adult_clinical_review",
                "title": "Clinician review and recommendations",
                "completed_at": (
                    review.created_at.isoformat()
                    if review.created_at
                    else None
                ),
                "responses": {
                    "decision": review.decision,
                    "clinician_assigned_risk": review.risk,
                    "recommendation": review.next_action,
                    "clinician_note": review.note,
                    "reviewed_by": reviewer_name,
                    "referral_specialty": review.referral_specialty,
                },
                "status": "CLINICIAN_REVIEWED",
                "clinical_score_generated": False,
            }
        )

    assessments.sort(
        key=lambda item: item["completed_at"] or "",
        reverse=True,
    )

    return {
        "person_id": person.id,
        "person_name": person.name,
        "assessment_count": len(assessments),
        "assessments": assessments,
    }


# =========================================================
# ADULT CLINICAL REVIEW
# =========================================================

@router.get("/clinician/adult-queue")
def adult_clinician_queue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_clinician(current_user)
    people = (
        db.query(Person)
        .filter(Person.type == "adult")
        .order_by(Person.created_at.asc())
        .all()
    )
    queue = []
    for person in people:
        baseline = person.baseline or {}
        adult_assessment = baseline.get("adult_health_assessment")
        sensory_assessment = baseline.get("adult_hearing_vision")
        if not adult_assessment and not sensory_assessment:
            continue

        latest_review = (
            db.query(AdultClinicalReview)
            .filter(AdultClinicalReview.person_id == person.id)
            .order_by(AdultClinicalReview.created_at.desc())
            .first()
        )
        queue.append(
            {
                "person_id": person.id,
                "name": person.name,
                "dob": person.dob,
                "language": person.language,
                "baseline": adult_assessment or {},
                "hearing_vision": sensory_assessment or {},
                "latest_review": (
                    {
                        "decision": latest_review.decision,
                        "risk": latest_review.risk,
                        "note": latest_review.note,
                        "next_action": latest_review.next_action,
                        "created_at": (
                            latest_review.created_at.isoformat()
                            if latest_review.created_at
                            else None
                        ),
                    }
                    if latest_review
                    else None
                ),
            }
        )
    return {
        "adults": queue,
        "count": len(queue),
        "disclaimer": "Review self-reported information clinically. The system does not generate cognitive scores or risk classifications.",
    }


@router.post("/clinician/adult-review/{person_id}")
def create_adult_clinical_review(
    person_id: int,
    payload: AdultClinicalReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_clinician(current_user)
    person = (
        db.query(Person)
        .filter(Person.id == person_id, Person.type == "adult")
        .first()
    )
    if not person:
        raise HTTPException(
            status_code=404,
            detail="Adult profile not found.",
        )
    if payload.decision == "REFER" and not payload.referral_specialty:
        raise HTTPException(
            status_code=422,
            detail="A referral specialty is required for a referral.",
        )

    review = AdultClinicalReview(
        person_id=person.id,
        reviewer_id=current_user.id,
        decision=payload.decision,
        risk=payload.risk,
        note=payload.note.strip(),
        next_action=payload.next_action.strip(),
        referral_specialty=payload.referral_specialty,
    )
    db.add(review)
    referral = None
    if payload.decision == "REFER":
        referral = Referral(
            person_id=person.id,
            specialty=payload.referral_specialty,
            reason=payload.note.strip(),
            status="OPEN",
        )
        db.add(referral)

    try:
        db.commit()
        db.refresh(review)
        if referral:
            db.refresh(referral)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the clinician review.",
        ) from error

    return {
        "success": True,
        "review": {
            "id": review.id,
            "decision": review.decision,
            "risk": review.risk,
            "note": review.note,
            "next_action": review.next_action,
            "created_at": (
                review.created_at.isoformat()
                if review.created_at
                else None
            ),
        },
        "referral": (
            {
                "id": referral.id,
                "specialty": referral.specialty,
                "status": referral.status,
            }
            if referral
            else None
        ),
    }


# =========================================================
# ADULT COGNITIVE SCREENING
# =========================================================

@router.post("/adult")
def adult_screen(
    current_user: User = Depends(get_current_user),
):
    """
    Cognitive assessment is intentionally gated.

    Do not generate MoCA scores from defaults or
    unvalidated questionnaires.
    """

    if current_user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="An adult account is required.",
        )

    raise HTTPException(
        status_code=403,
        detail=(
            "Cognitive screening is not yet enabled. "
            "The required instrument permissions and "
            "clinical approvals must be in place first."
        ),
    )


# =========================================================
# CHILD CLINICIAN REVIEW QUEUE
# =========================================================

@router.get("/clinician/child-queue")
def get_child_clinician_queue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    require_clinician(current_user)

    rows = (
        db.query(Screening, Person)
        .join(Person, Screening.person_id == Person.id)
        .filter(
            Screening.kind == "CHILD_DEVELOPMENT",
            Screening.clinician_reviewed == False,
        )
        .order_by(Screening.created_at.asc())
        .all()
    )

    queue = []

    for record, person in rows:
        item = serialize_screening(record)
        item["person_name"] = person.name
        item["date_of_birth"] = person.dob
        item["review_status"] = "PENDING"
        queue.append(item)

    return {
        "count": len(queue),
        "queue": queue,
    }


# =========================================================
# CHILD CLINICIAN REVIEW SUBMISSION
# =========================================================

@router.post("/clinician/child-review/{screening_id}")
def review_child_screening(
    screening_id: int,
    payload: ChildReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    require_clinician(current_user)

    record = (
        db.query(Screening)
        .filter(
            Screening.id == screening_id,
            Screening.kind == "CHILD_DEVELOPMENT",
        )
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Child screening record not found.",
        )

    if record.clinician_reviewed:
        raise HTTPException(
            status_code=409,
            detail="This screening has already been reviewed.",
        )

    if payload.decision == "REFER" and not payload.referral_specialty:
        raise HTTPException(
            status_code=400,
            detail="A referral specialty is required.",
        )

    record.ai_summary = (
        "Clinician review: " + payload.clinician_note
    )
    record.next_action = payload.next_action
    record.risk = payload.risk
    record.status = "REVIEWED"
    record.clinician_reviewed = True

    try:
        if payload.decision == "REFER":
            referral = Referral(
                person_id=record.person_id,
                specialty=payload.referral_specialty,
                reason=payload.clinician_note,
                status="OPEN",
            )
            db.add(referral)

        db.commit()
        db.refresh(record)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save clinician review.",
        )

    return {
        "message": "Child screening review saved.",
        "screening": serialize_screening(record),
        "decision": payload.decision,
        "referral_created": payload.decision == "REFER",
    }


# =========================================================
# REFERRAL TRACKING
# =========================================================

@router.get("/referrals")
def get_referral_tracking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if current_user.role == "parent":
        people = (
            db.query(Person)
            .filter(
                Person.owner_id == current_user.id,
                Person.type == "child",
            )
            .all()
        )

        person_ids = [person.id for person in people]

        query = db.query(Referral).filter(
            Referral.person_id.in_(person_ids)
        ) if person_ids else db.query(Referral).filter(
            Referral.person_id == -1
        )

    elif current_user.role == "adult":
        people = (
            db.query(Person)
            .filter(
                Person.owner_id == current_user.id,
                Person.type == "adult",
            )
            .all()
        )

        person_ids = [person.id for person in people]

        query = db.query(Referral).filter(
            Referral.person_id.in_(person_ids)
        ) if person_ids else db.query(Referral).filter(
            Referral.person_id == -1
        )

    elif current_user.role in ("doctor", "admin"):
        query = db.query(Referral)

    else:
        raise HTTPException(
            status_code=403,
            detail="You cannot access referral records.",
        )

    referrals = query.order_by(
        Referral.created_at.desc()
    ).all()

    result = []

    for referral in referrals:
        person = db.query(Person).filter(
            Person.id == referral.person_id
        ).first()

        result.append({
            "id": referral.id,
            "person_id": referral.person_id,
            "person_name": person.name if person else None,
            "specialty": referral.specialty,
            "reason": referral.reason,
            "status": referral.status,
            "created_at": (
                referral.created_at.isoformat()
                if referral.created_at
                else None
            ),
        })

    return {
        "count": len(result),
        "referrals": result,
    }


# =========================================================
# UPDATE REFERRAL STATUS
# =========================================================

@router.patch("/clinician/referrals/{referral_id}")
def update_referral_status(
    referral_id: int,
    payload: ReferralStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    require_clinician(current_user)

    referral = (
        db.query(Referral)
        .filter(Referral.id == referral_id)
        .first()
    )

    if not referral:
        raise HTTPException(
            status_code=404,
            detail="Referral not found.",
        )

    referral.status = payload.status

    try:
        db.commit()
        db.refresh(referral)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update referral status.",
        )

    return {
        "message": "Referral status updated.",
        "referral_id": referral.id,
        "status": referral.status,
    }


# =========================================================
# SCREENING HISTORY
# =========================================================

def retrieve_screening_history(
    person_id: int,
    current_user: User,
    db: Session,
) -> dict:

    expected_type = (
        "adult"
        if current_user.role == "adult"
        else "child"
        if current_user.role == "parent"
        else None
    )

    if expected_type is None:
        raise HTTPException(
            status_code=403,
            detail="This account cannot access screening history.",
        )

    person = (
        db.query(Person)
        .filter(
            Person.id == person_id,
            Person.owner_id == current_user.id,
            Person.type == expected_type,
        )
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=404,
            detail="The requested profile was not found.",
        )

    records = (
        db.query(Screening)
        .filter(Screening.person_id == person.id)
        .order_by(Screening.created_at.desc())
        .all()
    )

    return {
        "person_id": person.id,
        "person_name": person.name,
        "screening_count": len(records),
        "history": [
            serialize_screening(record)
            for record in records
        ],
    }


@router.get("/history")
def my_screening_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    expected_type = (
        "adult"
        if current_user.role == "adult"
        else "child"
        if current_user.role == "parent"
        else None
    )

    if expected_type is None:
        raise HTTPException(
            status_code=403,
            detail="This account cannot access screening history.",
        )

    person = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == expected_type,
        )
        .order_by(Person.id.asc())
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Complete the profile before viewing history.",
        )

    return retrieve_screening_history(
        person.id,
        current_user,
        db,
    )


@router.get("/history/{person_id}")
def history(
    person_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    return retrieve_screening_history(
        person_id,
        current_user,
        db,
    )

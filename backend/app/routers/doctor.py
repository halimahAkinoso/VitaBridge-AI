
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User, Person, Screening, Referral
from app.routers.users import get_current_user


router = APIRouter()


# ============================================================
# PRACTITIONER AUTHENTICATION
# ============================================================

def require_practitioner(
    current_user: User = Depends(get_current_user),
):
    """
    Only authenticated doctors and administrators
    can access practitioner endpoints.
    """

    if current_user.role not in ("doctor", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Practitioner access required.",
        )

    return current_user


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_age(dob):
    if not dob:
        return None

    try:
        birth_date = date.fromisoformat(str(dob)[:10])
        today = date.today()

        years = today.year - birth_date.year

        if (today.month, today.day) < (
            birth_date.month,
            birth_date.day,
        ):
            years -= 1

        return max(years, 0)

    except (ValueError, TypeError):
        return None


def serialize_screening(record: Screening, person: Person):
    return {
        "id": record.id,
        "person_id": person.id,
        "person_name": person.name,
        "age": calculate_age(person.dob),
        "type": person.type,
        "kind": record.kind,
        "visit_no": record.visit_no,
        "risk": record.risk,
        "status": record.status,
        "clinician_reviewed": record.clinician_reviewed,
        "next_action": record.next_action,
        "created_at": (
            record.created_at.isoformat()
            if record.created_at else None
        ),
    }


# ============================================================
# PRACTITIONER DASHBOARD
# GET /api/doctor/dashboard
# ============================================================

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    practitioner: User = Depends(require_practitioner),
):
    total_patients = db.query(Person).count()

    total_screenings = db.query(Screening).count()

    pending_reviews = (
        db.query(Screening)
        .filter(Screening.clinician_reviewed.is_(False))
        .count()
    )

    completed_reviews = (
        db.query(Screening)
        .filter(Screening.clinician_reviewed.is_(True))
        .count()
    )

    open_referrals = (
        db.query(Referral)
        .filter(Referral.status == "OPEN")
        .count()
    )

    recent_records = (
        db.query(Screening, Person)
        .join(Person, Screening.person_id == Person.id)
        .order_by(Screening.created_at.desc())
        .limit(20)
        .all()
    )

    pending_records = (
        db.query(Screening, Person)
        .join(Person, Screening.person_id == Person.id)
        .filter(Screening.clinician_reviewed.is_(False))
        .order_by(Screening.created_at.asc())
        .limit(20)
        .all()
    )

    return {
        "doctor": practitioner.name,
        "stats": {
            "total_patients": total_patients,
            "total_screenings": total_screenings,
            "needs_action": pending_reviews,
            "completed_reviews": completed_reviews,
            "open_referrals": open_referrals,
        },
        "priority": [
            serialize_screening(record, person)
            for record, person in pending_records
        ],
        "all_patients": [
            serialize_screening(record, person)
            for record, person in recent_records
        ],
    }


# ============================================================
# INDIVIDUAL SCREENING DETAILS
# GET /api/doctor/screening/{screening_id}
# ============================================================

@router.get("/screening/{screening_id}")
def get_screening_detail(
    screening_id: int,
    db: Session = Depends(get_db),
    practitioner: User = Depends(require_practitioner),
):
    result = (
        db.query(Screening, Person)
        .join(Person, Screening.person_id == Person.id)
        .filter(Screening.id == screening_id)
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Screening record not found.",
        )

    record, person = result

    return {
        "id": record.id,
        "person": {
            "id": person.id,
            "name": person.name,
            "date_of_birth": person.dob,
            "sex": person.sex,
            "type": person.type,
        },
        "screening": {
            "kind": record.kind,
            "visit_no": record.visit_no,
            "risk": record.risk,
            "status": record.status,
            "scores": record.scores or {},
            "raw_answers": record.raw_answers or {},
            "ai_summary": record.ai_summary,
            "next_action": record.next_action,
            "clinician_reviewed": record.clinician_reviewed,
            "created_at": (
                record.created_at.isoformat()
                if record.created_at else None
            ),
        },
    }


# ============================================================
# PRACTITIONER REVIEW REQUEST
# ============================================================

class ReviewRequest(BaseModel):
    decision: str = Field(
        min_length=2,
        max_length=50,
    )

    note: str = Field(
        min_length=1,
        max_length=180,
    )


# ============================================================
# SAVE PRACTITIONER REVIEW
# POST /api/doctor/review/{screening_id}
# ============================================================

@router.post("/review/{screening_id}")
def review(
    screening_id: int,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    practitioner: User = Depends(require_practitioner),
):
    record = (
        db.query(Screening)
        .filter(Screening.id == screening_id)
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Screening record not found.",
        )

    if record.clinician_reviewed:
        raise HTTPException(
            status_code=409,
            detail="This screening has already been reviewed.",
        )

    # The current model has no dedicated review-decision
    # or review-notes columns. Store a short interim
    # summary in the existing next_action field.
    record.clinician_reviewed = True
    record.status = "REVIEWED"
    record.next_action = (
        f"{payload.decision.strip()}: {payload.note.strip()}"
    )[:255]

    try:
        db.commit()
        db.refresh(record)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to save practitioner review.",
        )

    return {
        "screening_id": record.id,
        "clinician_reviewed": record.clinician_reviewed,
        "decision": payload.decision,
        "message": "Practitioner review recorded successfully.",
        "reviewed_by": practitioner.name,
    }


# ============================================================
# REFERRAL REQUEST
# ============================================================

class ReferralRequest(BaseModel):
    specialty: str = Field(
        min_length=2,
        max_length=100,
    )

    reason: str = Field(
        min_length=3,
        max_length=2000,
    )


# ============================================================
# CREATE REFERRAL
# POST /api/doctor/referral/{person_id}
# ============================================================

@router.post("/referral/{person_id}")
def referral(
    person_id: int,
    payload: ReferralRequest,
    db: Session = Depends(get_db),
    practitioner: User = Depends(require_practitioner),
):
    person = (
        db.query(Person)
        .filter(Person.id == person_id)
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found.",
        )

    new_referral = Referral(
        person_id=person_id,
        specialty=payload.specialty.strip(),
        reason=payload.reason.strip(),
        status="OPEN",
    )

    try:
        db.add(new_referral)
        db.commit()
        db.refresh(new_referral)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to create referral.",
        )

    return {
        "id": new_referral.id,
        "person_id": person_id,
        "specialty": new_referral.specialty,
        "reason": new_referral.reason,
        "status": new_referral.status,
        "message": "Referral created successfully.",
    }

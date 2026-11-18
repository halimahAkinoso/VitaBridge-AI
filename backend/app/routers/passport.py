from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Person, Referral, Screening, User
from app.routers.users import get_current_user

router = APIRouter()


def _owned_person(
    person_id: int,
    current_user: User,
    db: Session,
) -> Person:
    expected_type = (
        "adult" if current_user.role == "adult"
        else "child" if current_user.role == "parent"
        else None
    )
    if not expected_type:
        raise HTTPException(
            status_code=403,
            detail="This account cannot access a family health passport.",
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
            detail="The requested family member was not found.",
        )
    return person


def _passport_member(person: Person, db: Session) -> dict:
    baseline = person.baseline or {}
    records = (
        db.query(Screening)
        .filter(Screening.person_id == person.id)
        .order_by(Screening.created_at.desc())
        .all()
    )
    referrals = (
        db.query(Referral)
        .filter(
            Referral.person_id == person.id,
            Referral.status.notin_(("COMPLETED", "CANCELLED")),
        )
        .order_by(Referral.created_at.asc())
        .all()
    )

    completed = []
    due = []
    if person.type == "adult":
        if baseline.get("adult_health_assessment"):
            completed.append("Health and wellbeing baseline")
        else:
            due.append("Health and wellbeing baseline")
        if baseline.get("adult_hearing_vision"):
            completed.append("Hearing and vision")
        else:
            due.append("Hearing and vision")
        due.append("Cognitive screening (approved instrument pending)")
    else:
        if records:
            completed.append(f"{len(records)} developmental observation(s)")
        else:
            due.append("Developmental observation")

    care_gaps = [
        f"Follow up on {referral.specialty or 'healthcare'} referral ({referral.status.lower()})"
        for referral in referrals
    ]
    return {
        "person_id": person.id,
        "name": person.name,
        "type": person.type,
        "completed": completed,
        "due": due,
        "care_gaps": care_gaps,
        "screening_record_count": len(records),
        "referrals": [
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
        "updated_at": max(
            [
                value.isoformat()
                for value in [
                    record.created_at for record in records
                ] + [
                    referral.created_at for referral in referrals
                ]
                if value
            ],
            default=None,
        ),
    }


@router.get("/{person_id:int}")
def passport(
    person_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = _owned_person(person_id, current_user, db)
    member = _passport_member(person, db)
    return {
        "passport": "Family Health Passport",
        "member": member,
        "disclaimer": "The passport summarizes recorded preventive care; it is not a diagnosis.",
    }


@router.get("/family/me")
def my_family(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("adult", "parent"):
        raise HTTPException(
            status_code=403,
            detail="This account cannot access a family health passport.",
        )
    people = (
        db.query(Person)
        .filter(Person.owner_id == current_user.id)
        .order_by(Person.id.asc())
        .all()
    )
    members = [_passport_member(person, db) for person in people]
    return {
        "family": members,
        "updated_at": max(
            (item["updated_at"] for item in members if item["updated_at"]),
            default=None,
        ),
        "disclaimer": "Only recorded information is shown. Missing data does not mean a screening was missed.",
    }


@router.get("/family/{owner_id}")
def family(
    owner_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own family health passport.",
        )
    if current_user.role not in ("adult", "parent"):
        raise HTTPException(
            status_code=403,
            detail="This account cannot access a family health passport.",
        )
    people = (
        db.query(Person)
        .filter(Person.owner_id == current_user.id)
        .order_by(Person.id.asc())
        .all()
    )
    members = [_passport_member(person, db) for person in people]
    return {
        "family": members,
        "updated_at": max(
            (item["updated_at"] for item in members if item["updated_at"]),
            default=None,
        ),
        "disclaimer": "Only recorded information is shown. Missing data does not mean a screening was missed.",
    }

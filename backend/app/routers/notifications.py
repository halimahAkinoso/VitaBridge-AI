from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Person, Referral, Screening, User, WellbeingCheckIn
from app.routers.users import get_current_user

router = APIRouter()
ABU_DHABI = timezone(timedelta(hours=4), name="Asia/Abu_Dhabi")


@router.get("/{person_id}")
def notifs(
    person_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expected_type = (
        "adult" if current_user.role == "adult"
        else "child" if current_user.role == "parent"
        else None
    )
    if not expected_type:
        raise HTTPException(
            status_code=403,
            detail="This account cannot view preventive-care notifications.",
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

    notifications = []
    baseline = person.baseline or {}
    if person.type == "adult":
        if not baseline.get("adult_health_assessment"):
            notifications.append(
                {
                    "id": "adult-baseline",
                    "title": "Build your health baseline",
                    "body": "Complete your self-reported health and wellbeing baseline when you are ready.",
                    "action": "/adult/screening/baseline",
                }
            )
        if not baseline.get("adult_hearing_vision"):
            notifications.append(
                {
                    "id": "adult-hearing-vision",
                    "title": "Hearing and vision",
                    "body": "Record your hearing and vision experiences.",
                    "action": "/adult/screening/hearing-vision",
                }
            )
        today = datetime.now(ABU_DHABI).date().isoformat()
        checkin = (
            db.query(WellbeingCheckIn)
            .filter(
                WellbeingCheckIn.person_id == person.id,
                WellbeingCheckIn.local_date == today,
            )
            .first()
        )
        if not checkin:
            notifications.append(
                {
                    "id": "adult-daily-checkin",
                    "title": "Your morning check-in",
                    "body": "Record your sleep and mood today; this is optional and is not a medical assessment.",
                    "action": "/adult/check-in",
                }
            )
    else:
        observation_count = (
            db.query(Screening)
            .filter(Screening.person_id == person.id)
            .count()
        )
        if observation_count == 0:
            notifications.append(
                {
                    "id": "child-observation",
                    "title": "Developmental observation",
                    "body": "Record a caregiver observation when it is convenient.",
                    "action": "/screening/child",
                }
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
    for referral in referrals:
        notifications.append(
            {
                "id": f"referral-{referral.id}",
                "title": f"{referral.specialty or 'Healthcare'} follow-up",
                "body": f"Referral status: {referral.status.replace('_', ' ').lower()}. Contact your care team for next steps.",
                "action": "/screening/referrals",
            }
        )

    return {
        "notifications": notifications,
        "generated_at": datetime.now(ABU_DHABI).isoformat(),
        "source": "Saved profile, check-in, screening, and referral records.",
    }

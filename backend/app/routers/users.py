
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.core.security import decode_token
from app.models import User, Person

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or inactive.",
        )

    return user


class ProfileRequest(BaseModel):
    profile_type: Literal["adult", "child"]
    name: str = Field(min_length=2, max_length=150)
    date_of_birth: str = Field(min_length=8, max_length=20)
    sex: Literal["Male", "Female"]
    phone: str = Field(min_length=7, max_length=20)
    consent: bool

    # Adult fields
    health_history: Optional[str] = None
    caregiver_name: Optional[str] = None

    # Child fields
    guardian_name: Optional[str] = None
    relationship: Optional[str] = None


def serialize_person(person: Person):
    baseline = person.baseline or {}

    return {
        "id": person.id,
        "name": person.name,
        "date_of_birth": person.dob,
        "sex": person.sex,
        "profile_type": person.type,
        "phone": baseline.get("phone"),
        "health_history": baseline.get("health_history"),
        "caregiver_name": baseline.get("caregiver_name"),
        "guardian_name": baseline.get("guardian_name"),
        "relationship": baseline.get("relationship"),
        "created_at": person.created_at.isoformat() if person.created_at else None,
    }


@router.get("/me")
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile_type = "adult" if current_user.role == "adult" else "child"

    person = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == profile_type,
        )
        .order_by(Person.id.asc())
        .first()
    )

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "language": current_user.language or "en",
        "profile_complete": person is not None,
        "profile": serialize_person(person) if person else None,
    }


@router.get("/profile")
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile_type = "adult" if current_user.role == "adult" else "child"

    person = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == profile_type,
        )
        .order_by(Person.id.asc())
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile has not been completed.",
        )

    return serialize_person(person)


@router.post("/profile")
def save_profile(
    payload: ProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expected_type = "adult" if current_user.role == "adult" else "child"

    if payload.profile_type != expected_type:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This profile type does not match your account pathway.",
        )

    if not payload.consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent is required before saving this profile.",
        )

    if payload.profile_type == "child":
        if not payload.guardian_name or not payload.relationship:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guardian name and relationship are required.",
            )

    baseline = {
        "phone": payload.phone.strip(),
        "health_history": payload.health_history,
        "caregiver_name": payload.caregiver_name,
        "guardian_name": payload.guardian_name,
        "relationship": payload.relationship,
        "consent_recorded_at": datetime.now(timezone.utc).isoformat(),
    }

    person = (
        db.query(Person)
        .filter(
            Person.owner_id == current_user.id,
            Person.type == expected_type,
        )
        .order_by(Person.id.asc())
        .first()
    )

    if person:
        person.name = payload.name.strip()
        person.dob = payload.date_of_birth
        person.sex = payload.sex
        person.baseline = baseline
    else:
        person = Person(
            owner_id=current_user.id,
            name=payload.name.strip(),
            dob=payload.date_of_birth,
            sex=payload.sex,
            type=expected_type,
            language=current_user.language or "en",
            baseline=baseline,
        )
        db.add(person)

    try:
        db.commit()
        db.refresh(person)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save profile. Please try again.",
        )

    return {
        "message": "Profile saved successfully.",
        "profile_complete": True,
        "profile": serialize_person(person),
    }

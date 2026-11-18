
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import (
    create_token,
    hash_password,
    needs_password_rehash,
    verify_password,
)
from app.models import User
from app.routers.users import get_current_user

router = APIRouter()


# --------------------------------------------------
# REQUEST SCHEMAS
# --------------------------------------------------

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: Literal["adult", "parent"] = "adult"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class DoctorCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


# --------------------------------------------------
# RESPONSE HELPER
# --------------------------------------------------

def user_response(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


# --------------------------------------------------
# PUBLIC REGISTRATION
# Adult and parent accounts only.
# --------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).lower().strip()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in.",
        )

    user = User(
        name=payload.name.strip(),
        email=email,
        role=payload.role,
        password_hash=hash_password(payload.password),
        language="en",
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    token = create_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    })

    return {
        "message": "Account created successfully.",
        "token": token,
        "user": user_response(user),
    }


# --------------------------------------------------
# ADMINISTRATOR: CREATE DOCTOR ACCOUNT
# --------------------------------------------------

@router.post(
    "/admin/create-doctor",
    status_code=status.HTTP_201_CREATED,
)
def create_doctor(
    payload: DoctorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only administrators may create doctor accounts.
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorised administrators can create doctor accounts.",
        )

    email = str(payload.email).lower().strip()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    doctor = User(
        name=payload.name.strip(),
        email=email,
        role="doctor",
        password_hash=hash_password(payload.password),
        language="en",
        is_active=True,
    )

    try:
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    return {
        "message": "Doctor account created successfully.",
        "user": user_response(doctor),
    }


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@router.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).lower().strip()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact your administrator.",
        )

    if needs_password_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.commit()

    token = create_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    })

    return {
        "message": "Login successful.",
        "token": token,
        "user": user_response(user),
    }


# --------------------------------------------------
# AUTHENTICATED SESSION
# --------------------------------------------------

@router.get("/me")
def auth_me(
    current_user: User = Depends(get_current_user),
):
    return user_response(current_user)

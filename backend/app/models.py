
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, JSON, Text, UniqueConstraint
)
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    role = Column(String(30), nullable=False, default="parent")
    password_hash = Column(String(255), nullable=False)
    language = Column(String(10), default="en")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(150), nullable=False)
    dob = Column(String(20))
    type = Column(String(20), nullable=False)
    sex = Column(String(30))
    nationality = Column(String(100))
    language = Column(String(10), default="en")
    education = Column(String(100))
    culture = Column(String(100))
    hearing = Column(String(100))
    vision = Column(String(100))
    baseline = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Screening(Base):
    __tablename__ = "screenings"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    kind = Column(String(50), nullable=False)
    visit_no = Column(Integer, nullable=True)
    scores = Column(JSON, default=dict)
    raw_answers = Column(JSON, default=dict)
    risk = Column(String(30), default="LOW")
    status = Column(String(30), default="STABLE")
    ai_summary = Column(Text)
    modifiable_factors = Column(JSON, default=list)
    next_action = Column(String(255))
    clinician_reviewed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    submission_id = Column(String(64), unique=True, index=True, nullable=True)


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    specialty = Column(String(100))
    reason = Column(Text)
    status = Column(String(30), default="OPEN")
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    barrier = Column(String(100), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class WellbeingCheckIn(Base):
    __tablename__ = "wellbeing_checkins"
    __table_args__ = (
        UniqueConstraint(
            "person_id",
            "local_date",
            name="uq_wellbeing_checkin_person_date",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    local_date = Column(String(10), nullable=False)
    sleep_hours = Column(Float, nullable=True)
    mood_score = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class AdultClinicalReview(Base):
    __tablename__ = "adult_clinical_reviews"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(String(30), nullable=False)
    risk = Column(String(30), nullable=False, default="NOT_ASSESSED")
    note = Column(Text, nullable=False)
    next_action = Column(String(255), nullable=False)
    referral_specialty = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

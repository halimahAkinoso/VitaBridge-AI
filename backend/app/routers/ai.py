"""Authenticated, local-first AI endpoints with PHI-minimal audit records."""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Person, User
from app.routers.users import get_current_user
from app.services.audit import AuditUnavailableError, record_ai_event
from app.services.clinical_nlp import extract_features
from app.services.eeg_model import analyze_eeg
from app.services.fusion import fuse_risk
from app.services.speech_model import analyze_speech

router = APIRouter()
MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_EEG_BYTES = 100 * 1024 * 1024
ALLOWED_AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"}


class NLPExtractRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: Literal["ar", "en"]


class RiskFusionRequest(BaseModel):
    moca: dict | None = None
    speech: dict | None = None
    eeg: dict | None = None
    sleep: dict | None = None
    hearing: dict | None = None
    measurements: dict = Field(default_factory=dict)


def _audit(
    db: Session,
    user: User,
    operation: str,
    model_id: str,
    input_payload: object,
    output: dict,
    result_code: str,
    explanation: dict | None = None,
) -> None:
    try:
        record_ai_event(
            db,
            user.id,
            operation,
            model_id,
            input_payload,
            output,
            result_code,
            explanation,
        )
    except AuditUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Audit storage is unavailable; the result was not returned.",
        ) from exc


def _require_clinician(user: User) -> None:
    if user.role not in {"doctor", "admin"}:
        raise HTTPException(
            status_code=403,
            detail="This decision-support endpoint is restricted to clinicians.",
        )


def _require_uae_clinical_ai() -> None:
    if (
        os.getenv("CLINICAL_AI_ENABLED", "false").lower() != "true"
        or os.getenv("DATA_RESIDENCY_REGION", "").lower() != "uaecentral"
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "Clinical AI endpoints are disabled until UAE Central deployment "
                "and data-residency controls are configured."
            ),
        )


def _require_owned_adult(db: Session, user: User, person_id: int) -> None:
    if user.role != "adult":
        raise HTTPException(
            status_code=403,
            detail="Audio and EEG analysis is currently limited to an adult's own profile.",
        )
    person = (
        db.query(Person)
        .filter(
            Person.id == person_id,
            Person.owner_id == user.id,
            Person.type == "adult",
        )
        .first()
    )
    if not person:
        raise HTTPException(status_code=404, detail="Adult profile not found.")


@router.post("/nlp/extract")
def nlp_extract(
    payload: NLPExtractRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_uae_clinical_ai()
    if current_user.role not in {"adult", "parent", "doctor", "admin"}:
        raise HTTPException(status_code=403, detail="This account cannot use clinical NLP.")
    features = extract_features(payload.text, payload.language)
    _audit(
        db,
        current_user,
        "nlp_extract",
        features["feature_extraction"],
        payload.model_dump(),
        features,
        "FEATURES_EXTRACTED",
        {
            "method": features["feature_extraction"],
            "language": features["language"],
            "feature_names": [
                name
                for name in (
                    "sleep_hours",
                    "sleep_issue",
                    "hearing_issue",
                    "memory_issue",
                    "functional_independent",
                    "reminder_preference",
                )
                if features.get(name) is not None
            ],
        },
    )
    return features


@router.post("/speech/analyze")
async def speech_analyze(
    audio: UploadFile = File(...),
    person_id: int = Form(...),
    language: Literal["ar", "en"] = Form(...),
    consent: bool = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_uae_clinical_ai()
    _require_owned_adult(db, current_user, person_id)
    if not consent:
        raise HTTPException(status_code=400, detail="Explicit audio-analysis consent is required.")
    suffix = Path(audio.filename or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO_SUFFIXES:
        raise HTTPException(status_code=415, detail="Use a supported audio file format.")
    content = await audio.read(MAX_AUDIO_BYTES + 1)
    if not content or len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio must be between 1 byte and 20 MB.")
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temporary.write(content)
            temporary_path = Path(temporary.name)
        try:
            result = await asyncio.to_thread(
                analyze_speech,
                temporary_path,
                language,
            )
        except RuntimeError as exc:
            failure = {"status": "MODEL_UNAVAILABLE"}
            _audit(
                db,
                current_user,
                "speech_analyze",
                "whisper-large-v3",
                content,
                failure,
                "MODEL_UNAVAILABLE",
                {
                    "reason_code": "approved_local_checkpoint_unavailable",
                    "person_id": person_id,
                },
            )
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        _audit(
            db,
            current_user,
            "speech_analyze",
            str(result["model"]),
            content,
            result,
            "TRANSCRIBED_NOT_ASSESSED",
            {
                "method": "whisper_transcription_and_pause_timing",
                "clinical_score": "NOT_ASSESSED",
                "person_id": person_id,
            },
        )
        return result
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


@router.post("/eeg/analyze")
async def eeg_analyze(
    eeg_file: UploadFile = File(...),
    person_id: int = Form(...),
    consent: bool = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_uae_clinical_ai()
    _require_owned_adult(db, current_user, person_id)
    if not consent:
        raise HTTPException(status_code=400, detail="Explicit EEG-analysis consent is required.")
    if Path(eeg_file.filename or "").suffix.lower() != ".edf":
        raise HTTPException(status_code=415, detail="EEG input must be an EDF file.")
    content = await eeg_file.read(MAX_EEG_BYTES + 1)
    if not content or len(content) > MAX_EEG_BYTES:
        raise HTTPException(status_code=413, detail="EEG file must be between 1 byte and 100 MB.")
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".edf", delete=False) as temporary:
            temporary.write(content)
            temporary_path = Path(temporary.name)
        try:
            result = await asyncio.to_thread(analyze_eeg, temporary_path)
        except (RuntimeError, ValueError, FileNotFoundError) as exc:
            failure = {"status": "PROCESSING_FAILED"}
            _audit(
                db,
                current_user,
                "eeg_analyze",
                "mne-bandpower",
                content,
                failure,
                "PROCESSING_FAILED",
                {
                    "reason_code": "edf_processing_unavailable_or_invalid",
                    "person_id": person_id,
                },
            )
            if isinstance(exc, RuntimeError):
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        _audit(
            db,
            current_user,
            "eeg_analyze",
            "mne-bandpower",
            content,
            result,
            "FEATURES_EXTRACTED_NOT_ASSESSED",
            {
                "method": "mne_filtered_bandpower",
                "clinical_status": "NOT_ASSESSED",
                "person_id": person_id,
            },
        )
        return result
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


@router.post("/risk/fuse")
def risk_fuse(
    payload: RiskFusionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_uae_clinical_ai()
    _require_clinician(current_user)
    result = fuse_risk(
        moca=payload.moca,
        speech=payload.speech,
        eeg=payload.eeg,
        sleep=payload.sleep,
        hearing=payload.hearing,
        measurements=payload.measurements,
    )
    _audit(
        db,
        current_user,
        "risk_fuse",
        "unvalidated-evidence-summary",
        payload.model_dump(),
        result,
        "NOT_ASSESSED",
        {
            "method": "unvalidated_multimodal_evidence_summary",
            "status": "NOT_ASSESSED",
            "next_action_code": (
                "open_hearing_followup"
                if isinstance(payload.hearing, dict)
                and payload.hearing.get("follow_up_open") is True
                else "request_clinician_review"
            ),
        },
    )
    return result

"""PHI-minimal, keyed audit logging for decision-support operations."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import AIInferenceAudit

logger = logging.getLogger(__name__)


class AuditUnavailableError(RuntimeError):
    """Raised when an operation cannot be durably audited."""


def _keyed_digest(value: Any) -> str:
    if isinstance(value, bytes):
        payload = value
    elif isinstance(value, str):
        payload = value.encode("utf-8")
    else:
        payload = json.dumps(
            value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            default=str,
        ).encode("utf-8")
    key = os.getenv("AUDIT_HMAC_KEY") or os.getenv("JWT_SECRET")
    if not key:
        raise AuditUnavailableError("Audit hashing is not configured.")
    return hmac.new(key.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def record_ai_event(
    db: Session,
    user_id: int,
    operation: str,
    model_id: str,
    input_payload: Any,
    output: Any,
    result_code: str,
    explanation: dict[str, Any] | None = None,
) -> None:
    """Store keyed digests and provenance only; never persist raw clinical content."""
    row = AIInferenceAudit(
        user_id=user_id,
        operation=operation,
        model_id=model_id,
        input_sha256=_keyed_digest(input_payload),
        output_sha256=_keyed_digest(output),
        result_code=result_code,
        explanation=explanation or {},
    )
    try:
        db.add(row)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception(
            "AI audit write failed for user_id=%s operation=%s",
            user_id,
            operation,
        )
        raise AuditUnavailableError("Audit storage is unavailable.") from exc

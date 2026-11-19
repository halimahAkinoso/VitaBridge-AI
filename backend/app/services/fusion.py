"""Conservative multimodal evidence summary; no unvalidated weighted score."""
from __future__ import annotations

from typing import Any


# Candidate research weights only; they are intentionally not used for inference.
VALIDATION_STUDY_WEIGHTS = {
    "moca": 0.30,
    "speech": 0.20,
    "eeg": 0.20,
    "sleep": 0.15,
    "hearing_vision": 0.15,
}


def fuse_risk(
    moca: Any = None,
    speech: Any = None,
    eeg: Any = None,
    sleep: Any = None,
    hearing: Any = None,
    measurements: dict | None = None,
    clinician_review: dict | None = None,
) -> dict:
    """Summarize available modalities without inventing a fused clinical status."""
    evidence = {
        "moca": moca,
        "speech": speech,
        "eeg": eeg,
        "sleep": sleep,
        "hearing_vision": hearing,
        "measurements": measurements or {},
    }
    observed = [name for name, value in evidence.items() if value not in (None, {}, "")]
    if clinician_review:
        status = str(clinician_review.get("status", "NOT_ASSESSED")).upper()
        risk = str(clinician_review.get("risk", "NOT_ASSESSED")).upper()
        if status not in {"STABLE", "WATCH", "ACT", "REFER"}:
            raise ValueError("clinician_review.status must be a clinician-entered status")
        if risk not in {"LOW", "MODERATE", "ELEVATED", "NOT_ASSESSED"}:
            raise ValueError("clinician_review.risk is invalid")
        return {
            "status": status,
            "risk": risk,
            "reason": str(clinician_review.get("reason", "Entered by a clinician.")),
            "evidence": evidence,
            "one_next_action": str(
                clinician_review.get(
                    "next_action",
                    "Discuss this clinician-reviewed result with your care team.",
                )
            ),
            "source": "clinician_review",
        }

    hearing_open = (
        isinstance(hearing, dict)
        and hearing.get("follow_up_open") is True
    )
    reason = (
        "Available observations are listed for clinician review; the proposed "
        "study weights are not validated and are not used to compute a risk score."
    )
    if not observed:
        reason = "No screening data were supplied; a fused result cannot be assessed."
    return {
        "status": "NOT_ASSESSED",
        "risk": "NOT_ASSESSED",
        "reason": reason,
        "evidence": evidence,
        "one_next_action": (
            "Arrange the already-open hearing follow-up with your care team."
            if hearing_open
            else "Ask a qualified clinician to review the available screening context."
        ),
        "source": "unvalidated_multimodal_inputs",
    }

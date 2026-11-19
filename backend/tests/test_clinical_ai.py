import pytest

from app.services.clinical_nlp import extract_features
from app.services.fusion import fuse_risk
from app.services.risk_model import predict_risk


def test_bilingual_feature_extraction_uses_explicit_arabic_and_english_phrases():
    arabic = extract_features(
        "أنسى الأسماء، أنام 5-6 ساعات، أسمع بصعوبة في الأماكن المزدحمة، "
        "أعتمد على نفسي وأفضّل التذكير بالمساء.",
        "ar",
    )
    assert arabic["sleep_hours"] == 5.5
    assert arabic["memory_issue"] is True
    assert arabic["hearing_issue"] is True
    assert arabic["functional_independent"] is True
    assert arabic["reminder_preference"] == "evening"

    english = extract_features(
        "I sleep 6 hours, forget names, need help with daily tasks, "
        "and prefer a morning reminder.",
        "en",
    )
    assert english["sleep_hours"] == 6
    assert english["memory_issue"] is True
    assert english["functional_independent"] is False
    assert english["reminder_preference"] == "morning"

    negated = extract_features(
        "لا أنسى الأسماء، سمعي جيد، أنام جيداً.",
        "ar",
    )
    assert negated["memory_issue"] is False
    assert negated["hearing_issue"] is False
    assert negated["sleep_issue"] is False


def test_feature_extraction_preserves_missing_context_and_rejects_unknown_language():
    features = extract_features("My week has been ordinary.", "en")
    assert features["sleep_hours"] is None
    assert features["memory_issue"] is None
    assert features["hearing_issue"] is None
    with pytest.raises(ValueError, match="language"):
        extract_features("مرحبا", "ur")


def test_fusion_never_turns_unvalidated_modalities_into_patient_risk():
    result = fuse_risk(
        moca={"current": 24, "baseline": 26},
        speech={"pauses_per_min": 8, "flag": "NOT_ASSESSED"},
        eeg={"theta_alpha_ratio": 1.8, "eeg_flag": "NOT_ASSESSED"},
        sleep={"hours": 5.5},
        hearing={"difficulty": "Often", "follow_up_open": True},
    )
    assert result["status"] == "NOT_ASSESSED"
    assert result["risk"] == "NOT_ASSESSED"
    assert "not validated" in result["reason"]
    assert "hearing follow-up" in result["one_next_action"]


def test_clinician_review_is_the_only_source_of_displayable_fused_status():
    result = fuse_risk(
        moca={"current": 24, "baseline": 26},
        clinician_review={
            "status": "WATCH",
            "risk": "MODERATE",
            "reason": "Entered by a clinician after review.",
            "next_action": "Arrange hearing follow-up.",
        },
    )
    assert result["status"] == "WATCH"
    assert result["risk"] == "MODERATE"
    assert result["source"] == "clinician_review"


def test_risk_model_without_validated_artifact_returns_not_assessed():
    result = predict_risk({"sleep_hours": 5.5})
    assert result["status"] == "NOT_ASSESSED"
    assert result["risk"] is None
    assert result["candidate_probability"] is None

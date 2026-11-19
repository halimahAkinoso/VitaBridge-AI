"""Load-only gate for a UAE-validated XGBoost decision-support artifact."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class ValidatedRiskModel:
    model: Any
    feature_names: list[str]
    model_id: str

    def candidate_prediction(self, features: dict[str, float]) -> dict:
        if set(features) != set(self.feature_names):
            raise ValueError("Input features do not match the approved model schema")
        try:
            import numpy as np
        except ImportError as exc:
            raise RuntimeError("NumPy is required for risk-model inference.") from exc

        matrix = np.asarray([[float(features[name]) for name in self.feature_names]])
        if not np.isfinite(matrix).all():
            raise ValueError("Model inputs must be finite numbers")
        probabilities = self.model.predict_proba(matrix)[0]
        classes = self.model.classes_
        candidate = max(
            zip(classes, probabilities),
            key=lambda item: float(item[1]),
        )
        from app.services.explain import explain_xgboost

        return {
            "candidate_class": str(candidate[0]),
            "candidate_probability": round(float(candidate[1]), 4),
            "status": "REQUIRES_CLINICIAN_REVIEW",
            "risk": None,
            "model_id": self.model_id,
            "explanation": explain_xgboost(
                self.model,
                features,
                self.feature_names,
            ),
        }


def load_validated_model(
    model_path: str | Path,
    manifest_path: str | Path,
) -> ValidatedRiskModel:
    """Load only a checksum-matched artifact with an Abu Dhabi approval manifest."""
    model_file = Path(model_path)
    manifest_file = Path(manifest_path)
    if not model_file.is_file() or not manifest_file.is_file():
        raise FileNotFoundError("Both the model artifact and its approval manifest are required.")

    manifest_bytes = manifest_file.read_bytes()
    trusted_manifest_digest = os.getenv("VALIDATED_MODEL_MANIFEST_SHA256")
    if not trusted_manifest_digest:
        raise RuntimeError(
            "The trusted Abu Dhabi model-manifest digest is not configured."
        )
    manifest_digest = hashlib.sha256(manifest_bytes).hexdigest()
    if not hmac.compare_digest(manifest_digest, trusted_manifest_digest.lower()):
        raise ValueError("The model manifest does not match the trusted approval digest.")
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    validation = manifest.get("local_validation")
    if not isinstance(validation, dict):
        raise ValueError("The model manifest is missing local validation metadata.")
    required = (
        manifest.get("model_id"),
        manifest.get("feature_names"),
        manifest.get("model_sha256"),
        validation.get("status"),
        validation.get("site"),
        validation.get("protocol_id"),
        validation.get("approval_reference"),
    )
    if not all(required):
        raise ValueError("The model manifest is missing required validation metadata.")
    if validation["status"] != "approved" or validation["site"] != "Abu Dhabi":
        raise ValueError("Only a locally approved Abu Dhabi validation artifact can be loaded.")

    hasher = hashlib.sha256()
    with model_file.open("rb") as model_stream:
        for chunk in iter(lambda: model_stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    if digest != manifest["model_sha256"]:
        raise ValueError("The risk-model artifact does not match its approved SHA-256 checksum.")
    feature_names = manifest["feature_names"]
    if (
        not isinstance(feature_names, list)
        or not feature_names
        or not all(isinstance(name, str) and name for name in feature_names)
        or len(set(feature_names)) != len(feature_names)
    ):
        raise ValueError("The model feature schema is invalid.")

    try:
        from xgboost import XGBClassifier
    except ImportError as exc:
        raise RuntimeError("Install XGBoost before loading the validated artifact.") from exc

    model = XGBClassifier()
    model.load_model(str(model_file))
    return ValidatedRiskModel(
        model=model,
        feature_names=feature_names,
        model_id=str(manifest["model_id"]),
    )


def predict_risk(features: dict[str, float], model: ValidatedRiskModel | None = None) -> dict:
    """Never infer a clinical risk label without an approved model artifact."""
    if model is None:
        return {
            "status": "NOT_ASSESSED",
            "risk": None,
            "candidate_class": None,
            "candidate_probability": None,
            "reason": (
                "No approved Abu Dhabi risk-model artifact is configured. "
                "A clinician must interpret the screening and decide the result."
            ),
        }
    return model.candidate_prediction(features)

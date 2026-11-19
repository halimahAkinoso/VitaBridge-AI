"""Model-attribution helpers for clinician review, not patient diagnosis."""
from __future__ import annotations

from typing import Any


def explain_xgboost(
    model: Any,
    feature_values: dict[str, float],
    feature_names: list[str],
) -> dict:
    """Return SHAP feature contributions for one candidate prediction."""
    if not feature_names or set(feature_names) != set(feature_values):
        raise ValueError("feature_names must exactly match the supplied feature values")
    try:
        import numpy as np
        import shap
    except ImportError as exc:
        raise RuntimeError("Install SHAP before requesting a model explanation.") from exc

    matrix = np.asarray([[float(feature_values[name]) for name in feature_names]])
    explainer = shap.TreeExplainer(model)
    values = explainer(matrix).values
    contributions = np.asarray(values)
    if contributions.ndim == 3:
        contributions = contributions[0, :, -1]
    elif contributions.ndim == 2:
        contributions = contributions[0]
    else:
        raise RuntimeError("Unexpected SHAP output shape; no explanation was generated.")
    if len(contributions) != len(feature_names):
        raise RuntimeError("SHAP output does not match the model feature schema.")

    ranked = sorted(
        zip(feature_names, contributions.tolist()),
        key=lambda item: abs(float(item[1])),
        reverse=True,
    )
    base_value = float(np.asarray(explainer.expected_value).reshape(-1)[-1])
    return {
        "method": "SHAP TreeExplainer",
        "base_value": base_value,
        "top_features": [
            {
                "feature": name,
                "value": float(feature_values[name]),
                "shap_value": round(float(contribution), 6),
                "direction": "higher_model_output" if contribution > 0 else "lower_model_output",
            }
            for name, contribution in ranked[:5]
        ],
        "warning": "SHAP describes this model's output; it does not establish clinical causality.",
    }

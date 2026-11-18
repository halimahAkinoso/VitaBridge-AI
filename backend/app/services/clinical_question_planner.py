"""Safe, monitoring-focused question planning with an optional clinical model.

Bio_ClinicalBERT is used only to rank a pre-approved question bank.  It never
diagnoses, assigns a score, or makes an autonomous referral decision.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from app.services.safety import check_red_flags, safety_disclaimer

MODEL_NAME = "emilyalsentzer/Bio_ClinicalBERT"

QUESTION_BANK = {
    "adult": [
        ("sleep", "How many hours did you sleep on most nights this week, and did you wake feeling rested?", "Sleep can affect attention and memory test results."),
        ("hearing", "Has hearing made conversations, calls, or appointments harder recently?", "Hearing changes can look like cognitive change and are treatable."),
        ("mood", "Over the last two weeks, how often have you felt down, worried, or less interested in usual activities?", "Mood can affect concentration and wellbeing."),
        ("function", "Have everyday tasks such as medicines, finances, cooking, or getting around become harder than usual?", "Function helps the care team understand meaningful change."),
        ("follow_up", "What is making the hearing or clinic follow-up difficult: time, transport, cost, worry, or something else?", "A barrier-specific plan is more useful than another reminder."),
    ],
    "child": [
        ("milestones", "What new sounds, movements, play, or communication have you noticed since the last check-in?", "Development is best understood as a pattern over time."),
        ("regression", "Has your child stopped doing a skill they could previously do?", "Loss of a learned skill needs prompt clinician review."),
        ("hearing", "Does your child respond to familiar voices and sounds as expected?", "Hearing can affect language and social development."),
        ("growth", "Any feeding, sleep, growth, or illness concerns since the last visit?", "These factors provide context for development."),
        ("visit", "What could make the next well-child visit easier to attend?", "Early support works best when routine visits are not missed."),
    ],
}


@lru_cache(maxsize=1)
def _clinical_encoder():
    """Load the open-source model only when explicitly enabled.

    This avoids a multi-hundred-MB download in a demo/offline deployment.
    """
    if os.getenv("CLINICAL_MODEL_ENABLED", "false").lower() != "true":
        return None
    try:
        import torch
        from transformers import AutoModel, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = AutoModel.from_pretrained(MODEL_NAME)
        model.eval()
        return tokenizer, model, torch
    except Exception:
        return None


def _rank_with_clinical_model(context: str, candidates: list[tuple[str, str, str]]):
    encoder = _clinical_encoder()
    if encoder is None:
        return candidates, "protocol fallback"
    tokenizer, model, torch = encoder
    try:
        texts = [context] + [question for _, question, _ in candidates]
        encoded = tokenizer(texts, padding=True, truncation=True, max_length=160, return_tensors="pt")
        with torch.no_grad():
            vectors = model(**encoded).last_hidden_state.mean(dim=1)
        similarities = torch.nn.functional.cosine_similarity(vectors[0].unsqueeze(0), vectors[1:])
        ordered = [candidate for _, candidate in sorted(zip(similarities.tolist(), candidates), reverse=True)]
        return ordered, f"{MODEL_NAME} relevance ranking"
    except Exception:
        return candidates, "protocol fallback"


def build_monitoring_plan(payload: dict[str, Any]) -> dict[str, Any]:
    population = payload.get("population", "adult")
    population = population if population in QUESTION_BANK else "adult"
    check_in = payload.get("check_in", {}) or {}
    baseline = payload.get("baseline", {}) or {}
    open_loops = payload.get("open_loops", []) or []
    notes = str(check_in.get("notes", ""))
    red_flags = check_red_flags(notes)
    context = " ".join(str(value) for value in [population, baseline, check_in, open_loops])
    ranked, mode = _rank_with_clinical_model(context, QUESTION_BANK[population])

    # Keep high-value contextual questions first even if the optional model is unavailable.
    priority_keys = []
    if check_in.get("sleep_hours") is not None or population == "adult":
        priority_keys.append("sleep")
    if check_in.get("hearing_concern") or "hearing" in " ".join(map(str, open_loops)).lower():
        priority_keys.append("hearing")
    if open_loops:
        priority_keys.extend(["follow_up", "visit"])
    if population == "child":
        priority_keys.extend(["milestones", "regression"])

    by_key = {key: (key, question, reason) for key, question, reason in ranked}
    ordered = [by_key[key] for key in priority_keys if key in by_key]
    ordered.extend(item for item in ranked if item not in ordered)
    questions = [
        {"id": key, "question": question, "why": reason, "response_type": "free_text"}
        for key, question, reason in ordered[:4]
    ]

    needs_review = bool(red_flags)
    return {
        "population": population,
        "model": {"name": MODEL_NAME, "mode": mode, "purpose": "Ranks approved monitoring questions; it does not diagnose."},
        "questions": questions,
        "monitoring_tools": ["Sleep and energy", "Mood and wellbeing", "Hearing / vision context", "Daily function or milestones", "Care-gap and barrier check"],
        "next_best_action": "Contact a clinician or local urgent service now" if needs_review else ("Resolve the open follow-up barrier" if open_loops else "Complete this check-in and review the trend at the next visit"),
        "escalation": {"required": needs_review, "reason": "Possible red-flag wording needs human review." if needs_review else "No emergency signal identified from this check-in."},
        "disclaimer": safety_disclaimer(),
    }

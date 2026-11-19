"""Local, non-diagnostic agent behavior for the VitaBridge prototype."""

from typing import Any

from app.services.safety import check_red_flags, safety_disclaimer


def build_nura_context(
    person: Any,
    age: int | None,
    baseline: dict,
    sensory: dict,
    check_in: dict | None,
    clinical_result: dict,
    open_loops: list[dict],
    next_action: dict,
) -> dict:
    """Build Nura's context only from saved profile and assessment records."""
    saved_assessment = (person.baseline or {}).get("adult_health_assessment", {})
    additional_information = (
        saved_assessment.get("additional_notes")
        if isinstance(saved_assessment, dict)
        else None
    )
    measurements = {
        key: baseline[key]
        for key in (
            "systolic_bp_mmhg",
            "diastolic_bp_mmhg",
            "blood_glucose_mmol_l",
            "cholesterol_mmol_l",
            "weight_kg",
        )
        if baseline.get(key) is not None
    }
    if check_in and check_in.get("sleep_hours") is not None:
        sleep_hours = check_in["sleep_hours"]
    else:
        sleep_hours = baseline.get("sleep_hours")

    missing_context = [
        label
        for label, value in (
            ("hearing", sensory.get("hearing_difficulty")),
            ("vision", sensory.get("vision_difficulty")),
            ("sleep quality", baseline.get("sleep_quality")),
            ("mood", (check_in or {}).get("mood_score") or baseline.get("mood")),
            ("education", person.education),
            ("cultural background", person.culture),
        )
        if value is None or value == ""
    ]
    if not additional_information:
        missing_context.append("recent illness (not recorded as a structured field)")
    if person.type == "adult":
        missing_context.append("approved cognitive screening score")

    return {
        "person": {
            "name": person.name,
            "age": age,
            "type": person.type,
            "language": person.language or "en",
            "education": person.education,
            "culture": person.culture,
        },
        "baseline": {
            "hearing": sensory.get("hearing_difficulty"),
            "vision": sensory.get("vision_difficulty"),
            "sleep_quality": baseline.get("sleep_quality"),
            "sleep_hours": sleep_hours,
            "mood": (check_in or {}).get("mood_score") or baseline.get("mood"),
            "activity": baseline.get("physical_activity"),
            "daily_function": baseline.get("everyday_function"),
            "memory_concerns": baseline.get("memory_concerns"),
            "measurements": measurements,
        },
        "status": (
            clinical_result.get("status")
            if clinical_result.get("available")
            else None
        ),
        "risk": (
            clinical_result.get("risk")
            if clinical_result.get("available")
            else None
        ),
        "open_loops": open_loops,
        "next_action": next_action,
        "additional_information": additional_information,
        "missing_context": missing_context,
    }


class BaseAgent:
    def __init__(self, name: str):
        self.name = name

    def _llm_reply(self, user_msg: str, context: dict) -> str:
        """Keep the legacy interface local; health data is never sent externally."""
        return self._fallback(user_msg, context)

    def _fallback(self, message: str, context: dict) -> str:
        if check_red_flags(message):
            return (
                "I cannot assess an emergency. Please contact local emergency "
                "services or a qualified healthcare professional now. "
                "If possible, stay with someone you trust."
            )
        return (
            "I can help explain saved information and prepare questions for "
            "your care team. I cannot diagnose, create a clinical score, or "
            f"book an appointment. {safety_disclaimer()}"
        )


class ChildDevelopmentAgent(BaseAgent):
    def __init__(self):
        super().__init__("ChildDevelopmentAgent")

    def assess(self, age_months: int, milestones: dict, growth: dict):
        observed = [
            key
            for key, value in milestones.items()
            if value is not None
        ]
        return {
            "agent": self.name,
            "status": "NOT_ASSESSED",
            "risk": "NOT_ASSESSED",
            "observations_recorded": observed,
            "interpretation": (
                "Caregiver observations alone do not generate a validated "
                "developmental score or diagnosis. Review concerns with a "
                "qualified healthcare professional."
            ),
            "disclaimer": safety_disclaimer(),
        }


class AdultBrainHealthAgent(BaseAgent):
    def __init__(self):
        super().__init__("AdultBrainHealthAgent")

    def assess(self, baseline_moca, current_moca, context: dict):
        return {
            "agent": self.name,
            "status": "NOT_ASSESSED",
            "risk": "NOT_ASSESSED",
            "comparison_available": False,
            "reason": (
                "An approved instrument, its version, administration context, "
                "and clinician authorization are required before scores can "
                "be interpreted."
            ),
            "red_flags": check_red_flags(str(context.get("notes", ""))),
            "disclaimer": safety_disclaimer(),
        }


class TriageAgent(BaseAgent):
    def __init__(self):
        super().__init__("TriageAgent")

    def route(self, status, risk):
        return {
            "specialty": None,
            "urgency": None,
            "action": "A qualified clinician must determine whether referral is appropriate.",
            "automated_referral_created": False,
        }


CHILD_AGENT = ChildDevelopmentAgent()
ADULT_AGENT = AdultBrainHealthAgent()
TRIAGE = TriageAgent()

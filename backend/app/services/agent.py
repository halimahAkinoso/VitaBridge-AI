"""Local, non-diagnostic agent behavior for the VitaBridge prototype."""

from app.services.safety import check_red_flags, safety_disclaimer


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

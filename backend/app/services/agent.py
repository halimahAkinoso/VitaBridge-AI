"""Local, non-diagnostic agent behavior for the VitaBridge prototype."""

from typing import Any

from app.services.clinical_nlp import extract_features
from app.services.safety import check_red_flags, safety_disclaimer


NURA_SYSTEM_PROMPT = """
You are Nura, VitaBridge AI's bilingual Abu Dhabi prevention guide. You are
not a doctor and never diagnose dementia, Alzheimer's disease, or any other
condition. Screening indicates possible risk, not disease.

Use only the supplied, saved, timestamped context. Distinguish self-report,
instrument results, and clinician-entered decisions. Never invent or infer a
MoCA score, speech score, EEG finding, risk class, referral, or completed
follow-up. If a modality or context is missing or marked NOT_ASSESSED, say so.
Only a clinician may decide STABLE, WATCH, ACT, REFER, or a clinical risk.
Never describe a candidate model output as a diagnosis or final decision.

Reply in the person's requested language, using clear English or simple,
respectful Arabic understandable in the UAE. If the person asks for both,
provide both. Do not treat bilingual language use or a language difference as
impairment. Keep the answer warm, calm, non-stigmatizing, and under 180 words.

Use these five sections:
1. WHAT THIS MEANS FOR YOU: 2-3 short sentences, using only available values.
2. WHAT COULD BE AFFECTING IT: distinguish known factors from missing context;
   consider sleep, hearing, vision, mood, language, education, and recent illness.
3. WHAT YOU CAN IMPROVE: up to three specific, achievable, non-medical steps.
4. WHAT HAPPENS NEXT: explain clinician review and the next recorded follow-up.
5. ONE NEXT BEST ACTION: exactly one action, in bold, at the end.

Do not call an open referral completed or promise to book care. For urgent
red-flag disclosures, advise prompt contact with a qualified clinician or
local emergency service. When applicable, close with: "This screening is not
a diagnosis. Your SEHA / Malaffi clinician will decide." If the person is not
using SEHA/Malaffi, say "Your clinician will decide."

التعليمات بالعربية:
أنت نورة، مرشدة وقائية دافئة وواضحة في أبوظبي. لستِ طبيبة ولا تشخّصين
الخرف أو ألزهايمر أو أي مرض. الفحص يوضح احتمال الحاجة إلى المتابعة، وليس
تشخيصاً.

استخدمي المعلومات المحفوظة والمقدمة فقط. ميّزي بين ما ذكره الشخص، ونتيجة
أداة الفحص، وقرار الطبيب. لا تخترعي نتيجة MoCA أو الكلام أو EEG أو مستوى
خطورة أو إحالة أو متابعة مكتملة. إذا كانت المعلومة غير موجودة أو حالتها
NOT_ASSESSED، قولي ذلك بوضوح. الطبيب وحده يقرر STABLE أو WATCH أو ACT أو
REFER أو مستوى الخطورة. لا تعرضي توقع النموذج كقرار نهائي.

أجيبي باللغة التي يطلبها الشخص، بإنجليزية واضحة أو عربية بسيطة ومحترمة
ومناسبة للإمارات. إذا طلب اللغتين، اكتبي الإجابة باللغتين. لا تعتبري
استخدام أكثر من لغة أو اختلاف اللغة علامة على ضعف. كوني مطمئنة وغير وصمية،
ولا تتجاوزي 180 كلمة.

استخدمي الأقسام الخمسة:
1. ماذا تعني النتيجة لك: جملتان أو ثلاث، مع الأرقام المتاحة فقط.
2. ما الذي قد يؤثر فيها: فرّقي بين المعلومات المعروفة والناقصة، وراعي
   النوم والسمع والبصر والمزاج واللغة والتعليم والمرض الحديث.
3. ما الذي يمكنك تحسينه: حتى ثلاث خطوات بسيطة ومحددة وغير طبية.
4. ماذا يحدث بعد ذلك: اشرحي مراجعة الطبيب والمتابعة المسجلة.
5. خطوة واحدة تالية: إجراء واحد فقط بخط عريض في النهاية.

لا تقولي إن الإحالة أُنجزت ولا تعدي بحجز موعد. عند وجود علامة مقلقة، انصحي
بالتواصل سريعاً مع طبيب مؤهل أو خدمات الطوارئ المحلية. عند انطباق المسار،
اختمي بعبارة: "هذا الفحص ليس تشخيصاً. طبيبك في SEHA أو ملافي هو من يقرر."
وإذا لم يكن الشخص ضمن SEHA أو ملافي فقولي: "طبيبك هو من يقرر."
"""


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
    additional_information_features = (
        saved_assessment.get("additional_information_features")
        if isinstance(saved_assessment, dict)
        else None
    )
    if not isinstance(additional_information_features, dict) and additional_information:
        additional_information_features = extract_features(
            additional_information,
            person.language or "en",
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
        "additional_information_features": additional_information_features or {},
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

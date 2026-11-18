"""Clinical safety guardrails; automated outputs are not diagnoses."""

RED_FLAGS = [
    "suicidal",
    "self-harm",
    "cannot do daily tasks",
    "lost milestone",
    "regression",
    "rapid weight loss",
    "severe mood drop",
    "أفكر بالانتحار",
    "أريد الانتحار",
    "إيذاء نفسي",
    "أؤذي نفسي",
    "لا أستطيع القيام بمهامي اليومية",
    "فقدت مهارة",
    "تراجع نمائي",
    "فقدان وزن سريع",
    "انخفاض شديد في المزاج",
]


def check_red_flags(text: str) -> list[str]:
    lowered = text.lower()
    return [flag for flag in RED_FLAGS if flag in lowered]


def safety_disclaimer() -> str:
    return (
        "Screening supports awareness and follow-up; it is not a diagnosis. "
        "A qualified healthcare professional must interpret clinical results."
    )


def classify_change(baseline: float, current: float, context: dict) -> str:
    """No clinical change category is assigned without an approved protocol."""
    return "NOT_ASSESSED"

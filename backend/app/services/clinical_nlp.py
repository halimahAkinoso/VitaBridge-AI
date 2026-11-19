"""Privacy-preserving bilingual feature extraction for English and Arabic."""
from __future__ import annotations

import re
import unicodedata


CAMELBERT_MODEL = "CAMeL-Lab/bert-base-arabic-camelbert-mix"
BIO_CLINICAL_BERT_MODEL = "emilyalsentzer/Bio_ClinicalBERT"

_SLEEP_RANGE_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(?:-|–|to|إلى)\s*"
    r"(\d+(?:[.,]\d+)?)\s*(?:h(?:ours?)?|ساعات?|ساعة)",
    re.IGNORECASE,
)
_SLEEP_SINGLE_RE = re.compile(
    r"(?:sleep(?:ing)?|نوم(?:ي)?|أنام|انام)[^\d]{0,20}"
    r"(\d+(?:[.,]\d+)?)\s*(?:h(?:ours?)?|ساعات?|ساعة)",
    re.IGNORECASE,
)

_PATTERNS = {
    "sleep_issue": {
        "yes": ("poor sleep", "sleep badly", "can't sleep", "cannot sleep", "insomnia",
                "قلة النوم", "نومي سيئ", "ما أنام", "لا أستطيع النوم", "صعوبة النوم"),
        "no": ("sleep well", "restful sleep", "no sleep problems", "no sleep issues",
               "أنام جيداً", "نومي جيد", "لا توجد مشكلة في النوم"),
    },
    "hearing_issue": {
        "yes": ("hearing difficulty", "difficulty hearing", "hard to hear",
                "struggle to hear", "hearing loss",
                "صعوبة السمع", "أسمع بصعوبة", "ما أسمع زين", "ضعف السمع"),
        "no": ("hearing is fine", "no hearing difficulty", "no problem hearing", "سمعي جيد",
               "لا أعاني من صعوبة السمع"),
    },
    "memory_issue": {
        "yes": ("forget names", "forgetting names", "forgetful with names",
                "memory problem", "memory concern",
                "forget things", "أنسى الأسماء", "أنسى", "نسيان", "ضعف الذاكرة"),
        "no": ("no memory issues", "memory is fine", "do not forget names",
               "don't forget names", "لا أنسى", "لا أعاني من النسيان",
               "ذاكرتي جيدة", "لا توجد مشكلة في الذاكرة"),
    },
    "functional_independent": {
        "yes": ("independent", "manage daily tasks", "manage on my own",
                "أعتمد على نفسي", "مستقل", "أقوم بمهامي بنفسي"),
        "no": ("not independent", "need help with daily", "depend on others",
               "need assistance", "أحتاج مساعدة", "أعتمد على الآخرين",
               "لا أستطيع القيام بمهامي"),
    },
}


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text).lower()
    normalized = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _boolean_feature(text: str, feature: str) -> bool | None:
    patterns = _PATTERNS[feature]
    if any(_normalize(phrase) in text for phrase in patterns["no"]):
        return False
    if any(_normalize(phrase) in text for phrase in patterns["yes"]):
        return True
    return None


def _sleep_hours(text: str) -> float | None:
    ranged = _SLEEP_RANGE_RE.search(text)
    if ranged:
        low, high = (float(value.replace(",", ".")) for value in ranged.groups())
        if low <= high <= 24:
            return round((low + high) / 2, 1)

    single = _SLEEP_SINGLE_RE.search(text)
    if single:
        hours = float(single.group(1).replace(",", "."))
        if 0 <= hours <= 24:
            return hours
    return None


def extract_features(text: str, lang: str) -> dict:
    """Extract explicit self-reported features; do not infer absent answers.

    CAMeLBERT and Bio_ClinicalBERT are documented encoder candidates for a
    later clinician-labelled task model. No pretrained classifier is applied
    here, so unvalidated embeddings cannot silently become clinical findings.
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must contain a non-empty response")
    language = (lang or "").strip().lower().split("-")[0]
    if language not in {"ar", "en"}:
        raise ValueError("language must be 'ar' or 'en'")

    normalized = _normalize(text)
    return {
        "sleep_hours": _sleep_hours(normalized),
        "sleep_issue": _boolean_feature(normalized, "sleep_issue"),
        "hearing_issue": _boolean_feature(normalized, "hearing_issue"),
        "memory_issue": _boolean_feature(normalized, "memory_issue"),
        "functional_independent": _boolean_feature(
            normalized,
            "functional_independent",
        ),
        "language": language,
        "reminder_preference": (
            "evening"
            if any(term in normalized for term in (
                "evening", "at night", "after sunset", "مساء", "بالليل",
            ))
            else "morning"
            if any(term in normalized for term in (
                "morning", "صبح", "الصباح",
            ))
            else None
        ),
        "feature_extraction": "bilingual_phrase_ontology_v1",
        "encoder_candidates": {
            "ar": CAMELBERT_MODEL,
            "en": BIO_CLINICAL_BERT_MODEL,
        },
    }

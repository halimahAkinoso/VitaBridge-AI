"""Local Whisper transcription; cognitive interpretation is deliberately gated."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any


WHISPER_MODEL = "openai/whisper-large-v3"


@lru_cache(maxsize=1)
def _load_model():
    if os.getenv("SPEECH_MODEL_ENABLED", "false").lower() != "true":
        raise RuntimeError("Speech inference is disabled until an approved UAE-local model is configured.")
    checkpoint = os.getenv("WHISPER_MODEL_PATH")
    if not checkpoint or not Path(checkpoint).is_file():
        raise RuntimeError("WHISPER_MODEL_PATH must point to a locally stored Whisper checkpoint.")
    try:
        import torch
        import whisper
    except ImportError as exc:
        raise RuntimeError("Install the speech extras before enabling local Whisper inference.") from exc

    device = "cuda" if torch.cuda.is_available() else "cpu"
    return whisper.load_model(checkpoint, device=device), device


def _pauses_per_minute(segments: list[dict[str, Any]]) -> float | None:
    words = [
        word
        for segment in segments
        for word in segment.get("words", [])
        if isinstance(word, dict)
        and isinstance(word.get("start"), (int, float))
        and isinstance(word.get("end"), (int, float))
    ]
    if len(words) < 2:
        return None
    gaps = [
        max(0.0, float(current["start"]) - float(previous["end"]))
        for previous, current in zip(words, words[1:])
    ]
    duration = max(0.0, float(words[-1]["end"]) - float(words[0]["start"]))
    if duration < 1:
        return None
    return round(sum(gap >= 1.2 for gap in gaps) / (duration / 60), 1)


def analyze_speech(audio_path: str | Path, language: str) -> dict:
    """Transcribe local audio and report technical timing only, never a dementia score."""
    path = Path(audio_path)
    if not path.is_file():
        raise FileNotFoundError("The uploaded audio file is not available.")
    if language not in {"ar", "en"}:
        raise ValueError("language must be 'ar' or 'en'")

    model, device = _load_model()
    result = model.transcribe(
        str(path),
        language=language,
        word_timestamps=True,
        verbose=False,
        fp16=device == "cuda",
    )
    segments = result.get("segments", [])
    return {
        "transcript": result.get("text", "").strip(),
        "detected_language": result.get("language"),
        "pauses_per_min": _pauses_per_minute(segments),
        "word_finding_difficulty": None,
        "speech_cognitive_score": None,
        "flag": "NOT_ASSESSED",
        "model": WHISPER_MODEL,
        "interpretation": (
            "Transcription and pause timing are descriptive only. "
            "No speech impairment or cognitive score is produced."
        ),
    }

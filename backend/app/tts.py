"""ElevenLabs text-to-speech ("Read Aloud") feature, self-contained.

A single scoped router so it can be isolated or removed without touching any
detection/risk logic or the rest of the API. Requires the ELEVENLABS_API_KEY
environment variable to be set on the server.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

# Standard pre-made professional voice from the ElevenLabs voice library.
VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"  # "George"
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"

MAX_TEXT_LENGTH = 2000

# ISO language codes the frontend offers; anything else is rejected so the
# list above and this map stay the single source of truth. "bgc" (Haryanvi)
# is not natively supported by ElevenLabs or any free translator, so it is
# spoken through the Hindi (Devanagari) voice — mutually intelligible
# 1-to-1 with Haryanvi. Translation targets derive from _translation_target().
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "bgc": "Haryanvi",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
}


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)
    language: str = Field("en", min_length=2, max_length=3)


def _translation_target(language: str) -> str:
    """Map a spoken language code to its translation target code.

    Haryanvi (bgc) has no translator support; Hindi is its near-identical
    written form, so it reads the Devanagari text with the Hindi voice.
    """
    if language == "bgc":
        return "hi"
    return language


def _chunk_text(text: str, size: int = 480) -> list[str]:
    """Split narration into sentence-bounded chunks under the free translator limits.

    MyMemory caps each request at ~500 characters and Google throttles large
    payloads, while Forensic Synthesis findings routinely exceed both. Chunking
    on sentence boundaries keeps every request under the cap and preserves
    readable translated output. Falls back to hard slicing if a single sentence
    is itself longer than the cap.
    """
    if len(text) <= size:
        return [text]
    parts = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    buf = ""
    for part in parts:
        if not part:
            continue
        if buf and len(buf) + len(part) + 1 > size:
            chunks.append(buf)
            buf = part
        else:
            buf = f"{buf} {part}".strip()
    if buf:
        chunks.append(buf)
    if any(len(c) > size for c in chunks):
        return [text[i : i + size] for i in range(0, len(text), size)]
    return chunks


def _translate(text: str, language: str) -> str:
    """Translate the English summary into the requested language (keyless).

    Translates sentence-bounded chunks so long findings fit free-tier limits.
    Tries free Google Translate first (deep-translator), then falls back to the
    free MyMemory API when Google rate-limits (Google currently throttles at
    ~5 requests/second). Returns the original text unchanged for English.
    """
    target = _translation_target(language)
    if target == "en":
        return text
    from deep_translator import GoogleTranslator, MyMemoryTranslator  # lazy import keeps module removable

    translated = []
    for chunk in _chunk_text(text):
        try:
            translated.append(GoogleTranslator(source="en", target=target).translate(chunk))
        except Exception:
            logger.warning("GoogleTranslate failed for '%s'; falling back to MyMemory", language)
            try:
                translated.append(MyMemoryTranslator(source="en-GB", target=f"{target}-IN").translate(chunk))
            except Exception:
                logger.exception("MyMemory fallback failed for '%s'", language)
                raise
    return " ".join(translated)


@router.post("/speak")
def speak(payload: SpeakRequest) -> StreamingResponse:
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ELEVENLABS_API_KEY is not configured on the server.",
        )
    if payload.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language '{payload.language}'. "
                   f"Supported: {', '.join(sorted(SUPPORTED_LANGUAGES))}.",
        )

    try:
        text = _translate(payload.text, payload.language)
    except Exception:
        logger.exception("Translation to '%s' failed", payload.language)
        raise HTTPException(
            status_code=502,
            detail="Translation failed. Try again or switch back to English.",
        ) from None

    from elevenlabs import ElevenLabs  # lazy import keeps this module removable

    client = ElevenLabs(api_key=api_key)
    chunks = client.text_to_speech.convert(
        voice_id=VOICE_ID,
        text=text,
        model_id=MODEL_ID,
        output_format=OUTPUT_FORMAT,
    )

    # The SDK returns a lazy iterator, so pull the first chunk eagerly to turn
    # auth/quota/generation failures into a clean HTTP error instead of a
    # mid-stream connection drop.
    try:
        first = next(iter(chunks))
    except Exception:
        logger.exception("ElevenLabs TTS request failed")
        raise HTTPException(
            status_code=502,
            detail="Speech generation failed. Check ELEVENLABS_API_KEY and account quota.",
        ) from None

    def stream() -> Iterator[bytes]:
        yield first
        yield from chunks

    return StreamingResponse(
        stream(),
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'inline; filename="read-aloud.mp3"'},
    )
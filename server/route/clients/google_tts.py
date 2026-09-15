from __future__ import annotations

import base64
from typing import Any, Dict

import httpx

from route.config import google_tts_api_key
from route.errors import GoogleAPIError

TTS_SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"


async def synthesize_speech(
    client: httpx.AsyncClient,
    *,
    text: str,
    language_code: str,
    voice_name: str,
    speaking_rate: float,
    pitch: float,
) -> bytes:
    """Calls Google Cloud Text-to-Speech and returns MP3 bytes."""
    body: Dict[str, Any] = {
        "input": {"text": text},
        "voice": {"languageCode": language_code, "name": voice_name},
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": speaking_rate,
            "pitch": pitch,
        },
    }
    response = await client.post(
        TTS_SYNTHESIZE_URL,
        params={"key": google_tts_api_key()},
        json=body,
    )
    if not response.is_success:
        detail = f"Cloud Text-to-Speech returned status {response.status_code}"
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except ValueError:
            pass
        raise GoogleAPIError(detail)

    audio_b64 = response.json().get("audioContent")
    if not audio_b64:
        raise GoogleAPIError("Cloud Text-to-Speech returned no audioContent")
    return base64.b64decode(audio_b64)

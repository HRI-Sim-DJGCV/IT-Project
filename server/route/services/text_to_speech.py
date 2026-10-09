from __future__ import annotations

import httpx
from fastapi import Response

from route.clients.google_tts import synthesize_speech


async def generate_tts_mp3(
    text: str,
    language_code: str,
    voice_name: str,
    speaking_rate: float,
    pitch: float,
) -> Response:
    async with httpx.AsyncClient(timeout=30.0) as client:
        mp3_bytes = await synthesize_speech(
            client,
            text=text,
            language_code=language_code,
            voice_name=voice_name,
            speaking_rate=speaking_rate,
            pitch=pitch,
        )

    return Response(
        content=mp3_bytes,
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'attachment; filename="speech.mp3"'},
    )

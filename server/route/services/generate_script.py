from __future__ import annotations

import asyncio
from typing import List

from route.clients.google_weather import current_weather_lookup
from route.clients.openai_client import DEFAULT_MODEL, generate_text
from route.config import get_script_generation_prompt, render_template
from route.models import LatLng
from route.services.enrich_elevation import source_to_dest_elevation

# Recorded on every walk so analysis can group scripts by how they were made.
SCRIPT_MODEL = DEFAULT_MODEL
PROMPT_VERSION = 1

# Share of the walk given to each part of the meditation (must match the Node segmenter).
FOCUSED_ATTENTION_SHARE = 0.2
COMPASSION_SHARE = 0.4
CLOSING_SHARE = 0.4


def _words_for_minutes(minutes: float, *, wpm: int = 150) -> int:
    return int(round(minutes * wpm))


async def _weather(lat: float, lon: float) -> str:
    """Best effort: a missing Weather API must not stop the script."""
    try:
        data = await asyncio.to_thread(current_weather_lookup, lat, lon)
        condition = (data.get("weatherCondition") or {}).get("description", {}).get("text")
        temp = (data.get("temperature") or {}).get("degrees")
        parts = [p for p in [condition, f"{temp} degrees" if temp is not None else None] if p]
        return ", ".join(parts) if parts else "unknown"
    except Exception:  # noqa: BLE001
        return "unknown"


async def _elevation(source: LatLng, destination: LatLng) -> List[str]:
    """Best effort: elevation detail enriches the script but is not required."""
    try:
        return await source_to_dest_elevation(source=source, destination=destination)
    except Exception:  # noqa: BLE001
        return []


async def generate_script_with_park(
    source: LatLng,
    destination: LatLng,
    park: LatLng,
    to_park_time: int,  # seconds
    park_time: int,  # seconds
    park_to_destination_time: int,  # seconds
    context: str,
) -> str:
    weather, elevation = await asyncio.gather(_weather(park.lat, park.lon), _elevation(source, park))
    prompt = render_template(
        get_script_generation_prompt("WITH_PARK"),
        context=context,
        FAM_word_count=_words_for_minutes(to_park_time / 60),
        source_to_park="\n".join(elevation),
        CM_word_count=_words_for_minutes(park_time / 60),
        Closing_word_count=_words_for_minutes(park_to_destination_time / 60),
        weatherCondition=weather,
    )
    return await generate_text(prompt)


async def generate_script_without_park(
    source: LatLng,
    destination: LatLng,
    total_walking_time: int,  # seconds
    context: str,
) -> str:
    minutes = total_walking_time / 60
    weather, elevation = await asyncio.gather(_weather(destination.lat, destination.lon), _elevation(source, destination))
    prompt = render_template(
        get_script_generation_prompt("WITHOUT_PARK"),
        context=context,
        FAM_word_count=_words_for_minutes(minutes * FOCUSED_ATTENTION_SHARE),
        source_to_park="\n".join(elevation),
        CM_word_count=_words_for_minutes(minutes * COMPASSION_SHARE),
        Closing_word_count=_words_for_minutes(minutes * CLOSING_SHARE),
        weatherCondition=weather,
    )
    return await generate_text(prompt)

"""
Walking Meditation AI service.

Internal only: the Node API (backend/) is the single front door for the app and
is the only caller of this service. It provides the three AI capabilities the
Node API cannot do itself:

  POST /route/generate-from-text   real walking routes (Google Routes + Places)
  POST /script/generate            an AI-written meditation script for one walk
  POST /tts                        spoken audio for one script segment (Google Cloud TTS)

Run:  uvicorn main:app --host 0.0.0.0 --port 8001
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from route.config import google_maps_api_key, google_tts_api_key
from route.errors import GoogleAPIError, OpenaiAPIError
from route.models import (
    LatLng,
    ScriptGenerateRequest,
    ScriptGenerateResponse,
    TTSRequest,
    WalkRouteRequest,
    WalkRouteResponse,
)
from route.services.generate_script import (
    PROMPT_VERSION,
    SCRIPT_MODEL,
    generate_script_with_park,
    generate_script_without_park,
)
from route.services.get_route import generate_walk_route
from route.services.text_to_speech import generate_tts_mp3

INTERNAL_KEY = os.getenv("INTERNAL_KEY") or None
TTS_ENABLED = os.getenv("TTS_ENABLED", "true").strip().lower() not in {"0", "false", "no"}
PORT = int(os.getenv("PORT", "8001"))

TTS_STATE = "disabled"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global TTS_STATE
    if TTS_ENABLED:
        try:
            google_tts_api_key()
            TTS_STATE = "ready"
            print("[ai] Text-to-speech ready (Google Cloud TTS)")
        except GoogleAPIError as error:
            TTS_STATE = "unavailable"
            print(f"[ai] TTS unavailable: {error}")
    yield


def require_internal_key(x_internal_key: Optional[str] = Header(default=None)) -> None:
    """When INTERNAL_KEY is set, every call except /health must carry it. Stops anything but the Node API using this service."""
    if INTERNAL_KEY and x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=401, detail="Missing or invalid internal key")


app = FastAPI(title="Walking Meditation AI service", lifespan=lifespan)
api = APIRouter(dependencies=[Depends(require_internal_key)])


@app.get("/health")
def health():
    return {"status": "ok", "tts": TTS_STATE}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


class TextRouteRequest(BaseModel):
    start_location: str = Field(min_length=1, max_length=200)
    # When the participant used "my current location" the app sends coordinates and the name is only a label.
    start_coordinates: Optional[LatLng] = None
    end_location: str = Field(min_length=1, max_length=200)
    total_travel_time: int = Field(ge=60, le=14_400, description="seconds")
    # How many of the best park detours should come back with a full polyline (0 = names only).
    park_polylines: int = Field(0, ge=0, le=5)


async def resolve_location(client: httpx.AsyncClient, query: str) -> LatLng:
    """Place name or address -> coordinates, server-side so the Google key never reaches the app."""
    response = await client.post(
        "https://places.googleapis.com/v1/places:searchText",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": google_maps_api_key(),
            "X-Goog-FieldMask": "places.location",
        },
        json={"textQuery": query, "pageSize": 1},
    )
    if not response.is_success:
        detail = f"Places API returned status {response.status_code}"
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except ValueError:
            pass
        raise HTTPException(status_code=502, detail=detail)
    places = response.json().get("places") or []
    if not places:
        raise HTTPException(status_code=404, detail=f'Location not found: "{query}"')
    location = places[0].get("location") or {}
    if "latitude" not in location or "longitude" not in location:
        raise HTTPException(status_code=502, detail=f'No coordinates returned for: "{query}"')
    return LatLng(lat=location["latitude"], lon=location["longitude"])


@api.post("/route/generate-path", response_model=WalkRouteResponse)
async def generate_route(payload: WalkRouteRequest):
    try:
        return await generate_walk_route(payload.source, payload.destination, payload.total_travel_time)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(error)) from error


@api.post("/route/generate-from-text", response_model=WalkRouteResponse)
async def generate_route_from_text(payload: TextRouteRequest):
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            same_place = payload.end_location.strip().lower() == payload.start_location.strip().lower()
            if payload.start_coordinates is not None:
                source = payload.start_coordinates
                destination = source if same_place else await resolve_location(client, payload.end_location)
            else:
                source = await resolve_location(client, payload.start_location)
                destination = source if same_place else await resolve_location(client, payload.end_location)
        return await generate_walk_route(
            source,
            destination,
            payload.total_travel_time,
            park_polylines=payload.park_polylines,
        )
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(error)) from error


# ---------------------------------------------------------------------------
# Script generation
# ---------------------------------------------------------------------------


@api.post("/script/generate", response_model=ScriptGenerateResponse)
async def generate_script(payload: ScriptGenerateRequest):
    """One AI-written script for one walk. Uses the park variant when the route detours through a park."""
    try:
        if payload.park is not None and payload.park_timing is not None:
            script = await generate_script_with_park(
                payload.source,
                payload.destination,
                payload.park,
                payload.park_timing.to_park,
                payload.park_timing.at_park,
                payload.park_timing.park_to_destination,
                payload.context,
            )
        else:
            script = await generate_script_without_park(
                payload.source,
                payload.destination,
                payload.total_walking_time,
                payload.context,
            )
        if not script.strip():
            raise HTTPException(status_code=502, detail="The language model returned an empty script")
        return ScriptGenerateResponse(script=script, model=SCRIPT_MODEL, prompt_version=PROMPT_VERSION)
    except HTTPException:
        raise
    except OpenaiAPIError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(error)) from error


# ---------------------------------------------------------------------------
# Text-to-speech
# ---------------------------------------------------------------------------


@api.post("/tts")
async def text_to_speech(payload: TTSRequest):
    if TTS_STATE != "ready":
        raise HTTPException(status_code=503, detail=f"Text-to-speech is {TTS_STATE}")
    try:
        return await generate_tts_mp3(
            text=payload.text,
            language_code=payload.language_code,
            voice_name=payload.voice_name,
            speaking_rate=payload.speaking_rate,
            pitch=payload.pitch,
        )
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"TTS failed: {error}") from error


app.include_router(api)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=True)

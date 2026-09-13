"""
Walking Meditation AI service.

Internal only: the Node API (backend/) is the single front door for the app and
is the only caller of this service. It provides the three AI capabilities the
Node API cannot do itself:

  POST /route/generate-from-text   real walking routes (Google Routes + Places)
  POST /script/generate            an AI-written meditation script for one walk
  POST /tts                        spoken audio for one script segment (Qwen3-TTS)

Run:  uvicorn main:app --host 0.0.0.0 --port 8001
"""
from __future__ import annotations

import asyncio
import os
import warnings
from contextlib import asynccontextmanager
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from route.config import google_maps_api_key
from route.errors import OpenaiAPIError
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
from route.utils.utils import _ensure_ffmpeg

INTERNAL_KEY = os.getenv("INTERNAL_KEY") or None
TTS_ENABLED = os.getenv("TTS_ENABLED", "true").strip().lower() not in {"0", "false", "no"}
TTS_MODEL_ID = os.getenv("TTS_MODEL_ID", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
PORT = int(os.getenv("PORT", "8001"))

# Text-to-speech model handle; loaded once at startup when TTS_ENABLED.
MODEL: Optional[Any] = None
TTS_STATE = "disabled" if not TTS_ENABLED else "loading"
TTS_SEMAPHORE = asyncio.Semaphore(1)


def _load_tts_model() -> Any:
    import torch  # heavy imports stay local so the service starts even without them when TTS is disabled
    from qwen_tts import Qwen3TTSModel

    use_cuda = torch.cuda.is_available()
    return Qwen3TTSModel.from_pretrained(
        TTS_MODEL_ID,
        device_map="cuda:0" if use_cuda else "cpu",
        dtype=torch.bfloat16 if use_cuda else torch.float32,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global MODEL, TTS_STATE
    warnings.filterwarnings("ignore", message=".*flash-attn.*")
    if TTS_ENABLED:
        try:
            _ensure_ffmpeg()
            MODEL = await asyncio.to_thread(_load_tts_model)
            TTS_STATE = "ready"
            print(f"[ai] TTS model {TTS_MODEL_ID} loaded")
        except Exception as error:  # noqa: BLE001 - report and keep serving routes/scripts
            TTS_STATE = "unavailable"
            print(f"[ai] TTS unavailable: {error}")
    try:
        yield
    finally:
        MODEL = None


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
    if MODEL is None:
        raise HTTPException(status_code=503, detail=f"Text-to-speech is {TTS_STATE}")
    try:
        return await generate_tts_mp3(
            model=MODEL,
            semaphore=TTS_SEMAPHORE,
            text=payload.text,
            language=payload.language,
            speaker=payload.speaker,
            instruct=payload.instruct,
            bitrate=payload.bitrate,
            offload_model_to_thread=True,
        )
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"TTS failed: {error}") from error


app.include_router(api)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=True)

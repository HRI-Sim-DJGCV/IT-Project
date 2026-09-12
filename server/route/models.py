from typing import List, Optional
from pydantic import BaseModel, Field


class LatLng(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


class RouteInfo(BaseModel):
    duration_s: int
    distance_m: int
    polyline: str


class ParkPlace(BaseModel):
    place_id: str
    name: str
    lat: float
    lon: float


class ParkDetourResult(BaseModel):
    park: ParkPlace
    baseline_s: int
    detour_s: int
    added_s: int
    slack_s: int
    # Full detour route (with polyline); only filled for the best few parks when requested.
    route: Optional[RouteInfo] = None


class WalkRouteResponse(BaseModel):
    origin: LatLng
    destination: LatLng
    total_travel_time: int = Field(..., ge=0)
    baseline: RouteInfo
    parks: List[ParkDetourResult] = Field(default_factory=list)


class WalkRouteRequest(BaseModel):
    source: LatLng
    destination: LatLng
    total_travel_time: int


# ---------------------------------------------------------------------------
# Script generation
# ---------------------------------------------------------------------------


class ParkTiming(BaseModel):
    to_park: int = Field(..., ge=0, description="seconds walking to the park")
    at_park: int = Field(..., ge=0, description="seconds spent in the park")
    park_to_destination: int = Field(..., ge=0, description="seconds from the park to the end")


class ScriptGenerateRequest(BaseModel):
    source: LatLng
    destination: LatLng
    total_walking_time: int = Field(..., ge=60, le=14_400, description="seconds")
    context: str = Field(..., min_length=1, max_length=2000)
    park: Optional[LatLng] = None
    park_timing: Optional[ParkTiming] = None


class ScriptGenerateResponse(BaseModel):
    script: str
    model: str
    prompt_version: int


# ---------------------------------------------------------------------------
# Text-to-speech
# ---------------------------------------------------------------------------


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = "English"  # or "Auto"
    speaker: str = "Ryan"
    instruct: str = ""
    bitrate: str = "128k"


# ---------------------------------------------------------------------------
# Elevation enrichment (internal)
# ---------------------------------------------------------------------------


class StepSegment(BaseModel):
    i: int
    instruction: str
    start: LatLng
    end: LatLng
    step_polyline: str
    elev_start_m: float
    elev_end_m: float
    elev_gain_m: float
    label: str

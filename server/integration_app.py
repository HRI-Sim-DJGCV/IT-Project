import asyncio

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from route.config import google_maps_api_key
from route.models import LatLng, WalkRouteRequest, WalkRouteResponse
from route.services.get_route import generate_walk_route


app = FastAPI(title="Walking Meditation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextRouteRequest(BaseModel):
    start_location: str = Field(min_length=3, max_length=200)
    end_location: str = Field(min_length=3, max_length=200)
    total_travel_time: int = Field(ge=60, le=14_400)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/route/generate-path", response_model=WalkRouteResponse)
async def generate_route(payload: WalkRouteRequest):
    try:
        return await generate_walk_route(
            payload.source,
            payload.destination,
            payload.total_travel_time,
        )
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


# Converts a place name or address into coordinates without exposing
# the Google API key to the React frontend.
async def resolve_location(
    client: httpx.AsyncClient,
    query: str,
) -> LatLng:
    response = await client.post(
        "https://places.googleapis.com/v1/places:searchText",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": google_maps_api_key(),
            "X-Goog-FieldMask": "places.location",
        },
        json={
            "textQuery": query,
            "pageSize": 1,
        },
    )

    if not response.is_success:
        detail = f"Places API returned status {response.status_code}"

        try:
            google_error = response.json()
            detail = google_error.get("error", {}).get("message", detail)
        except ValueError:
            pass

        raise HTTPException(status_code=502, detail=detail)

    places = response.json().get("places") or []

    if not places:
        raise HTTPException(
            status_code=404,
            detail=f'Location not found: "{query}"',
        )

    location = places[0].get("location") or {}

    if "latitude" not in location or "longitude" not in location:
        raise HTTPException(
            status_code=502,
            detail=f'No coordinates returned for: "{query}"',
        )

    return LatLng(
        lat=location["latitude"],
        lon=location["longitude"],
    )


@app.post("/route/generate-from-text", response_model=WalkRouteResponse)
async def generate_route_from_text(payload: TextRouteRequest):
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            source, destination = await asyncio.gather(
                resolve_location(client, payload.start_location),
                resolve_location(client, payload.end_location),
            )

        return await generate_walk_route(
            source,
            destination,
            payload.total_travel_time,
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
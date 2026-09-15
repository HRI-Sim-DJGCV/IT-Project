from __future__ import annotations
import re
import math
import polyline as poly_decoder
from typing import Dict, Any

from route.errors import GoogleRoutesError


_DURATION_RE = re.compile(r"^(\d+)s$")


def duration_to_seconds(duration: str) -> int:
    m = _DURATION_RE.match(duration or "")
    if not m:
        raise GoogleRoutesError(f"Unexpected duration format: {duration!r}")
    return int(m.group(1))


def latlng_waypoint(lat: float, lon: float) -> Dict[str, Any]:
    return {"location": {"latLng": {"latitude": lat, "longitude": lon}}}


def polyline_to_path_string(encoded_polyline: str) -> str:
    """
    Convert encoded polyline -> "lat,lon;lat,lon;..."
    """
    decoded_points = poly_decoder.decode(encoded_polyline)  # [(lat, lon), ...]
    return ";".join(f"{lat},{lon}" for lat, lon in decoded_points)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Great-circle distance (meters)
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c

def classify_step(elev_gain_m: float, elev_start_m: float, elev_end_m: float) -> str:
    """
    Replace with your own semantics.
    Example: label based on absolute slope/gain, not absolute altitude.
    """
    if elev_gain_m >= 8:
        return "high elevation (uphill)"
    if elev_gain_m <= -8:
        return "high elevation (downhill)"
    return "low elevation (mostly flat)"



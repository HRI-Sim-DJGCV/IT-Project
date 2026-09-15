# routes/config.py
from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
PROMPT_FOLDER = BASE_DIR / "prompts"

# Load environment variables once for the package.
load_dotenv()

GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
GOOGLE_PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"

def google_maps_api_key() -> str:
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        # Import here to avoid circular imports.
        from .errors import GoogleRoutesError

        raise GoogleRoutesError("Missing env var GOOGLE_MAPS_API_KEY")
    return key


def openai_api_key()->str:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        from .errors import OpenaiAPIError
        raise OpenaiAPIError("Missing env var OPENAI_API_KEY")
    return key


def google_tts_api_key() -> str:
    # Falls back to GOOGLE_MAPS_API_KEY so one key covers both if Cloud Text-to-Speech
    # API is enabled on the same Google Cloud project; set GOOGLE_TTS_API_KEY to use a
    # different key/project instead.
    key = os.getenv("GOOGLE_TTS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        from .errors import GoogleAPIError

        raise GoogleAPIError("Missing env var GOOGLE_TTS_API_KEY (or GOOGLE_MAPS_API_KEY)")
    return key


def load_template(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8")
    except Exception as e:
        print(e)

def render_template(template: str, **kwargs) -> str:
    try:
        return template.format(**kwargs)
    except KeyError as e:
        raise ValueError(f"Missing template variable: {e}")
    
def get_script_generation_prompt(meditation_style:str ) -> str:
    if meditation_style == "WITHOUT_PARK":
        return load_template(PROMPT_FOLDER / "without_park.txt")
    else:
        return load_template(PROMPT_FOLDER / "with_park_xml.txt")
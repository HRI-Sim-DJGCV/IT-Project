from __future__ import annotations

import asyncio
import logging
import os
import random
from typing import Optional

import httpx

from route.config import gemini_api_key
from route.errors import GeminiAPIError

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
BASE_DELAY_S = 1.0
MAX_DELAY_S = 30.0
REQUEST_TIMEOUT_S = 300.0
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class _RetryableError(Exception):
    def __init__(self, message: str, retry_after: Optional[float] = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


def _retry_after_seconds(response: httpx.Response) -> Optional[float]:
    header = response.headers.get("retry-after")
    try:
        return float(header) if header is not None else None
    except (TypeError, ValueError):
        return None


def _retry_delay(attempt: int, error: _RetryableError) -> float:
    if error.retry_after is not None:
        return error.retry_after
    delay = min(BASE_DELAY_S * (2 ** (attempt - 1)), MAX_DELAY_S)
    return delay * (0.5 + random.random())


def _error_detail(response: httpx.Response) -> str:
    detail = f"Gemini returned status {response.status_code}"
    try:
        return response.json().get("error", {}).get("message", detail)
    except ValueError:
        return detail


def _extract_text(payload: dict) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        reason = (payload.get("promptFeedback") or {}).get("blockReason")
        raise GeminiAPIError(f"Gemini returned no candidates{f' (blocked: {reason})' if reason else ''}")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(part.get("text", "") for part in parts if not part.get("thought")).strip()


async def _call(client: httpx.AsyncClient, prompt: str, model: str, temperature: float, api_key: str) -> str:
    try:
        response = await client.post(
            GEMINI_URL.format(model=model),
            headers={"x-goog-api-key": api_key},
            json={
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": temperature},
            },
        )
    except (httpx.TransportError, httpx.TimeoutException) as error:
        raise _RetryableError(f"Gemini request failed: {error}") from error
    if response.status_code in RETRYABLE_STATUS:
        raise _RetryableError(_error_detail(response), _retry_after_seconds(response))
    if not response.is_success:
        raise GeminiAPIError(_error_detail(response))
    return _extract_text(response.json())


async def generate_text(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.8,
    api_key: Optional[str] = None,
) -> str:
    key = api_key or gemini_api_key()
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                return await _call(client, prompt, model, temperature, key)
            except _RetryableError as error:
                if attempt == MAX_ATTEMPTS:
                    raise GeminiAPIError(str(error)) from error
                delay = _retry_delay(attempt, error)
                logger.warning(
                    "Gemini script generation failed (attempt %d/%d): %s; retrying in %.1fs",
                    attempt,
                    MAX_ATTEMPTS,
                    error,
                    delay,
                )
                await asyncio.sleep(delay)
    raise AssertionError("unreachable")

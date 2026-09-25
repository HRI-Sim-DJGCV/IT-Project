from __future__ import annotations

import asyncio
import logging
import random
from typing import Optional

from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    OpenAI,
    RateLimitError,
)

from route.config import openai_api_key

DEFAULT_MODEL = "gpt-4.1-mini"

logger = logging.getLogger(__name__)

# A burst of walk-preparation requests (e.g. a scheduled group session) can push the
# script-generation TPM budget over OpenAI's rate limit. Retry those and other
# transient failures with backoff instead of failing the whole preparation outright.
MAX_ATTEMPTS = 5
BASE_DELAY_S = 1.0
MAX_DELAY_S = 30.0
RETRYABLE_ERRORS = (RateLimitError, APIConnectionError, APITimeoutError, InternalServerError)


def _retry_after_seconds(error: Exception) -> Optional[float]:
    response = getattr(error, "response", None)
    header = response.headers.get("retry-after") if response is not None else None
    try:
        return float(header) if header is not None else None
    except (TypeError, ValueError):
        return None


def _retry_delay(attempt: int, error: Exception) -> float:
    retry_after = _retry_after_seconds(error)
    if retry_after is not None:
        return retry_after
    delay = min(BASE_DELAY_S * (2 ** (attempt - 1)), MAX_DELAY_S)
    return delay * (0.5 + random.random())  # jitter: 0.5x-1.5x, avoids retry storms


async def generate_text(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.8,
    api_key: Optional[str] = None,
) -> str:
    """
    Async wrapper around the (sync) OpenAI Python SDK call.
    Prevents blocking the event loop by running in a thread.
    Retries rate limits and transient server/network errors with exponential
    backoff; other failures (bad request, auth, etc.) are raised immediately.
    """
    def _call() -> str:
        client = OpenAI(api_key=api_key or openai_api_key())
        resp = client.responses.create(
            model=model,
            input=prompt,
            temperature=temperature,
        )
        return (resp.output_text or "").strip()

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return await asyncio.to_thread(_call)
        except RETRYABLE_ERRORS as error:
            if attempt == MAX_ATTEMPTS:
                raise
            delay = _retry_delay(attempt, error)
            logger.warning(
                "OpenAI script generation failed (attempt %d/%d): %s; retrying in %.1fs",
                attempt,
                MAX_ATTEMPTS,
                error,
                delay,
            )
            await asyncio.sleep(delay)
    raise AssertionError("unreachable")
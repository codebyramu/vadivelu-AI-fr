"""Gemini API Client with Multi-Key Round-Robin Failover and Error Categorization."""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings
from app.core.key_rotator import (
    AllKeysInCooldownError,
    AllKeysInvalidError,
    KeyRotatorError,
    NoKeysConfiguredError,
    key_rotator,
)

logger = logging.getLogger("vadivelu.gemini")

GEMINI_API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
)


class GeminiService:
    """Dispatches calls to Gemini API with automatic rotation across keys."""

    def __init__(self, model: Optional[str] = None):
        self.model = model or settings.GEMINI_MODEL

    async def generate_content(
        self,
        contents: List[Dict[str, Any]],
        system_instruction: Optional[str] = None,
        generation_config: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
    ) -> Tuple[str, str]:
        """Generate content via Gemini, rotating keys automatically on errors.

        Returns:
            Tuple[str, str]: (raw_response_text, key_alias_used)
        """
        if not key_rotator.has_keys:
            raise NoKeysConfiguredError(
                "No Gemini API keys configured. Please add GEMINI_API_KEY_1 to .env"
            )

        # Build payload
        payload: Dict[str, Any] = {"contents": contents}

        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        default_config = {
            "temperature": 0.7,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        }
        if generation_config:
            default_config.update(generation_config)
        payload["generationConfig"] = default_config

        attempts = 0
        total_available = max(1, key_rotator.total_keys)
        retry_limit = min(max_retries, total_available)

        last_error_msg = ""

        while attempts < retry_limit:
            attempts += 1
            key_info = await key_rotator.get_next_key()
            url = GEMINI_API_URL_TEMPLATE.format(model=self.model, key=key_info.secret)

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )

                if response.status_code == 200:
                    await key_rotator.record_success(key_info.alias)
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise ValueError("No candidates returned from Gemini API.")

                    parts = candidates[0].get("content", {}).get("parts", [])
                    text_parts = [p.get("text", "") for p in parts if "text" in p]
                    raw_text = "".join(text_parts).strip()
                    return raw_text, key_info.alias

                # Non-200 status code
                error_body = response.text
                last_error_msg = f"HTTP {response.status_code}: {error_body[:200]}"
                logger.warning(
                    f"Gemini API returned error for {key_info.alias}: status {response.status_code}"
                )
                await key_rotator.record_failure(
                    key_info.alias, response.status_code, error_body
                )

            except httpx.TimeoutException as e:
                last_error_msg = f"Timeout connecting to Gemini API: {e}"
                logger.warning(f"Timeout on {key_info.alias}: {e}")
                await key_rotator.record_failure(key_info.alias, 504, str(e))

            except httpx.RequestError as e:
                last_error_msg = f"Network error connecting to Gemini API: {e}"
                logger.warning(f"Network error on {key_info.alias}: {e}")
                await key_rotator.record_failure(key_info.alias, 503, str(e))

            except (KeyRotatorError, ValueError) as e:
                raise e

        raise KeyRotatorError(
            f"Failed to complete Gemini request across all key rotation attempts. Last error: {last_error_msg}"
        )


gemini_service = GeminiService()

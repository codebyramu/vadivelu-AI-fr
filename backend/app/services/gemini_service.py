"""Gemini API Client with Multi-Key Round-Robin Failover, Tool Calling, and Error Categorization."""

import json
import logging
from typing import Any, Callable, Coroutine, Dict, List, Optional, Tuple

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
    """Dispatches calls to Gemini API with automatic key rotation and function calling support."""

    def __init__(self, model: Optional[str] = None):
        self.model = model or settings.GEMINI_MODEL

    async def generate_content(
        self,
        contents: List[Dict[str, Any]],
        system_instruction: Optional[str] = None,
        generation_config: Optional[Dict[str, Any]] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_executor: Optional[Callable[[str, Dict[str, Any]], Coroutine[Any, Any, Dict[str, Any]]]] = None,
        max_tool_turns: int = 3,
        max_retries: int = 3,
    ) -> Tuple[str, str]:
        """Generate content via Gemini, supporting tool calling and automatic key failover.

        Returns:
            Tuple[str, str]: (raw_response_text, key_alias_used)
        """
        if not key_rotator.has_keys:
            raise NoKeysConfiguredError(
                "No Gemini API keys configured. Please add GEMINI_API_KEY_1 to .env"
            )

        working_contents = list(contents)
        primary_key_alias = ""
        current_turn = 0

        while current_turn <= max_tool_turns:
            current_turn += 1

            payload: Dict[str, Any] = {"contents": working_contents}
            if system_instruction:
                payload["systemInstruction"] = {
                    "parts": [{"text": system_instruction}]
                }

            if tools:
                payload["tools"] = tools

            # Default configuration
            default_config = {
                "temperature": 0.7,
                "maxOutputTokens": 1024,
            }
            if generation_config:
                default_config.update(generation_config)
            payload["generationConfig"] = default_config

            # Execute with key rotation
            candidate_part, key_alias = await self._dispatch_with_failover(payload, max_retries=max_retries)
            if not primary_key_alias:
                primary_key_alias = key_alias

            # Check if Gemini requested a function call
            func_call = candidate_part.get("functionCall")
            if func_call and tool_executor and current_turn <= max_tool_turns:
                func_name = func_call.get("name", "")
                func_args = func_call.get("args", {})
                logger.info(f"Gemini requested tool call: {func_name}({func_args}) via {key_alias}")

                # 1. Append model's tool call to conversation history
                working_contents.append({
                    "role": "model",
                    "parts": [{"functionCall": func_call}],
                })

                # 2. Execute the tool
                tool_output = await tool_executor(func_name, func_args)

                # 3. Append function result to conversation history
                working_contents.append({
                    "role": "user",
                    "parts": [{
                        "functionResponse": {
                            "name": func_name,
                            "response": tool_output,
                        }
                    }],
                })

                # Continue next turn with tool result included
                continue

            # No function call, we have the final textual/json response!
            text = candidate_part.get("text")
            if not text and isinstance(candidate_part.get("audioTranscription"), dict):
                text = candidate_part.get("audioTranscription", {}).get("text", "")
            if not text and isinstance(candidate_part.get("text"), str):
                text = candidate_part.get("text", "")
            return (text or "").strip(), primary_key_alias

        return "", primary_key_alias

    async def _dispatch_with_failover(
        self, payload: Dict[str, Any], max_retries: int = 3
    ) -> Tuple[Dict[str, Any], str]:
        """Sends single request to Gemini with bounded rotation and error categorization."""
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
                    if not parts:
                        raise ValueError("Empty parts returned in candidate.")

                    # Return the first part (can be text or functionCall)
                    return parts[0], key_info.alias

                # Non-200 status code
                error_body = response.text
                last_error_msg = f"HTTP {response.status_code}: {error_body[:200]}"
                logger.warning(
                    f"Gemini API returned error for {key_info.alias}: status {response.status_code} - {error_body}"
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

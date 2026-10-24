"""Concurrency-safe Multi-Key Gemini API Key Rotator.

Handles round-robin key selection, cooldowns, exponential backoff,
and error categorization without exposing secret keys in logs.
"""

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger("vadivelu.key_rotator")


class KeyRotatorError(Exception):
    """Base exception for key rotator."""


class NoKeysConfiguredError(KeyRotatorError):
    """Raised when no Gemini API keys are configured."""


class AllKeysInCooldownError(KeyRotatorError):
    """Raised when all Gemini API keys are temporarily in cooldown."""

    def __init__(self, message: str, wait_seconds: float = 0.0):
        super().__init__(message)
        self.wait_seconds = max(0.0, wait_seconds)


class AllKeysInvalidError(KeyRotatorError):
    """Raised when all Gemini API keys are permanently invalid/revoked."""


@dataclass
class KeyInfo:
    """Track health and stats for an API key."""

    alias: str
    secret: str
    status: str = "healthy"  # "healthy" | "cooldown" | "invalid"
    cooldown_until: float = 0.0
    consecutive_failures: int = 0
    total_requests: int = 0
    total_successes: int = 0
    total_errors: int = 0
    last_used_at: Optional[float] = None
    last_error_message: Optional[str] = None


class GeminiKeyRotator:
    """Manages round-robin rotation across multiple Gemini API keys."""

    def __init__(self):
        self._lock = asyncio.Lock()
        self._keys: List[KeyInfo] = []
        self._current_index: int = 0
        self.reload_keys()

    def reload_keys(self) -> None:
        """Scan environment variables for GEMINI_API_KEY and GEMINI_API_KEY_1..N."""
        existing_stats: Dict[str, KeyInfo] = {k.secret: k for k in self._keys}
        new_keys: List[KeyInfo] = []

        # Find all keys matching GEMINI_API_KEY and GEMINI_API_KEY_<number>
        key_entries: List[tuple[int, str, str]] = []

        # 1. Check GEMINI_API_KEY (default single key)
        single_key = os.getenv("GEMINI_API_KEY", "").strip()
        if single_key:
            key_entries.append((0, "Key-Primary", single_key))

        # 2. Check numbered keys
        for env_k, val in os.environ.items():
            val = val.strip()
            if not val:
                continue
            match = re.match(r"^GEMINI_API_KEY_(\d+)$", env_k)
            if match:
                idx = int(match.group(1))
                key_entries.append((idx, f"Key-{idx}", val))

        # Sort numbered keys
        key_entries.sort(key=lambda x: x[0])

        # Avoid duplicates
        seen_secrets = set()
        for _, alias, secret in key_entries:
            if secret in seen_secrets:
                continue
            seen_secrets.add(secret)

            if secret in existing_stats:
                # Retain health stats across reloads
                stat = existing_stats[secret]
                stat.alias = alias
                new_keys.append(stat)
            else:
                new_keys.append(KeyInfo(alias=alias, secret=secret))

        self._keys = new_keys
        if self._current_index >= len(self._keys):
            self._current_index = 0

        logger.info(f"Loaded {len(self._keys)} Gemini API keys into rotator.")

    @property
    def has_keys(self) -> bool:
        return len(self._keys) > 0

    @property
    def total_keys(self) -> int:
        return len(self._keys)

    async def get_next_key(self) -> KeyInfo:
        """Concurrency-safe round-robin selection of next healthy key."""
        async with self._lock:
            if not self._keys:
                raise NoKeysConfiguredError(
                    "No Gemini API keys configured. Please add GEMINI_API_KEY_1 to .env"
                )

            now = time.time()
            total = len(self._keys)

            # Auto-recover keys whose cooldown has expired
            for key in self._keys:
                if key.status == "cooldown" and now >= key.cooldown_until:
                    logger.info(f"Key {key.alias} cooldown period ended. Restoring to healthy.")
                    key.status = "healthy"
                    key.consecutive_failures = 0

            # Scan starting from _current_index
            for i in range(total):
                idx = (self._current_index + i) % total
                candidate = self._keys[idx]
                if candidate.status == "healthy":
                    self._current_index = (idx + 1) % total
                    candidate.total_requests += 1
                    candidate.last_used_at = now
                    return candidate

            # No healthy keys found. Check states
            cooldown_keys = [k for k in self._keys if k.status == "cooldown"]
            if cooldown_keys:
                min_remaining = min(k.cooldown_until - now for k in cooldown_keys)
                wait_sec = max(1, int(min_remaining))
                raise AllKeysInCooldownError(
                    f"All Gemini API keys are currently cooling down. Next key available in {wait_sec}s.",
                    wait_seconds=wait_sec,
                )

            # All keys are invalid
            raise AllKeysInvalidError(
                "All configured Gemini API keys are invalid. Please check your keys in .env."
            )

    async def record_success(self, alias: str) -> None:
        """Mark request as successful and reset consecutive failure count."""
        async with self._lock:
            for k in self._keys:
                if k.alias == alias:
                    k.status = "healthy"
                    k.consecutive_failures = 0
                    k.total_successes += 1
                    k.last_error_message = None
                    return

    async def record_failure(
        self, alias: str, status_code: int, error_detail: str = ""
    ) -> None:
        """Categorize error, trigger exponential backoff cooldown, or mark invalid."""
        async with self._lock:
            now = time.time()
            for k in self._keys:
                if k.alias != alias:
                    continue

                k.total_errors += 1
                # Sanitize error detail to never include secret
                sanitized_detail = error_detail.replace(k.secret, "[REDACTED]")
                k.last_error_message = sanitized_detail

                if status_code in (401, 403):
                    k.status = "invalid"
                    logger.error(
                        f"Key {alias} marked INVALID (status {status_code}): {sanitized_detail}"
                    )
                elif status_code in (429, 500, 502, 503, 504):
                    k.consecutive_failures += 1
                    backoff = min(
                        settings.MAX_KEY_COOLDOWN_SECONDS,
                        settings.DEFAULT_KEY_COOLDOWN_SECONDS * (2 ** (k.consecutive_failures - 1)),
                    )
                    k.status = "cooldown"
                    k.cooldown_until = now + backoff
                    logger.warning(
                        f"Key {alias} entered COOLDOWN for {backoff:.0f}s (status {status_code}, failure #{k.consecutive_failures})"
                    )
                else:
                    k.consecutive_failures += 1
                    k.status = "cooldown"
                    k.cooldown_until = now + 15
                    logger.warning(
                        f"Key {alias} entered temporary cooldown for 15s (status {status_code})"
                    )
                return

    def get_status(self) -> dict:
        """Safe status representation for /api/health and settings UI."""
        now = time.time()
        healthy_count = 0
        cooldown_count = 0
        invalid_count = 0

        keys_info = []
        for k in self._keys:
            # Check if cooldown has expired on the fly for display
            is_cooling = k.status == "cooldown" and (k.cooldown_until > now)
            effective_status = "cooldown" if is_cooling else ("healthy" if k.status != "invalid" else "invalid")

            if effective_status == "healthy":
                healthy_count += 1
            elif effective_status == "cooldown":
                cooldown_count += 1
            else:
                invalid_count += 1

            remaining = max(0.0, round(k.cooldown_until - now, 1)) if is_cooling else 0.0

            keys_info.append(
                {
                    "alias": k.alias,
                    "status": effective_status,
                    "cooldownRemainingSeconds": remaining,
                    "consecutiveFailures": k.consecutive_failures,
                    "totalRequests": k.total_requests,
                    "totalSuccesses": k.total_successes,
                    "totalErrors": k.total_errors,
                    "lastUsedAt": k.last_used_at,
                    "lastErrorMessage": k.last_error_message,
                }
            )

        return {
            "totalKeys": len(self._keys),
            "activeKeysCount": healthy_count,
            "cooldownKeysCount": cooldown_count,
            "invalidKeysCount": invalid_count,
            "hasKeys": len(self._keys) > 0,
            "keys": keys_info,
        }


# Singleton instance
key_rotator = GeminiKeyRotator()

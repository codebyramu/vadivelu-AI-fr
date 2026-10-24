"""Supabase Direct Dialogues Integration Service.

Connects directly to the user's Supabase project:
Project: https://jkgewxlsmazlxotygysr.supabase.co
Table: dialogues
Fetches live Vadivelu punchlines and authentic media_url audio links for the AI.
"""

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("vadivelu.supabase")


class SupabaseDialogueService:
    """Manages direct real-time fetching and searching of Supabase Vadivelu dialogues."""

    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", "https://jkgewxlsmazlxotygysr.supabase.co").rstrip("/")
        self.supabase_key = os.getenv("SUPABASE_KEY", "sb_publishable_bRK6AIBgZykhSsed0rjzpA_gQxaL7sf")
        self._cached_dialogues: List[Dict[str, Any]] = []
        self._cache_timestamp: float = 0.0
        self._cache_ttl_seconds: float = 60.0  # Cache for 1 minute for ultra-fast Gemini responses
        self._cooldown_tracker: Dict[str, float] = {}  # id -> timestamp of last usage
        self._default_cooldown: float = 30.0

    @property
    def is_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    def _headers(self) -> Dict[str, str]:
        key = os.getenv("SUPABASE_KEY") or self.supabase_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    async def fetch_dialogues(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Fetch all dialogues from Supabase table, cached in-memory."""
        now = time.time()
        if not force_refresh and self._cached_dialogues and (now - self._cache_timestamp < self._cache_ttl_seconds):
            return self._enrich_availability(self._cached_dialogues)

        if not self.is_configured:
            logger.warning("Supabase URL or Key not configured.")
            return []

        try:
            endpoint = f"{self.supabase_url}/rest/v1/dialogues"
            params = {
                "select": "*",
                "order": "created_at.asc",
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(endpoint, headers=self._headers(), params=params)
                if res.status_code != 200:
                    logger.error(f"Failed to fetch from Supabase (status {res.status_code}): {res.text}")
                    return self._enrich_availability(self._cached_dialogues)

                raw_data = res.json()
                mapped = []
                for row in raw_data:
                    d_id = str(row.get("id"))
                    line_text = row.get("line_text") or ""
                    line_translation = row.get("line_translation") or ""
                    sit_tags = row.get("situation_tags") or []
                    emo_tags = row.get("emotion_tags") or []
                    all_tags = list(sit_tags) + list(emo_tags)
                    media_url = row.get("media_url") or ""

                    primary_emotion = emo_tags[0] if emo_tags else "comedy"

                    item = {
                        "id": d_id,
                        "title": line_text,
                        "lineText": line_text,
                        "lineTranslation": line_translation,
                        "filePath": media_url,
                        "audioUrl": media_url,
                        "thumbnailUrl": None,
                        "durationMs": 2200,
                        "tags": all_tags,
                        "emotion": primary_emotion,
                        "contextHint": line_translation or line_text,
                        "intensity": row.get("intensity", "mid"),
                        "cooldownSeconds": int(self._default_cooldown),
                        "useCount": row.get("usage_count", 0),
                        "isFavorite": False,
                    }
                    mapped.append(item)

                self._cached_dialogues = mapped
                self._cache_timestamp = now
                logger.info(f"Loaded {len(mapped)} Vadivelu dialogues directly from Supabase.")
                return self._enrich_availability(self._cached_dialogues)

        except Exception as e:
            logger.error(f"Exception fetching Supabase dialogues: {e}", exc_info=True)
            return self._enrich_availability(self._cached_dialogues)

    def _enrich_availability(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add live isAvailableNow based on cooldown tracking."""
        now = time.time()
        result = []
        for item in items:
            copy_item = dict(item)
            last_used = self._cooldown_tracker.get(item["id"])
            if last_used and (now - last_used < self._default_cooldown):
                copy_item["isAvailableNow"] = False
                copy_item["remainingCooldown"] = int(self._default_cooldown - (now - last_used))
            else:
                copy_item["isAvailableNow"] = True
                copy_item["remainingCooldown"] = 0
            result.append(copy_item)
        return result

    async def get_dialogue(self, dialogue_id: str) -> Optional[Dict[str, Any]]:
        """Find a specific dialogue by ID."""
        dialogues = await self.fetch_dialogues()
        for d in dialogues:
            if d["id"] == dialogue_id:
                return d
        return None

    async def search_dialogues(
        self, query: Optional[str] = None, emotion: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search dialogues by query in text/translation/tags and emotion."""
        dialogues = await self.fetch_dialogues()
        q = (query or "").strip().lower()
        emo = (emotion or "").strip().lower()

        matches = []
        for d in dialogues:
            # Match emotion if specified
            if emo:
                d_emo = d.get("emotion", "").lower()
                all_tags_lower = [t.lower() for t in d.get("tags", [])]
                if emo not in d_emo and not any(emo in t for t in all_tags_lower):
                    continue

            # Match query if specified
            if q:
                text_match = q in d.get("lineText", "").lower()
                trans_match = q in d.get("lineTranslation", "").lower()
                tags_match = any(q in t.lower() for t in d.get("tags", []))
                if not (text_match or trans_match or tags_match):
                    continue

            matches.append(d)

        # If strict search returned nothing and query was given, fallback to all available
        if not matches and not emo and not q:
            matches = dialogues

        return matches

    def record_usage(self, dialogue_id: str) -> None:
        """Mark dialogue as used to initiate cooldown."""
        self._cooldown_tracker[dialogue_id] = time.time()

    def reset_cooldowns(self) -> None:
        """Reset cooldown tracker."""
        self._cooldown_tracker.clear()


supabase_dialogue_service = SupabaseDialogueService()

"""Meme Library Service managing catalog, cooldown tracking, and director prompts.

Integrates with Supabase dialogues table when configured, falling back to local DB.
"""

from typing import Any, Dict, List, Optional
from app.db.database import db_service
from app.services.supabase_service import supabase_dialogue_service


class MemeService:
    """Manages the meme soundboard, cooldowns, and catalog formatting."""

    async def list_memes(self) -> List[Dict[str, Any]]:
        """Return all memes/dialogues from Supabase and local DB."""
        local_items = await db_service.list_memes()
        if supabase_dialogue_service.is_configured:
            supa_items = await supabase_dialogue_service.fetch_dialogues()
            return supa_items + local_items
        return local_items

    async def get_meme(self, meme_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific meme/dialogue by ID."""
        if supabase_dialogue_service.is_configured:
            dialogue = await supabase_dialogue_service.get_dialogue(meme_id)
            if dialogue:
                return dialogue
        return await db_service.get_meme(meme_id)

    async def get_available_memes(self) -> List[Dict[str, Any]]:
        """Return only memes currently available (cooldown expired)."""
        memes = await self.list_memes()
        return [m for m in memes if m.get("isAvailableNow", True)]

    async def record_usage(self, meme_id: str) -> None:
        """Mark meme as used right now to trigger cooldown."""
        if supabase_dialogue_service.is_configured:
            supabase_dialogue_service.record_usage(meme_id)
        await db_service.record_meme_use(meme_id)

    async def reset_cooldowns(self) -> None:
        """Reset all meme cooldowns."""
        if supabase_dialogue_service.is_configured:
            supabase_dialogue_service.reset_cooldowns()
        await db_service.reset_all_meme_cooldowns()

    async def create_meme(
        self,
        id: str,
        title: str,
        file_path: str,
        audio_url: str,
        thumbnail_url: Optional[str] = None,
        duration_ms: int = 1500,
        tags: Optional[List[str]] = None,
        emotion: str = "laughter",
        context_hint: str = "",
        cooldown_seconds: int = 30,
    ) -> Dict[str, Any]:
        return await db_service.create_meme(
            id=id,
            title=title,
            file_path=file_path,
            audio_url=audio_url,
            thumbnail_url=thumbnail_url,
            duration_ms=duration_ms,
            tags=tags or [],
            emotion=emotion,
            context_hint=context_hint,
            cooldown_seconds=cooldown_seconds,
        )

    async def update_meme(
        self,
        meme_id: str,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
        emotion: Optional[str] = None,
        context_hint: Optional[str] = None,
        cooldown_seconds: Optional[int] = None,
        is_favorite: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        return await db_service.update_meme(
            meme_id=meme_id,
            title=title,
            tags=tags,
            emotion=emotion,
            context_hint=context_hint,
            cooldown_seconds=cooldown_seconds,
            is_favorite=is_favorite,
        )

    async def delete_meme(self, meme_id: str) -> bool:
        return await db_service.delete_meme(meme_id)

    def format_memes_for_director(self, memes: List[Dict[str, Any]]) -> str:
        """Format available dialogues as a concise reference table for the Reaction Director prompt."""
        if not memes:
            return "No memes or dialogues are currently available."

        lines = []
        for m in memes[:40]:  # Give director top matches to keep prompt focused
            status = "AVAILABLE" if m.get("isAvailableNow", True) else "ON COOLDOWN"
            line_txt = m.get("lineText") or m.get("title", "")
            translation = m.get("lineTranslation") or m.get("contextHint", "")
            lines.append(
                f"- ID: '{m['id']}' | Dialogue: \"{line_txt}\" | English: \"{translation}\" | Emotion: {m.get('emotion', 'comedy')} | Status: {status}"
            )
        return "\n".join(lines)


meme_service = MemeService()

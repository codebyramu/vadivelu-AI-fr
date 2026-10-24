"""Meme Library Service managing catalog, cooldown tracking, and director prompts."""

from typing import Any, Dict, List, Optional
from app.db.database import db_service


class MemeService:
    """Manages the meme soundboard, cooldowns, and catalog formatting."""

    async def list_memes(self) -> List[Dict[str, Any]]:
        return await db_service.list_memes()

    async def get_meme(self, meme_id: str) -> Optional[Dict[str, Any]]:
        return await db_service.get_meme(meme_id)

    async def get_available_memes(self) -> List[Dict[str, Any]]:
        """Return only memes currently available (cooldown expired)."""
        memes = await db_service.list_memes()
        return [m for m in memes if m.get("isAvailableNow", True)]

    async def record_usage(self, meme_id: str) -> None:
        """Mark meme as used right now to trigger cooldown."""
        await db_service.record_meme_use(meme_id)

    async def reset_cooldowns(self) -> None:
        """Reset all meme cooldowns (useful for test resets)."""
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
        """Format available memes as a concise reference table for the Reaction Director prompt."""
        if not memes:
            return "No memes are currently available (all are on cooldown)."

        lines = []
        for m in memes:
            status = "AVAILABLE" if m.get("isAvailableNow", True) else "ON COOLDOWN"
            lines.append(
                f"- ID: '{m['id']}' | Title: \"{m['title']}\" | Emotion: {m['emotion']} | Context: {m['contextHint']} | Status: {status}"
            )
        return "\n".join(lines)


meme_service = MemeService()

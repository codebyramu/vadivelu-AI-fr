"""User settings configuration APIs."""

from fastapi import APIRouter
from app.db.database import db_service
from app.models.schemas import UserSettings, UserSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("", response_model=UserSettings)
async def get_settings():
    """Retrieve current system and user preferences."""
    return await db_service.get_settings()


@router.post("", response_model=UserSettings)
@router.patch("", response_model=UserSettings)
async def update_settings(body: UserSettingsUpdate):
    """Update settings (personality preset, voice gender, meme settings, volume, etc.)."""
    updates = body.model_dump(exclude_unset=True, by_alias=True)
    return await db_service.update_settings(updates)

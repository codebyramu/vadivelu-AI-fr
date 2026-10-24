"""User settings and Gemini API Key configuration APIs."""

import os
import re
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import ROOT_DIR, settings
from app.core.key_rotator import key_rotator
from app.db.database import db_service
from app.models.schemas import UserSettings, UserSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class ApiKeysPayload(BaseModel):
    keys: List[str]


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


@router.post("/keys")
async def update_gemini_keys(payload: ApiKeysPayload):
    """Configures one or more Gemini API keys dynamically and updates rotation."""
    valid_keys = [k.strip() for k in payload.keys if k.strip() and not k.strip().startswith("your_")]
    if not valid_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one valid Gemini API key is required.",
        )

    # Update in environment and .env file
    env_lines = []
    env_file = ROOT_DIR / ".env"
    existing_other_lines = []

    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                if not re.match(r"^GEMINI_API_KEY(_\d+)?\s*=", line.strip()):
                    existing_other_lines.append(line)

    with open(env_file, "w", encoding="utf-8") as f:
        f.write("# Gemini API Keys configured via Settings\n")
        for i, k in enumerate(valid_keys, 1):
            env_var_name = f"GEMINI_API_KEY_{i}"
            os.environ[env_var_name] = k
            f.write(f"{env_var_name}={k}\n")
        f.write("\n")
        for line in existing_other_lines:
            f.write(line)

    # Reload rotator
    key_rotator.reload_keys()

    return {
        "status": "success",
        "totalKeys": key_rotator.total_keys,
        "activeKeys": key_rotator.active_keys_count,
        "message": f"Successfully configured {len(valid_keys)} Gemini API keys.",
    }

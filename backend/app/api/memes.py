"""Meme Catalog and Soundboard APIs."""

from typing import List
from fastapi import APIRouter, HTTPException

from app.models.schemas import MemeCreate, MemeMetadata, MemeUpdate
from app.services.meme_service import meme_service

router = APIRouter(prefix="/api/memes", tags=["Memes"])


@router.get("", response_model=List[MemeMetadata])
async def list_memes():
    """List all memes in the soundboard catalog with cooldown and availability status."""
    return await meme_service.list_memes()


@router.post("", response_model=MemeMetadata)
async def create_meme(body: MemeCreate):
    """Register a new meme into the catalog."""
    existing = await meme_service.get_meme(body.id)
    if existing:
        raise HTTPException(status_code=400, detail="Meme with this ID already exists.")

    return await meme_service.create_meme(
        id=body.id,
        title=body.title,
        file_path=body.file_path,
        audio_url=body.audio_url,
        thumbnail_url=body.thumbnail_url,
        duration_ms=body.duration_ms,
        tags=body.tags,
        emotion=body.emotion,
        context_hint=body.context_hint,
        cooldown_seconds=body.cooldown_seconds,
    )


@router.patch("/{meme_id}", response_model=MemeMetadata)
async def update_meme(meme_id: str, body: MemeUpdate):
    """Update meme tags, cooldown, emotion, context hint, or favorite status."""
    updated = await meme_service.update_meme(
        meme_id=meme_id,
        title=body.title,
        tags=body.tags,
        emotion=body.emotion,
        context_hint=body.context_hint,
        cooldown_seconds=body.cooldown_seconds,
        is_favorite=body.is_favorite,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Meme not found.")
    return updated


@router.delete("/{meme_id}")
async def delete_meme(meme_id: str):
    """Delete a meme from the soundboard."""
    success = await meme_service.delete_meme(meme_id)
    if not success:
        raise HTTPException(status_code=404, detail="Meme not found.")
    return {"success": True, "deletedId": meme_id}

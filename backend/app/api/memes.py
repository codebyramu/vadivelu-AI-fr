"""Meme Catalog and Soundboard APIs."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import MemeCreate, MemeMetadata, MemeUpdate
from app.services.meme_service import meme_service

router = APIRouter(prefix="/api/memes", tags=["Memes"])
dialogues_router = APIRouter(prefix="/api/dialogues", tags=["Dialogues"])


@router.get("/search", response_model=List[MemeMetadata])
@dialogues_router.get("/search", response_model=List[MemeMetadata])
async def search_dialogues(
    query: Optional[str] = Query(default=None, description="Search text across dialogue, translation, title, tags"),
    emotion: Optional[str] = Query(default=None, description="Filter by emotion/feeling"),
    tag: Optional[str] = Query(default=None, description="Filter by specific situation or emotion tag"),
    status: Optional[str] = Query(default=None, description="Filter by status: 'available', 'cooldown', or 'all'"),
    limit: int = Query(default=50, ge=1, le=200, description="Max results to return"),
):
    """Search dialogues and memes with full metadata, duration, tags, and availability status."""
    return await meme_service.search_memes(
        query=query,
        emotion=emotion,
        tag=tag,
        status=status,
        limit=limit,
    )


@dialogues_router.get("", response_model=List[MemeMetadata])
async def list_dialogues():
    """List all dialogues from Supabase and soundboard catalog."""
    return await meme_service.list_memes()


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

"""Memory CRUD endpoints."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import MemoryCreate, MemoryItem, MemoryUpdate
from app.services.memory_service import memory_service

router = APIRouter(prefix="/api/memories", tags=["Memories"])


@router.get("", response_model=List[MemoryItem])
async def list_memories(
    search: Optional[str] = Query(None),
    active_only: bool = Query(True, alias="activeOnly"),
):
    """List all long-term user memories."""
    return await memory_service.list_memories(search=search, active_only=active_only)


@router.post("", response_model=MemoryItem)
async def create_memory(body: MemoryCreate):
    """Add a new user memory manually."""
    if not body.key.strip() or not body.content.strip():
        raise HTTPException(status_code=400, detail="Key and content are required.")
    return await memory_service.create_memory(
        key=body.key,
        content=body.content,
        source_conversation_id=body.source_conversation_id,
    )


@router.patch("/{mem_id}", response_model=MemoryItem)
async def update_memory(mem_id: str, body: MemoryUpdate):
    """Update memory content, key, or active status."""
    updated = await memory_service.update_memory(
        mem_id=mem_id,
        key=body.key,
        content=body.content,
        is_active=body.is_active,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return updated


@router.delete("/{mem_id}")
async def delete_memory(mem_id: str):
    """Delete a memory item."""
    success = await memory_service.delete_memory(mem_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"success": True, "deletedId": mem_id}


@router.post("/clear")
async def clear_memories():
    """Clear all memories."""
    count = await memory_service.clear_all()
    return {"success": True, "clearedCount": count}

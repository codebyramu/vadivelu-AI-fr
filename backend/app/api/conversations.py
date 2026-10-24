"""Conversation management, message history, search, and branching."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.db.database import db_service
from app.models.schemas import (
    Conversation,
    ConversationCreate,
    ConversationDetail,
    ConversationUpdate,
    Message,
    SearchResponse,
)

router = APIRouter(tags=["Conversations"])


@router.get("/api/conversations", response_model=List[Conversation])
async def list_conversations(search: Optional[str] = Query(None)):
    """List all conversations ordered by recent activity."""
    return await db_service.list_conversations(search=search)


@router.post("/api/conversations", response_model=Conversation)
async def create_conversation(body: ConversationCreate):
    """Create a new conversation."""
    return await db_service.create_conversation(
        title=body.title, personality=body.personality or "normal"
    )


@router.get("/api/conversations/{conv_id}", response_model=ConversationDetail)
async def get_conversation(conv_id: str):
    """Get conversation details and full message history."""
    conv = await db_service.get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    messages = await db_service.get_conversation_messages(conv_id)
    return {**conv, "messages": messages}


@router.patch("/api/conversations/{conv_id}", response_model=Conversation)
async def update_conversation(conv_id: str, body: ConversationUpdate):
    """Rename conversation or change personality preset."""
    updated = await db_service.update_conversation(
        conv_id=conv_id, title=body.title, personality=body.personality
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return updated


@router.delete("/api/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    """Delete a conversation and all its messages."""
    success = await db_service.delete_conversation(conv_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"success": True, "deletedId": conv_id}


@router.post("/api/conversations/{conv_id}/branch")
async def branch_conversation(conv_id: str, message_id: str = Query(...)):
    """Delete all messages starting from message_id onward to prepare for regeneration."""
    res_conv_id = await db_service.delete_messages_after(message_id)
    if not res_conv_id:
        raise HTTPException(status_code=404, detail="Message not found.")
    return {"success": True, "conversationId": res_conv_id}


@router.get("/api/search", response_model=SearchResponse)
async def search_all(query: str = Query(..., min_length=1)):
    """Search conversations and messages."""
    return await db_service.search(query)

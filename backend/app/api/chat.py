"""Chat messaging and Reaction Director orchestration endpoint."""

from fastapi import APIRouter, HTTPException, status

from app.core.key_rotator import (
    AllKeysInCooldownError,
    AllKeysInvalidError,
    NoKeysConfiguredError,
)
from app.db.database import db_service
from app.models.schemas import (
    Message,
    SendMessageRequest,
    SendMessageResponse,
)
from app.services.reaction_director import reaction_director

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/message", response_model=SendMessageResponse)
async def send_chat_message(req: SendMessageRequest):
    """Processes user input, directs the performance (speech + meme interleaving), and stores state."""
    content = req.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty.",
        )

    # Resolve or create conversation
    conv_id = req.conversation_id
    conv = None
    if conv_id:
        conv = await db_service.get_conversation(conv_id)

    if not conv:
        # Generate initial title from user message snippet
        title = content[:35] + "..." if len(content) > 35 else content
        personality = req.personality_override or "normal"
        conv = await db_service.create_conversation(title=title, personality=personality)
        conv_id = conv["id"]
    elif req.personality_override and req.personality_override != conv["personality"]:
        conv = await db_service.update_conversation(
            conv_id=conv_id, personality=req.personality_override
        )

    active_personality = conv.get("personality", "normal")

    # Save user message
    user_msg_dict = await db_service.create_message(
        conversation_id=conv_id,
        role="user",
        content=content,
        voice=req.voice_override,
    )

    # Fetch conversation history for director context
    history = await db_service.get_conversation_messages(conv_id)

    try:
        plan, memories_created, key_alias = await reaction_director.plan_performance(
            user_message=content,
            conversation_id=conv_id,
            history=history,
            personality=active_personality,
            voice_override=req.voice_override,
        )
    except NoKeysConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except AllKeysInCooldownError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
            headers={"Retry-After": str(int(e.wait_seconds))},
        )
    except AllKeysInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reaction Director error: {e}",
        )

    # Consolidate speech segments into overall assistant text content
    speech_parts = [s.text for s in plan.segments if s.type == "speech"]
    assistant_content = " ".join(speech_parts).strip()
    if not assistant_content:
        assistant_content = "Vadivelu AI reaction."

    # Save assistant message with performance
    asst_msg_dict = await db_service.create_message(
        conversation_id=conv_id,
        role="assistant",
        content=assistant_content,
        voice=plan.voice,
        performance_dict=plan.model_dump(by_alias=True),
    )

    return SendMessageResponse(
        user_message=Message(**user_msg_dict),
        assistant_message=Message(**asst_msg_dict),
        performance=plan,
        memories_created=memories_created,
        key_alias_used=key_alias,
    )

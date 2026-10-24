"""Reaction Director: Orchestrates dynamic Gemini responses interleaved with iconic meme reactions,
using true Gemini tool calling for intelligent meme discovery and server-side speech pre-synthesis.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.key_rotator import (
    AllKeysInCooldownError,
    AllKeysInvalidError,
    KeyRotatorError,
    NoKeysConfiguredError,
    key_rotator,
)
from app.db.database import db_service
from app.models.schemas import (
    MemeMetadata,
    MemeSegment,
    PauseSegment,
    PerformancePlan,
    PerformanceSegment,
    PersonalityPreset,
    SpeechSegment,
    VoiceGender,
)
from app.services.gemini_service import gemini_service
from app.services.meme_service import meme_service
from app.services.memory_service import memory_service
from app.services.tool_service import tool_registry
from app.services.tts_service import get_cache_key, resolve_voice, tts_service

logger = logging.getLogger("vadivelu.director")

DIRECTOR_SYSTEM_PROMPT = """You are the Reaction Director for "Vadivelu AI" — a witty, intelligent conversational AI voice companion inspired by legendary Tamil cinema comedy timing and modern Apple minimalist warmth.

You do NOT just generate text. You DIRECT A HIGH-QUALITY SPOKEN AUDIO AND MEME PERFORMANCE.

Directing Guidelines:
1. RESPONSE LENGTH & TONE:
   - Casual conversation / quick queries: Short, punchy, conversational (1-3 sentences total).
   - Technical / educational queries: Clear, structured, helpful step-by-step explanations with subtle wit.
   - Serious / emotional / distress queries: Warm, empathetic, supportive, and STRICTLY DO NOT USE ANY MEMES.
   - Personality Presets:
     * normal: Friendly, balanced, witty timing.
     * funny_friend: Playful banter, comedic exaggeration.
     * sarcastic: Dry humor, playful irony.
     * high_energy: Hype, enthusiastic, triumphant.
     * calm_supportive: Gentle, encouraging, comforting.
     * study_technical: Precise, clear, structured.

2. INTELLIGENT MEME SELECTION VIA TOOLS:
   - You have access to real tools:
     * `search_meme_library(query, emotion)`: Search the soundboard by keyword or emotion.
     * `list_available_memes()`: List all memes currently ready and not on cooldown.
     * `lookup_user_memories(topic)`: Retrieve long-term memories and facts about the user.
   - When a user's context, victory, financial move, shocking news, or joke would genuinely be improved by a meme reaction, CALL `search_meme_library` to find the most fitting clip.
   - Intelligently decide whether to use a meme, which meme fits best, and where to place it between your spoken words.
   - If no meme fits or the situation is serious, do NOT force a meme; simply speak naturally.
   - NEVER invent fake meme IDs. Only use IDs returned by the tool.

3. CONTEXTUAL CALLBACKS:
   - When appropriate, connect recalled user memories (training, goals, pets, job) into your speech naturally.

4. FINAL RESPONSE OUTPUT FORMAT:
   Return ONLY a strict JSON object with this exact schema:
   {
     "voice": "female" | "male",
     "emotion": "celebration" | "shock" | "irony" | "laughter" | "awkward" | "calm" | "curious",
     "reasoning": "brief director notes explaining tone and placement",
     "segments": [
       { "type": "speech", "text": "spoken part 1" },
       { "type": "meme", "memeId": "valid_meme_id_from_tool" },
       { "type": "speech", "text": "spoken part 2" }
     ],
     "newMemories": [
       { "key": "user_fact_key", "content": "description of fact" }
     ]
   }
"""


def extract_json_from_gemini(raw_text: str) -> Dict[str, Any]:
    """Cleanly extracts and parses JSON even if wrapped in markdown code blocks or conversational text."""
    text = raw_text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Strip markdown code blocks ```json ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass

    # Try finding outer braces { ... }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace : last_brace + 1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    # Fallback plan from raw conversational text
    return {
        "voice": "female",
        "emotion": "neutral",
        "reasoning": "Direct Gemini conversational speech",
        "segments": [{"type": "speech", "text": text}],
        "newMemories": [],
    }


class ReactionDirector:
    """Orchestrates structured audio performances via dynamic Gemini generation and tool calling."""

    async def plan_performance(
        self,
        user_message: str,
        conversation_id: str,
        history: List[Dict[str, Any]],
        personality: PersonalityPreset = "normal",
        voice_override: Optional[VoiceGender] = None,
    ) -> Tuple[PerformancePlan, List[str], str]:
        """Directs the response into an ordered PerformancePlan dynamically generated by Gemini.

        Returns:
            Tuple[PerformancePlan, List[str], str]: (performance, created_memory_keys, key_alias_used)
        """
        # Load user settings
        user_settings = await db_service.get_settings()
        default_voice: VoiceGender = voice_override or user_settings.get("voiceGender", "female")
        memes_enabled = user_settings.get("memesEnabled", True)

        # Check if API keys exist
        if not key_rotator.has_keys:
            raise NoKeysConfiguredError(
                "No Gemini API keys configured. Please add your GEMINI_API_KEY_1 to .env or configure in Settings to chat."
            )

        all_memes = await meme_service.list_memes()
        meme_map = {m["id"]: m for m in all_memes}

        system_instruction = (
            f"{DIRECTOR_SYSTEM_PROMPT}\n\n"
            f"Active Personality Preset: {personality}\n"
            f"Default Voice Tone: {default_voice}\n"
            f"Memes Enabled Status: {'YES' if memes_enabled else 'DISABLED by user settings'}\n"
        )

        # Build contents from recent history + new message
        contents = []
        for h in history[-10:]:  # Last 10 messages for conversation context
            role = "user" if h["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h["content"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        # Provide tool calling so Gemini can search the meme soundboard intelligently
        tools = tool_registry.get_gemini_tools_spec() if memes_enabled else None

        raw_text, key_alias = await gemini_service.generate_content(
            contents=contents,
            system_instruction=system_instruction,
            tools=tools,
            tool_executor=tool_registry.execute_tool if tools else None,
        )

        # Parse plan safely
        plan_dict = extract_json_from_gemini(raw_text)

        # Process new memories extracted by LLM
        new_memory_keys = []
        for item in plan_dict.get("newMemories", []):
            if isinstance(item, dict) and "key" in item and "content" in item:
                await memory_service.create_memory(
                    key=item["key"],
                    content=item["content"],
                    source_conversation_id=conversation_id,
                )
                new_memory_keys.append(item["key"])

        # Also run heuristics to catch explicit personal facts
        heuristic_keys = await memory_service.record_user_facts(
            user_message, source_conv_id=conversation_id
        )
        for hk in heuristic_keys:
            if hk not in new_memory_keys:
                new_memory_keys.append(hk)

        final_voice = voice_override or plan_dict.get("voice", default_voice)
        if final_voice not in ("female", "male"):
            final_voice = default_voice

        # Enrich segments and pre-synthesize TTS audio on the server
        raw_segments = plan_dict.get("segments", [])
        validated_segments = await self._enrich_and_presynthesize_segments(
            raw_segments, meme_map, memes_enabled, final_voice
        )

        plan = PerformancePlan(
            voice=final_voice,
            emotion=plan_dict.get("emotion", "neutral"),
            reasoning=plan_dict.get("reasoning", "Dynamic reaction performance with tool discovery"),
            segments=validated_segments,
        )

        return plan, new_memory_keys, key_alias

    async def _enrich_and_presynthesize_segments(
        self,
        raw_segments: List[Dict[str, Any]],
        meme_map: Dict[str, Dict[str, Any]],
        memes_enabled: bool,
        voice: str,
    ) -> List[PerformanceSegment]:
        """Validate, hydrate metadata, record meme cooldowns, and pre-synthesize speech audio."""
        enriched: List[PerformanceSegment] = []

        for seg in raw_segments:
            seg_type = seg.get("type")
            if seg_type == "speech":
                text = str(seg.get("text", "")).strip()
                if text:
                    # Pre-synthesize or fetch cached audio for this speech segment on server
                    try:
                        resolved_voice = resolve_voice(voice)
                        await tts_service.synthesize(text=text, voice=resolved_voice)
                        cache_key = get_cache_key(text, resolved_voice, None, None)
                        audio_url = f"/cache/{cache_key}.mp3"
                    except Exception as e:
                        logger.warning(f"Server-side pre-synthesis failed for text '{text[:20]}...': {e}")
                        audio_url = None

                    enriched.append(SpeechSegment(text=text, audio_url=audio_url))

            elif seg_type == "meme" and memes_enabled:
                meme_id = seg.get("memeId")
                meme = meme_map.get(meme_id)
                # Ensure meme exists and is not on cooldown
                if meme and meme.get("isAvailableNow", True):
                    # Trigger cooldown
                    await meme_service.record_usage(meme_id)
                    enriched.append(
                        MemeSegment(
                            meme_id=meme_id,
                            title=meme["title"],
                            audio_url=meme["audioUrl"],
                            thumbnail_url=meme.get("thumbnailUrl"),
                            duration_ms=meme.get("durationMs", 1800),
                        )
                    )
                else:
                    logger.info(f"Meme '{meme_id}' is unavailable or on cooldown. Skipping.")
            elif seg_type == "pause":
                enriched.append(PauseSegment(duration_ms=seg.get("durationMs", 350)))

        # Fallback if no valid speech segments were returned
        if not enriched:
            fallback_text = "I am listening! How can I help you next?"
            try:
                resolved_voice = resolve_voice(voice)
                await tts_service.synthesize(text=fallback_text, voice=resolved_voice)
                cache_key = get_cache_key(fallback_text, resolved_voice, None, None)
                fallback_url = f"/cache/{cache_key}.mp3"
            except Exception:
                fallback_url = None
            enriched.append(SpeechSegment(text=fallback_text, audio_url=fallback_url))

        return enriched


reaction_director = ReactionDirector()

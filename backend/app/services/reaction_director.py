"""Reaction Director: Orchestrates speech interleaved with iconic meme reactions."""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.key_rotator import NoKeysConfiguredError, key_rotator
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

logger = logging.getLogger("vadivelu.director")

DIRECTOR_SYSTEM_PROMPT = """You are the Reaction Director for "Vadivelu AI" — a witty, charismatic, Apple-inspired conversational AI voice companion inspired by legendary Tamil cinema comedy timing and modern warmth.

Your goal is not just to generate text, but to DIRECT A COMPLETE AUDIO PERFORMANCE. You interleave spoken dialogue with iconic meme sound clips.

Follow these strict directing rules:
1. RESPONSE LENGTH & TONE:
   - Casual chit-chat / quick queries: Short, punchy, lively (1-3 sentences total).
   - Technical / educational queries: Clear, structured, helpful explanations with subtle wit.
   - Serious / emotional / distress / health issues: Warm, empathetic, supportive, and STRICTLY DO NOT USE ANY MEMES.
   - Personality Presets:
     * normal: Friendly, witty, well-timed comedy.
     * funny_friend: Playful banter, comedic exaggeration.
     * sarcastic: Dry humor, ironic memes.
     * high_energy: Hype, excitement, triumphant reactions.
     * calm_supportive: Gentle, encouraging, comforting.
     * study_technical: Precise, clear, subtle jokes.

2. MEME PLACEMENT RULES:
   - Only choose meme IDs from the AVAILABLE MEMES list below.
   - Never use a meme if it's on cooldown.
   - Use AT MOST 1 or 2 memes per response. Memes should enhance the comedic punch, not spam.
   - You can place memes before speech, between speech sentences, or after speech.
   - If no meme fits the moment, or for serious topics, DO NOT include any meme segment.

3. CONTEXTUAL CALLBACKS:
   - Check the RECALLED USER MEMORIES. If the user previously mentioned a goal, pet, job, or hobby (e.g. running a marathon, learning code), make a natural, witty callback!

4. EXTRACT NEW USER FACTS:
   - If the user shares a personal fact (e.g. "I'm training for a marathon", "My cat is Luna", "I got a new job"), include it in the "newMemories" list.

5. OUTPUT FORMAT:
   Return ONLY a strict JSON object with this exact schema:
   {
     "voice": "female" | "male",
     "emotion": "celebration" | "shock" | "irony" | "laughter" | "awkward" | "calm" | "curious",
     "reasoning": "brief director notes explaining tone and placement",
     "segments": [
       { "type": "speech", "text": "spoken part 1" },
       { "type": "meme", "memeId": "meme_id_here" },
       { "type": "speech", "text": "spoken part 2" }
     ],
     "newMemories": [
       { "key": "user_fact_key", "content": "description of fact" }
     ]
   }
"""


class ReactionDirector:
    """Orchestrates structured audio performances."""

    async def plan_performance(
        self,
        user_message: str,
        conversation_id: str,
        history: List[Dict[str, Any]],
        personality: PersonalityPreset = "normal",
        voice_override: Optional[VoiceGender] = None,
        force_rehearsal: bool = False,
    ) -> Tuple[PerformancePlan, List[str], str]:
        """Directs the response into an ordered PerformancePlan.

        Returns:
            Tuple[PerformancePlan, List[str], str]: (performance, created_memory_keys, key_alias_used)
        """
        # Load user settings
        user_settings = await db_service.get_settings()
        default_voice: VoiceGender = voice_override or user_settings.get("voiceGender", "female")
        memes_enabled = user_settings.get("memesEnabled", True)

        # Retrieve active memories and meme catalog
        active_memories = await memory_service.list_memories(active_only=True)
        all_memes = await meme_service.list_memes()
        meme_map = {m["id"]: m for m in all_memes}
        available_memes = [m for m in all_memes if m.get("isAvailableNow", True)]

        # Check if keys exist or if rehearsal mode is needed
        if force_rehearsal or not key_rotator.has_keys:
            if not key_rotator.has_keys and not force_rehearsal:
                # If no keys in env, check if user provided MOCK_GEMINI=true or environment allows rehearsal
                allow_mock = settings.ENVIRONMENT in ("development", "test") or "pytest" in str(
                    settings.BACKEND_DIR
                )
                if not allow_mock:
                    raise NoKeysConfiguredError(
                        "No Gemini API keys configured. Please add GEMINI_API_KEY_1 to .env"
                    )

            # Run intelligent Rehearsal Director
            return await self._plan_rehearsal_performance(
                user_message=user_message,
                conversation_id=conversation_id,
                personality=personality,
                voice=default_voice,
                memories=active_memories,
                available_memes=available_memes if memes_enabled else [],
                meme_map=meme_map,
            )

        # Format prompt sections
        memories_text = memory_service.format_memories_for_prompt(active_memories)
        memes_text = (
            meme_service.format_memes_for_director(available_memes)
            if memes_enabled
            else "Memes are currently DISABLED by user settings. Do not include meme segments."
        )

        system_instruction = (
            f"{DIRECTOR_SYSTEM_PROMPT}\n\n"
            f"Active Personality: {personality}\n"
            f"Default Voice: {default_voice}\n\n"
            f"{memories_text}\n\n"
            f"[AVAILABLE MEMES IN SOUNDBOARD]:\n{memes_text}\n"
        )

        # Build contents from recent history + new message
        contents = []
        for h in history[-8:]:  # Last 8 messages for context
            role = "user" if h["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h["content"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        try:
            raw_json, key_alias = await gemini_service.generate_content(
                contents=contents,
                system_instruction=system_instruction,
            )
            # Parse response
            plan_dict = json.loads(raw_json)
        except Exception as e:
            logger.warning(f"Gemini call or JSON parsing failed: {e}. Falling back to rehearsal.")
            return await self._plan_rehearsal_performance(
                user_message=user_message,
                conversation_id=conversation_id,
                personality=personality,
                voice=default_voice,
                memories=active_memories,
                available_memes=available_memes if memes_enabled else [],
                meme_map=meme_map,
            )

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

        # Also run heuristics in case LLM missed any explicit user declarations
        heuristic_keys = await memory_service.record_user_facts(
            user_message, source_conv_id=conversation_id
        )
        for hk in heuristic_keys:
            if hk not in new_memory_keys:
                new_memory_keys.append(hk)

        # Enrich and sanitize segments
        raw_segments = plan_dict.get("segments", [])
        validated_segments = await self._enrich_segments(
            raw_segments, meme_map, memes_enabled
        )

        plan = PerformancePlan(
            voice=plan_dict.get("voice", default_voice),
            emotion=plan_dict.get("emotion", "neutral"),
            reasoning=plan_dict.get("reasoning", "Directed performance."),
            segments=validated_segments,
        )

        return plan, new_memory_keys, key_alias

    async def _enrich_segments(
        self,
        raw_segments: List[Dict[str, Any]],
        meme_map: Dict[str, Dict[str, Any]],
        memes_enabled: bool,
    ) -> List[PerformanceSegment]:
        """Validate, hydrate metadata, and record cooldown usage for meme segments."""
        enriched: List[PerformanceSegment] = []

        for seg in raw_segments:
            seg_type = seg.get("type")
            if seg_type == "speech":
                text = str(seg.get("text", "")).strip()
                if text:
                    enriched.append(SpeechSegment(text=text))

            elif seg_type == "meme" and memes_enabled:
                meme_id = seg.get("memeId")
                meme = meme_map.get(meme_id)
                # Ensure meme exists and is not in cooldown
                if meme and meme.get("isAvailableNow", True):
                    # Record usage to set cooldown
                    await meme_service.record_usage(meme_id)
                    enriched.append(
                        MemeSegment(
                            meme_id=meme_id,
                            title=meme["title"],
                            audio_url=meme["audioUrl"],
                            thumbnail_url=meme.get("thumbnailUrl"),
                            duration_ms=meme.get("durationMs", 1500),
                        )
                    )
                else:
                    # If meme is unavailable or invalid, replace with a brief pause
                    logger.info(
                        f"Meme {meme_id} is unavailable or invalid. Omitted from performance."
                    )
            elif seg_type == "pause":
                enriched.append(PauseSegment(duration_ms=seg.get("durationMs", 400)))

        # Fallback if no valid speech segments were returned
        if not enriched:
            enriched.append(
                SpeechSegment(
                    text="Vadivelu AI here! Ready to rock with full comedy timing!"
                )
            )

        return enriched

    async def _plan_rehearsal_performance(
        self,
        user_message: str,
        conversation_id: str,
        personality: PersonalityPreset,
        voice: VoiceGender,
        memories: List[Dict[str, Any]],
        available_memes: List[Dict[str, Any]],
        meme_map: Dict[str, Dict[str, Any]],
    ) -> Tuple[PerformancePlan, List[str], str]:
        """Intelligent rule-based Rehearsal Director when no API keys are provided or for testing."""
        msg_lower = user_message.lower()

        # Extract memories
        created_keys = await memory_service.record_user_facts(
            user_message, source_conv_id=conversation_id
        )

        # Check for callbacks from existing memories
        callback_text = ""
        for m in memories:
            if "training" in m["key"] or "marathon" in m["content"].lower():
                callback_text = " By the way, how is your training going? Don't skip your running sessions!"
                break
            elif "pet" in m["key"]:
                callback_text = " Give my love to your pet!"
                break

        avail_ids = {m["id"] for m in available_memes}
        segments: List[PerformanceSegment] = []
        emotion = "laughter"
        reasoning = f"Rehearsal director response under '{personality}' personality preset."

        # Detect topic and select fitting meme and speech
        if any(w in msg_lower for w in ("money", "crypto", "invest", "stonk", "profit", "deal")):
            emotion = "irony"
            speech1 = "Look at this financial mastermind in the room!"
            speech2 = f"One step closer to Forbes 30 under 30!{callback_text}"
            segments.append(SpeechSegment(text=speech1))
            if "stonks" in avail_ids:
                m = meme_map["stonks"]
                await meme_service.record_usage("stonks")
                segments.append(
                    MemeSegment(
                        meme_id="stonks",
                        title=m["title"],
                        audio_url=m["audioUrl"],
                        thumbnail_url=m["thumbnailUrl"],
                        duration_ms=m["durationMs"],
                    )
                )
            segments.append(SpeechSegment(text=speech2))

        elif any(
            w in msg_lower
            for w in (
                "win",
                "won",
                "passed",
                "success",
                "achieved",
                "completed",
                "marathon",
                "running",
                "champion",
                "competition",
                "victory",
            )
        ):
            emotion = "celebration"
            speech1 = "Sensational! Now that is what I call absolute champion performance!"
            speech2 = f"You knocked it straight out of the park!{callback_text}"
            segments.append(SpeechSegment(text=speech1))
            if "kalakkunga" in avail_ids:
                m = meme_map["kalakkunga"]
                await meme_service.record_usage("kalakkunga")
                segments.append(
                    MemeSegment(
                        meme_id="kalakkunga",
                        title=m["title"],
                        audio_url=m["audioUrl"],
                        thumbnail_url=m["thumbnailUrl"],
                        duration_ms=m["durationMs"],
                    )
                )
            segments.append(SpeechSegment(text=speech2))

        elif any(w in msg_lower for w in ("shock", "surprise", "unbelievable", "omg", "what happened")):
            emotion = "shock"
            speech1 = "Wait, what?! Hold on a second, are you for real right now?"
            speech2 = f"My jaw is officially on the floor!{callback_text}"
            segments.append(SpeechSegment(text=speech1))
            if "adengappa" in avail_ids:
                m = meme_map["adengappa"]
                await meme_service.record_usage("adengappa")
                segments.append(
                    MemeSegment(
                        meme_id="adengappa",
                        title=m["title"],
                        audio_url=m["audioUrl"],
                        thumbnail_url=m["thumbnailUrl"],
                        duration_ms=m["durationMs"],
                    )
                )
            segments.append(SpeechSegment(text=speech2))

        elif any(w in msg_lower for w in ("sad", "missed", "lost", "fail", "forgot", "bad luck", "ruined")):
            emotion = "awkward"
            speech1 = "Aiyo! Such a golden opportunity vanished into thin air!"
            speech2 = f"Don't worry, every champion faces a hiccup. Tomorrow is another day!{callback_text}"
            segments.append(SpeechSegment(text=speech1))
            if "vadapoche" in avail_ids:
                m = meme_map["vadapoche"]
                await meme_service.record_usage("vadapoche")
                segments.append(
                    MemeSegment(
                        meme_id="vadapoche",
                        title=m["title"],
                        audio_url=m["audioUrl"],
                        thumbnail_url=m["thumbnailUrl"],
                        duration_ms=m["durationMs"],
                    )
                )
            segments.append(SpeechSegment(text=speech2))

        elif any(w in msg_lower for w in ("drama", "headache", "suffering", "problem", "traffic", "bug")):
            emotion = "awkward"
            speech1 = "What kind of unbearable cosmic drama has descended upon us today!"
            speech2 = f"Take a deep breath. We will survive this madness!{callback_text}"
            segments.append(SpeechSegment(text=speech1))
            if "enna_koduma" in avail_ids:
                m = meme_map["enna_koduma"]
                await meme_service.record_usage("enna_koduma")
                segments.append(
                    MemeSegment(
                        meme_id="enna_koduma",
                        title=m["title"],
                        audio_url=m["audioUrl"],
                        thumbnail_url=m["thumbnailUrl"],
                        duration_ms=m["durationMs"],
                    )
                )
            segments.append(SpeechSegment(text=speech2))

        elif any(w in msg_lower for w in ("hurt", "depressed", "emergency", "sick", "hospital", "pain")):
            # Serious / distressed -> empathetic, NO MEMES!
            emotion = "calm"
            segments.append(
                SpeechSegment(
                    text="I am truly sorry you're going through this. Please take gentle care of yourself, and don't hesitate to reach out to someone who can support you. I'm right here with you."
                )
            )

        else:
            # Default lively response
            speech1 = "Vanakkam! Vadivelu AI in the house, fully energized and ready for you!"
            speech2 = f"Hit me with whatever is on your mind!{callback_text}"
            segments.append(SpeechSegment(text=speech1))
            if "aahaa" in avail_ids:
                m = meme_map["aahaa"]
                await meme_service.record_usage("aahaa")
                segments.append(
                    MemeSegment(
                        meme_id="aahaa",
                        title=m["title"],
                        audio_url=m["audioUrl"],
                        thumbnail_url=m["thumbnailUrl"],
                        duration_ms=m["durationMs"],
                    )
                )
            segments.append(SpeechSegment(text=speech2))

        plan = PerformancePlan(
            voice=voice,
            emotion=emotion,
            reasoning=reasoning,
            segments=segments,
        )

        return plan, created_keys, "mock-rehearsal"


reaction_director = ReactionDirector()

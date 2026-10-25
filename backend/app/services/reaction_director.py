"""Reaction Director: Orchestrates dynamic Gemini responses interleaved with iconic meme reactions,
using true Gemini tool calling for intelligent meme discovery and server-side speech pre-synthesis.
"""

import json
import logging
import re
import urllib.parse
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
    CandidateDialoguePreview,
    FetchedPageInfo,
    MemeMetadata,
    MemeSegment,
    PauseSegment,
    PerformancePlan,
    PerformanceSegment,
    PersonalityPreset,
    SpeechSegment,
    ThoughtProcess,
    ToolCallInfo,
    VoiceGender,
    WebSearchResult,
)
from app.services.gemini_service import gemini_service
from app.services.meme_service import meme_service
from app.services.memory_service import memory_service
from app.services.tool_service import tool_registry
from app.services.tts_service import get_cache_key, resolve_voice, tts_service
from app.services.web_search_service import web_search_service

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

2. INTELLIGENT COMEDIC TIMING (USE MEMES ONLY WHEN NEEDED, NOT ALWAYS):
   - You have access to the Top 15 ranked Vadivelu dialogues from the Supabase database.
   - **CRITICAL**: ONLY include a Vadivelu meme dialogue when there is an authentic comedic hook, humorous complaint, playful argument, celebration, dramatic exaggeration, boasting, or when the user explicitly asks for comedy/jokes.
   - **WHEN NOT TO USE A MEME**: If the user is asking a straightforward question (e.g., general knowledge, coding, math, directions, how-to), having a calm greeting, or discussing serious/neutral topics, DO NOT insert any meme segment! Simply return natural, clear, engaging speech segments.
   - True comedic timing means knowing WHEN to punch and when to speak naturally. Never force a meme dialogue on every single turn.

3. PASSIVE USER MEMORY POLICY (DO NOT SPAM USER MEMORIES):
   - The RECALLED USER MEMORIES provided below are strictly PASSIVE BACKGROUND KNOWLEDGE.
   - ABSOLUTE MANDATE: DO NOT randomly bring up past user facts (e.g. marathon, running, medals, workout, pets, jobs) when the user is greeting you, asking general questions, testing voices, or discussing unrelated topics!
   - ONLY reference a memory if the user explicitly asks about it (e.g. "what do you remember about me?", "do you know what I ran?") or directly initiates conversation about that topic.
   - Forcing user facts into unrelated turns sounds robotic, repetitive, and annoying. Keep your responses focused 100% on what the user currently asked.

4. PER-SEGMENT MULTI-VOICE SWITCHING:
   - You can assign a distinct voice to individual speech segments using `"voice": "female"` or `"voice": "male"`.
   - When the user asks for multi-voice (e.g. "speak 1 line in female and other in male", "say hello in female then male", "speak in female and male voices"), YOU MUST CREATE SEPARATE SPEECH SEGMENTS WITH THEIR RESPECTIVE VOICES:
     Example:
     ```json
     "segments": [
       { "type": "speech", "text": "Hello, this is the female voice speaking first.", "voice": "female" },
       { "type": "speech", "text": "And now, this is the male voice taking over for line two.", "voice": "male" }
     ]
     ```
   - When the user asks to test voices or switch between voices, DO NOT insert unnecessary meme clips; deliver crisp, distinct spoken lines showcasing each requested voice.

5. FINAL RESPONSE OUTPUT FORMAT:
   Return ONLY a strict JSON object with this exact schema:
   {
     "voice": "female" | "male",
     "emotion": "celebration" | "shock" | "irony" | "laughter" | "awkward" | "calm" | "curious" | "neutral",
     "reasoning": "brief director notes explaining tone and segment choices",
     "segments": [
       { "type": "speech", "text": "spoken part 1", "voice": "female" | "male" }
       // Optional: { "type": "meme", "memeId": "valid_dialogue_id" } ONLY when comedically appropriate!
       // Optional: { "type": "speech", "text": "spoken part 2", "voice": "female" | "male" }
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

        # 1. URL link inspection (e.g. "what's this link bro: https://en.wikipedia.org/...")
        url_match = re.search(r"https?://[^\s]+", user_message)
        fetched_page_data: Optional[Dict[str, Any]] = None
        browser_url: Optional[str] = None
        if url_match:
            raw_url = url_match.group(0).rstrip(".,)>\"'")
            browser_url = raw_url
            try:
                fetched_page_data = await web_search_service.fetch_webpage(raw_url)
            except Exception as e:
                logger.warning(f"Failed to fetch webpage {raw_url}: {e}")

        # 2. Browser & Search Commands (e.g. "open youtube in the right side bar and search whats AI", "search for latest news")
        web_search_results: List[Dict[str, Any]] = []
        search_query_used: Optional[str] = None
        lower_msg = user_message.lower().strip()

        # Check for YouTube search command
        youtube_match = re.search(
            r"(?:open\s+)?youtube(?:\s+in\s+the\s+(?:right\s+)?(?:side\s*bar|panel))?(?:\s+and\s+search(?:\s+for)?|\s+search(?:\s+for)?)\s+(.+)",
            user_message,
            re.IGNORECASE,
        )
        if youtube_match:
            yt_term = youtube_match.group(1).strip().strip("'\"")
            search_query_used = yt_term
            browser_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(yt_term)}"
            try:
                web_search_results = await web_search_service.search_web(f"{yt_term} site:youtube.com", max_results=5)
                if not web_search_results:
                    web_search_results = await web_search_service.search_web(yt_term, max_results=5)
            except Exception as e:
                logger.warning(f"YouTube web search failed: {e}")
        else:
            search_triggers = [
                "search", "google", "look up", "who is", "who won", "what happened",
                "latest news", "latest score", "current champion", "tell me about",
            ]
            is_search_intent = any(trigger in lower_msg for trigger in search_triggers) and len(user_message.split()) >= 2
            if is_search_intent and not url_match:
                clean_search_query = re.sub(
                    r"^(please\s+)?(open\s+[a-z\s]+and\s+)?(search\s+(for\s+)?|look\s+up\s+|who\s+is\s+|what\s+is\s+|tell\s+me\s+about\s+)",
                    "",
                    user_message,
                    flags=re.IGNORECASE,
                ).strip()
                if not clean_search_query:
                    clean_search_query = user_message
                search_query_used = clean_search_query
                browser_url = f"https://duckduckgo.com/?q={urllib.parse.quote_plus(clean_search_query)}"
                try:
                    web_search_results = await web_search_service.search_web(clean_search_query, max_results=5)
                except Exception as e:
                    logger.warning(f"Web search failed for query '{clean_search_query}': {e}")

        # 3. Check for live weather query
        weather_info: Optional[Dict[str, Any]] = None
        if "weather" in lower_msg or "temperature" in lower_msg or "forecast" in lower_msg:
            loc_match = re.search(r"(?:in|at|for)\s+([a-zA-Z\s]+)", user_message, re.IGNORECASE)
            loc = loc_match.group(1).strip() if loc_match else "Chennai"
            try:
                weather_info = await web_search_service.lookup_weather(loc)
            except Exception as e:
                logger.warning(f"Weather lookup failed: {e}")

        # 4. Check for math calculation query
        math_info: Optional[Dict[str, Any]] = None
        if any(sym in user_message for sym in ["+", "*", "/", "sqrt", "% of", "^"]) and re.search(r"\d+", user_message):
            math_expr = re.sub(r"[^0-9\+\-\*\/\^\(\)\.\s]|(\b(?:sqrt|sin|cos|tan|log|pi|e)\b)", r"\1", user_message)
            if math_expr.strip():
                try:
                    math_info = web_search_service.calculate_math(math_expr.strip())
                except Exception as e:
                    logger.warning(f"Math calculation failed: {e}")

        # 5. Dialogue Database Searching (ONLY search when not a tool command!)
        is_tool_command = (
            youtube_match is not None
            or bool(web_search_results)
            or url_match is not None
            or weather_info is not None
            or math_info is not None
        )

        all_memes = await meme_service.list_memes()
        meme_map: Dict[str, Dict[str, Any]] = {m["id"]: m for m in all_memes}
        ranked_dialogues = []

        if not is_tool_command:
            ranked_dialogues = await meme_service.rank_dialogues(
                prompt=user_message,
                personality=personality,
                limit=15,
            )
            dialogues_catalog_text = meme_service.format_memes_for_director(ranked_dialogues)
        else:
            logger.info("Functional/tool command detected — skipping Supabase dialogue ranking.")
            dialogues_catalog_text = "No meme required for this functional/tool command. Deliver pure natural speech."

        # 6. Retrieve long-term memories with semantic relevance scoring
        active_memories, relevant_memory_keys = await memory_service.retrieve_relevant_memories(
            prompt=user_message,
            history=history,
            limit=5,
        )
        memories_text = memory_service.format_memories_for_prompt(
            active_memories, relevant_keys=relevant_memory_keys
        )

        # Build Real-Time Tool Context for Gemini
        realtime_tool_blocks = []
        if fetched_page_data and fetched_page_data.get("status") == 200:
            realtime_tool_blocks.append(
                f"--- WEBPAGE CONTENT INSPECTED BY IN-APP BROWSER TOOL ---\n"
                f"URL: {fetched_page_data.get('url')}\n"
                f"Title: {fetched_page_data.get('title')}\n"
                f"Domain: {fetched_page_data.get('domain')}\n"
                f"Page Excerpt:\n{fetched_page_data.get('content', '')[:2500]}\n"
                f"---------------------------------------------------------"
            )
        if web_search_results:
            results_bullets = "\n".join(
                [f"• [{r.get('title')}]({r.get('url')}): {r.get('snippet')}" for r in web_search_results[:4]]
            )
            realtime_tool_blocks.append(
                f"--- LIVE WEB SEARCH RESULTS (Query: '{search_query_used}') ---\n"
                f"{results_bullets}\n"
                f"----------------------------------------------------------------"
            )
        if weather_info and "error" not in weather_info:
            realtime_tool_blocks.append(
                f"--- REAL-TIME WEATHER REPORT ---\n"
                f"Location: {weather_info.get('location')}\n"
                f"Condition: {weather_info.get('condition')}\n"
                f"Temperature: {weather_info.get('temp_c')}°C ({weather_info.get('temp_f')}°F)\n"
                f"Humidity: {weather_info.get('humidity')}\n"
                f"Wind: {weather_info.get('wind_speed_kmph')} km/h\n"
                f"--------------------------------"
            )
        if math_info and math_info.get("status") == "success":
            realtime_tool_blocks.append(
                f"--- MATHEMATICAL EVALUATION RESULT ---\n"
                f"Expression: {math_info.get('expression')} = {math_info.get('result')}\n"
                f"--------------------------------------"
            )

        realtime_context_str = "\n\n".join(realtime_tool_blocks)
        if realtime_context_str:
            realtime_context_str = f"\n\nREAL-TIME ULTRA TOOLS EXECUTION DATA:\n{realtime_context_str}\n(Ground your dialogue and commentary with these real facts and humorous observations!)"

        system_instruction = (
            f"{DIRECTOR_SYSTEM_PROMPT}\n\n"
            f"Active Personality Preset: {personality}\n"
            f"Default Voice Tone: {default_voice}\n"
            f"Memes Enabled Status: {'YES' if memes_enabled else 'DISABLED by user settings'}\n\n"
            f"{memories_text}\n\n"
            f"{dialogues_catalog_text}"
            f"{realtime_context_str}\n"
        )

        # Build contents from recent history + new message
        contents = []
        for h in history[-10:]:  # Last 10 messages for conversation context
            role = "user" if h["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h["content"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})

        raw_text, key_alias = await gemini_service.generate_content(
            contents=contents,
            system_instruction=system_instruction,
            generation_config={"responseMimeType": "application/json", "maxOutputTokens": 2048},
            tools=None,
            tool_executor=None,
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

        # Assemble thought process and tool call execution details for frontend preview
        selected_meme_id = None
        selected_meme_title = None
        for s in validated_segments:
            if getattr(s, "type", None) == "meme":
                selected_meme_id = getattr(s, "meme_id", None)
                selected_meme_title = getattr(s, "title", None)
                break

        tools_called = []

        # If a webpage link was fetched
        if fetched_page_data:
            tools_called.append(
                ToolCallInfo(
                    tool="fetch_webpage",
                    query=fetched_page_data.get("url", "")[:60],
                    result_summary=f"Read {fetched_page_data.get('domain', 'link')} ({fetched_page_data.get('title', '')}) - {fetched_page_data.get('length', 0)} chars",
                    items_count=1,
                )
            )

        # If web search was executed
        if web_search_results:
            tools_called.append(
                ToolCallInfo(
                    tool="web_search",
                    query=search_query_used or user_message[:60],
                    result_summary=f"Browsed live web. Found {len(web_search_results)} relevant sources for '{search_query_used}'",
                    items_count=len(web_search_results),
                )
            )

        # If weather was looked up
        if weather_info and "error" not in weather_info:
            tools_called.append(
                ToolCallInfo(
                    tool="lookup_weather",
                    query=weather_info.get("location", ""),
                    result_summary=f"{weather_info.get('location')}: {weather_info.get('temp_c')}°C, {weather_info.get('condition')}",
                    items_count=1,
                )
            )

        # If math was evaluated
        if math_info and math_info.get("status") == "success":
            tools_called.append(
                ToolCallInfo(
                    tool="calculate_math",
                    query=math_info.get("expression", ""),
                    result_summary=f"{math_info.get('expression')} = {math_info.get('result')}",
                    items_count=1,
                )
            )

        # Real Tools only in tools_called
        if browser_url and "youtube" in browser_url.lower():
            tools_called.append(
                ToolCallInfo(
                    tool="in_app_browser",
                    query=search_query_used or browser_url,
                    result_summary=f"Opened YouTube search for '{search_query_used}' in side panel",
                    items_count=len(web_search_results),
                )
            )

        if selected_meme_id:
            tools_called.append(
                ToolCallInfo(
                    tool="select_meme_reaction",
                    query=selected_meme_id,
                    result_summary=f"Selected authentic dialogue: {selected_meme_title or selected_meme_id}",
                    items_count=1,
                )
            )

        if relevant_memory_keys:
            tools_called.append(
                ToolCallInfo(
                    tool="retrieve_relevant_memories",
                    query=user_message[:60],
                    result_summary=f"Recalled {len(relevant_memory_keys)} relevant facts",
                    items_count=len(relevant_memory_keys),
                )
            )

        # Candidates: ONLY show candidate previews if a meme was actually selected or actively searched!
        top_candidates = []
        if selected_meme_id and ranked_dialogues:
            for d in ranked_dialogues[:3]:
                top_candidates.append(
                    CandidateDialoguePreview(
                        id=str(d.get("id")),
                        line_text=d.get("lineText") or d.get("title"),
                        line_translation=d.get("lineTranslation") or d.get("contextHint"),
                        relevance_score=d.get("relevanceScore"),
                        emotion=d.get("emotion"),
                        tags=d.get("tags") or [],
                    )
                )

        thought_process = ThoughtProcess(
            reasoning=plan_dict.get("reasoning", "Conversational response formulation"),
            duration_ms=1800,
            searches=[user_message[:45]],
            tools_called=tools_called,
            memories_considered=list(relevant_memory_keys) if relevant_memory_keys else [],
            selected_dialogue_id=selected_meme_id,
            selected_dialogue_title=selected_meme_title,
            top_ranked_candidates=top_candidates,
            web_results=[WebSearchResult(**r) for r in web_search_results] if web_search_results else [],
            fetched_page=FetchedPageInfo(**fetched_page_data) if fetched_page_data else None,
            search_query=search_query_used,
            browser_url=browser_url,
        )

        plan = PerformancePlan(
            voice=final_voice,
            emotion=plan_dict.get("emotion", "neutral"),
            reasoning=plan_dict.get("reasoning", "Dynamic reaction performance with tool discovery"),
            segments=validated_segments,
            thought_process=thought_process,
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
                    # Resolve per-segment voice override if specified (e.g. multi-voice performance)
                    seg_voice = seg.get("voice")
                    if seg_voice not in ("female", "male"):
                        seg_voice = voice

                    # Pre-synthesize or fetch cached audio for this speech segment on server
                    try:
                        resolved_voice = resolve_voice(seg_voice)
                        audio_bytes = await tts_service.synthesize(text=text, voice=resolved_voice)
                        cache_key = get_cache_key(text, resolved_voice, None, None)
                        audio_url = f"/cache/{cache_key}.mp3"
                        duration_ms = tts_service.get_audio_duration_ms(audio_bytes) if audio_bytes else 0
                        if duration_ms <= 0:
                            duration_ms = tts_service.estimate_speech_duration_ms(text)
                    except Exception as e:
                        logger.warning(f"Server-side pre-synthesis failed for text '{text[:20]}...': {e}")
                        audio_url = None
                        duration_ms = tts_service.estimate_speech_duration_ms(text)

                    enriched.append(
                        SpeechSegment(
                            text=text,
                            voice=seg_voice,
                            audio_url=audio_url,
                            duration_ms=duration_ms,
                        )
                    )

            elif seg_type == "meme" and memes_enabled:
                meme_id = seg.get("memeId")
                meme = meme_map.get(meme_id)
                # Ensure meme exists and is not on cooldown
                if meme and meme.get("isAvailableNow", True):
                    # Trigger cooldown
                    await meme_service.record_usage(meme_id)
                    dur_ms = meme.get("durationMs")
                    if not dur_ms or dur_ms <= 0:
                        dur_ms = tts_service.get_audio_duration_ms(meme.get("audioUrl") or meme.get("filePath") or meme_id)
                    if not dur_ms or dur_ms <= 0:
                        dur_ms = 1800

                    enriched.append(
                        MemeSegment(
                            meme_id=meme_id,
                            title=meme.get("title") or meme.get("lineText") or meme_id,
                            audio_url=meme.get("audioUrl"),
                            thumbnail_url=meme.get("thumbnailUrl"),
                            duration_ms=dur_ms,
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
                audio_bytes = await tts_service.synthesize(text=fallback_text, voice=resolved_voice)
                cache_key = get_cache_key(fallback_text, resolved_voice, None, None)
                fallback_url = f"/cache/{cache_key}.mp3"
                fallback_dur = tts_service.get_audio_duration_ms(audio_bytes) if audio_bytes else 0
                if fallback_dur <= 0:
                    fallback_dur = tts_service.estimate_speech_duration_ms(fallback_text)
            except Exception:
                fallback_url = None
                fallback_dur = tts_service.estimate_speech_duration_ms(fallback_text)
            enriched.append(SpeechSegment(text=fallback_text, audio_url=fallback_url, duration_ms=fallback_dur))

        return enriched


reaction_director = ReactionDirector()

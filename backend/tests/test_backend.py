"""Comprehensive Test Suite for Vadivelu AI Backend & AI Systems.

Covers:
1. Multi-Key Gemini API Key Rotator (concurrency, cooldowns, backoff, failover, safe status).
2. SQLite Persistent Database (Conversations, Messages, Memories, Memes, Settings).
3. Edge-TTS Multi-Voice Engine (Synthesis, Caching, Streaming).
4. Seed Meme Library (Playback assets, SVGs, Cooldowns, Catalog).
5. Persistent Memory System (Fact extraction, Contextual callbacks, CRUD).
6. Reaction Director (Structured performance planning, Personality presets, Cooldown enforcement).
7. FastAPI HTTP Endpoints (Health, Chat, TTS, Conversations, Memories, Memes, Settings, Search, Static).
"""

import asyncio
import json
import os
import time
from typing import Generator
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

# Ensure test environment
os.environ["ENVIRONMENT"] = "test"

from app.core.config import settings
from app.core.key_rotator import (
    AllKeysInCooldownError,
    AllKeysInvalidError,
    GeminiKeyRotator,
    KeyInfo,
    NoKeysConfiguredError,
    key_rotator,
)
from app.db.database import db_service, init_db
from app.main import app
from app.models.schemas import SendMessageRequest
from app.services.gemini_service import gemini_service
from app.services.meme_service import meme_service
from app.services.memory_service import memory_service
from app.services.reaction_director import reaction_director
from app.services.supabase_service import supabase_dialogue_service
from app.services.tts_service import tts_service


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Initialize DB and seed data before running tests."""
    init_db()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Test client fixture."""
    with TestClient(app) as c:
        yield c


# ============================================================================
# 1. Multi-Key Gemini API Key Rotator Tests
# ============================================================================


class TestGeminiKeyRotator:
    """Test key rotation, concurrency, cooldowns, exponential backoff, and secret protection."""

    def test_no_keys_configured(self):
        rotator = GeminiKeyRotator()
        rotator._keys = []
        assert not rotator.has_keys
        with pytest.raises(NoKeysConfiguredError) as exc_info:
            asyncio.run(rotator.get_next_key())
        assert "No Gemini API keys configured" in str(exc_info.value)

    def test_round_robin_rotation(self):
        rotator = GeminiKeyRotator()
        rotator._keys = [
            KeyInfo(alias="Key-1", secret="secret-key-1"),
            KeyInfo(alias="Key-2", secret="secret-key-2"),
            KeyInfo(alias="Key-3", secret="secret-key-3"),
        ]

        # First pick Key-1
        k1 = asyncio.run(rotator.get_next_key())
        assert k1.alias == "Key-1"
        # Second pick Key-2
        k2 = asyncio.run(rotator.get_next_key())
        assert k2.alias == "Key-2"
        # Third pick Key-3
        k3 = asyncio.run(rotator.get_next_key())
        assert k3.alias == "Key-3"
        # Cycles back to Key-1
        k4 = asyncio.run(rotator.get_next_key())
        assert k4.alias == "Key-1"

    def test_rate_limit_cooldown_and_backoff(self):
        rotator = GeminiKeyRotator()
        rotator._keys = [
            KeyInfo(alias="Key-1", secret="secret-key-1"),
            KeyInfo(alias="Key-2", secret="secret-key-2"),
        ]

        # First failure on Key-1 (429 Rate Limit)
        asyncio.run(rotator.record_failure("Key-1", 429, "Rate limit exceeded"))
        k1 = rotator._keys[0]
        assert k1.status == "cooldown"
        assert k1.consecutive_failures == 1
        assert k1.cooldown_until > time.time()

        # Rotation immediately skips Key-1 and returns Key-2
        next_k = asyncio.run(rotator.get_next_key())
        assert next_k.alias == "Key-2"

        # Second failure on Key-1 should double the backoff
        first_expiry = k1.cooldown_until
        asyncio.run(rotator.record_failure("Key-1", 429, "Rate limit exceeded again"))
        assert k1.consecutive_failures == 2
        # Backoff increased
        assert (k1.cooldown_until - time.time()) > (first_expiry - time.time())

    def test_invalid_key_revocation(self):
        rotator = GeminiKeyRotator()
        rotator._keys = [
            KeyInfo(alias="Key-1", secret="secret-key-1"),
            KeyInfo(alias="Key-2", secret="secret-key-2"),
        ]

        # 401 / 403 marks key as invalid permanently
        asyncio.run(rotator.record_failure("Key-1", 401, "API key revoked"))
        k1 = rotator._keys[0]
        assert k1.status == "invalid"

        # Getting next key should always return Key-2
        next_k = asyncio.run(rotator.get_next_key())
        assert next_k.alias == "Key-2"

    def test_all_keys_in_cooldown_error(self):
        rotator = GeminiKeyRotator()
        rotator._keys = [
            KeyInfo(alias="Key-1", secret="secret-key-1", status="cooldown", cooldown_until=time.time() + 25),
            KeyInfo(alias="Key-2", secret="secret-key-2", status="cooldown", cooldown_until=time.time() + 40),
        ]

        with pytest.raises(AllKeysInCooldownError) as exc_info:
            asyncio.run(rotator.get_next_key())
        assert "All Gemini API keys are currently cooling down" in str(exc_info.value)
        assert exc_info.value.wait_seconds >= 20

    def test_all_keys_invalid_error(self):
        rotator = GeminiKeyRotator()
        rotator._keys = [
            KeyInfo(alias="Key-1", secret="secret-key-1", status="invalid"),
            KeyInfo(alias="Key-2", secret="secret-key-2", status="invalid"),
        ]

        with pytest.raises(AllKeysInvalidError) as exc_info:
            asyncio.run(rotator.get_next_key())
        assert "All configured Gemini API keys are invalid" in str(exc_info.value)

    def test_key_auto_recovery_after_cooldown(self):
        rotator = GeminiKeyRotator()
        # Cooldown has expired in the past
        rotator._keys = [
            KeyInfo(alias="Key-1", secret="secret-key-1", status="cooldown", cooldown_until=time.time() - 5),
        ]
        k = asyncio.run(rotator.get_next_key())
        assert k.alias == "Key-1"
        assert k.status == "healthy"

    def test_status_never_exposes_secrets(self):
        rotator = GeminiKeyRotator()
        secret_token = "AIzaSySUPER_SECRET_TOKEN_XYZ987654321"
        rotator._keys = [KeyInfo(alias="Key-1", secret=secret_token)]

        status = rotator.get_status()
        status_str = str(status)
        assert secret_token not in status_str
        assert "Key-1" in status_str
        assert status["totalKeys"] == 1
        assert status["activeKeysCount"] == 1


# ============================================================================
# 2. SQLite Database & CRUD Operations Tests
# ============================================================================


class TestSQLiteDatabase:
    """Test conversation, message, memory, meme, and settings persistence."""

    def test_conversation_lifecycle(self):
        async def run():
            # Create
            conv = await db_service.create_conversation(title="Test Conv", personality="sarcastic")
            conv_id = conv["id"]
            assert conv["title"] == "Test Conv"
            assert conv["personality"] == "sarcastic"

            # Read
            fetched = await db_service.get_conversation(conv_id)
            assert fetched is not None
            assert fetched["id"] == conv_id

            # Update
            updated = await db_service.update_conversation(conv_id, title="Renamed Conv", personality="funny_friend")
            assert updated["title"] == "Renamed Conv"
            assert updated["personality"] == "funny_friend"

            # Delete
            deleted = await db_service.delete_conversation(conv_id)
            assert deleted is True
            assert await db_service.get_conversation(conv_id) is None

        asyncio.run(run())

    def test_messages_persistence_and_branching(self):
        async def run():
            conv = await db_service.create_conversation(title="Branching Conv")
            conv_id = conv["id"]

            m1 = await db_service.create_message(conv_id, "user", "Message 1")
            m2 = await db_service.create_message(conv_id, "assistant", "Message 2")
            m3 = await db_service.create_message(conv_id, "user", "Message 3")

            msgs = await db_service.get_conversation_messages(conv_id)
            assert len(msgs) == 3

            # Branch from m2 (deletes m2 and m3)
            branch_conv_id = await db_service.delete_messages_after(m2["id"])
            assert branch_conv_id == conv_id

            remaining = await db_service.get_conversation_messages(conv_id)
            assert len(remaining) == 1
            assert remaining[0]["id"] == m1["id"]

            await db_service.delete_conversation(conv_id)

        asyncio.run(run())

    def test_memories_crud(self):
        async def run():
            # Create
            mem = await db_service.create_memory(key="user_city", content="User lives in Chennai")
            mem_id = mem["id"]
            assert mem["key"] == "user_city"

            # List
            memories = await db_service.list_memories(search="Chennai")
            assert any(m["id"] == mem_id for m in memories)

            # Update
            updated = await db_service.update_memory(mem_id, content="User moved to Bengaluru")
            assert updated["content"] == "User moved to Bengaluru"

            # Delete
            assert await db_service.delete_memory(mem_id) is True

        asyncio.run(run())

    def test_settings_persistence(self):
        async def run():
            current = await db_service.get_settings()
            assert "geminiModel" in current
            assert "voiceGender" in current

            # Update settings
            new_settings = await db_service.update_settings(
                {"speakingRate": 1.25, "memesEnabled": False, "theme": "light"}
            )
            assert new_settings["speakingRate"] == 1.25
            assert new_settings["memesEnabled"] is False
            assert new_settings["theme"] == "light"

            # Restore default
            await db_service.update_settings({"speakingRate": 1.0, "memesEnabled": True, "theme": "dark"})

        asyncio.run(run())


# ============================================================================
# 3. Edge-TTS Multi-Voice Engine Tests
# ============================================================================


class TestTTSEngine:
    """Test text synthesis, caching, and streaming with edge-tts."""

    def test_synthesis_and_caching(self):
        async def run():
            text = "Testing Edge-TTS multi voice synthesis cache system."
            # First synthesis
            audio1 = await tts_service.synthesize(text, gender="female")
            assert len(audio1) > 0

            # Second call should hit the cache immediately
            audio2 = await tts_service.synthesize(text, gender="female")
            assert audio1 == audio2

            # Male voice synthesis
            audio_male = await tts_service.synthesize(text, gender="male")
            assert len(audio_male) > 0

        asyncio.run(run())

    def test_audio_streaming(self):
        async def run():
            text = "Short streaming audio test chunk."
            chunks = []
            async for chunk in tts_service.stream_audio(text, gender="female"):
                chunks.append(chunk)

            total_bytes = sum(len(c) for c in chunks)
            assert total_bytes > 0
            assert len(chunks) > 0

        asyncio.run(run())

    def test_empty_text_returns_empty(self):
        async def run():
            assert await tts_service.synthesize("") == b""
            assert await tts_service.synthesize("   ") == b""

        asyncio.run(run())

    def test_audio_duration_calculation(self):
        async def run():
            text = "Testing exact audio duration calculation in milliseconds."
            audio = await tts_service.synthesize(text, gender="female")
            assert len(audio) > 0

            # Test exact duration parsing from audio bytes
            dur_ms = tts_service.get_audio_duration_ms(audio)
            assert dur_ms > 0
            assert isinstance(dur_ms, int)

            # Test synthesize_with_duration
            audio_bytes, dur2 = await tts_service.synthesize_with_duration(text, gender="female")
            assert len(audio_bytes) > 0
            assert dur2 == dur_ms

            # Test text estimation
            est_dur = tts_service.estimate_speech_duration_ms(text)
            assert est_dur > 0

            # Test known dialogue clip duration
            known_dur = tts_service.get_audio_duration_ms("5dbb8a7a-7b09-49c8-93bc-b887a944d6f6")
            assert known_dur == 3840

            # Test empty bytes returns 0
            assert tts_service.get_audio_duration_ms(b"") == 0

        asyncio.run(run())


# ============================================================================
# 4. Seed Meme Library Tests
# ============================================================================


class TestMemeLibrary:
    """Test dynamic meme creation, cooldowns, and catalog formatting."""

    def test_meme_crud_and_lifecycle(self):
        async def run():
            created = await meme_service.create_meme(
                id="test_meme_1",
                title="Test Meme",
                file_path="memes/test_meme_1.mp3",
                audio_url="/memes/test_meme_1.mp3",
                emotion="laughter",
                context_hint="Funny situation",
                cooldown_seconds=30,
            )
            assert created["id"] == "test_meme_1"

            # Check list
            memes = await meme_service.list_memes()
            assert any(m["id"] == "test_meme_1" for m in memes)

            # Check get
            fetched = await meme_service.get_meme("test_meme_1")
            assert fetched is not None
            assert fetched["title"] == "Test Meme"

            # Format for director
            formatted = meme_service.format_memes_for_director([fetched])
            assert "test_meme_1" in formatted

            # Record usage
            await meme_service.record_usage("test_meme_1")
            updated = await meme_service.get_meme("test_meme_1")
            assert updated["isAvailableNow"] is False
            assert updated["useCount"] >= 1

            # Clean up
            await meme_service.delete_meme("test_meme_1")

        asyncio.run(run())


# ============================================================================
# 5. Persistent Memory System Tests
# ============================================================================


class TestMemorySystem:
    """Test fact extraction, retrieval, and contextual callbacks."""

    def test_heuristic_fact_extraction(self):
        facts = memory_service.extract_heuristics(
            "I'm training for a running marathon in December."
        )
        assert len(facts) > 0
        key, content = facts[0]
        assert key == "user_training"
        assert "running marathon" in content

    def test_profession_extraction(self):
        facts = memory_service.extract_heuristics(
            "I work as a software engineer at an AI startup."
        )
        assert len(facts) > 0
        assert any(k == "user_profession" for k, _ in facts)

    def test_record_user_facts(self):
        async def run():
            created = await memory_service.record_user_facts(
                "My goal is to learn Tamil cinema comedy timing!"
            )
            assert len(created) > 0
            memories = await memory_service.list_memories(search="Tamil cinema")
            assert len(memories) > 0

        asyncio.run(run())


# ============================================================================
# 6. Reaction Director Tests
# ============================================================================


class TestReactionDirector:
    """Test performance planning, personality adaptation, and segment ordering."""

    @pytest.fixture(autouse=True)
    def reset_cooldowns_fixture(self):
        asyncio.run(meme_service.reset_cooldowns())

    def test_celebration_rehearsal_performance(self):
        async def run():
            # Create temporary test meme
            await meme_service.create_meme(
                id="kalakkunga",
                title="Kalakkunga",
                file_path="memes/kalakkunga.mp3",
                audio_url="/memes/kalakkunga.mp3",
                emotion="celebration",
            )
            mock_gemini_json = json.dumps({
                "voice": "female",
                "emotion": "celebration",
                "reasoning": "User won competition, celebrating with kalakkunga",
                "segments": [
                    {"type": "speech", "text": "Incredible victory!"},
                    {"type": "meme", "memeId": "kalakkunga"},
                    {"type": "speech", "text": "You are a true champion!"}
                ],
                "newMemories": []
            })
            old_keys = key_rotator._keys
            key_rotator._keys = [KeyInfo(alias="Key-1", secret="test_key_123")]
            try:
                with patch.object(gemini_service, "generate_content", return_value=(mock_gemini_json, "Key-1")):
                    conv = await db_service.create_conversation(title="Director Test")
                    plan, created_keys, key_alias = await reaction_director.plan_performance(
                        user_message="I won the championship competition!",
                        conversation_id=conv["id"],
                        history=[],
                        personality="high_energy",
                    )
                    assert plan.emotion == "celebration"
                    assert len(plan.segments) >= 2
                    segment_types = [s.type for s in plan.segments]
                    assert "speech" in segment_types
                    assert "meme" in segment_types
                    assert any(s.type == "meme" and s.meme_id == "kalakkunga" for s in plan.segments)
                    # Verify accurate durationMs on both speech and meme segments
                    for seg in plan.segments:
                        assert seg.duration_ms is not None
                        assert seg.duration_ms > 0
                    dumped = plan.model_dump(by_alias=True)
                    for seg_dict in dumped["segments"]:
                        assert "durationMs" in seg_dict
                        assert seg_dict["durationMs"] > 0
                    await db_service.delete_conversation(conv["id"])
            finally:
                key_rotator._keys = old_keys
                await meme_service.delete_meme("kalakkunga")

        asyncio.run(run())

    def test_financial_irony_performance(self):
        async def run():
            # Create temporary test meme
            await meme_service.create_meme(
                id="stonks",
                title="Stonks",
                file_path="memes/stonks.mp3",
                audio_url="/memes/stonks.mp3",
                emotion="irony",
            )
            mock_gemini_json = json.dumps({
                "voice": "male",
                "emotion": "irony",
                "reasoning": "Crypto investment risk, inserting stonks meme",
                "segments": [
                    {"type": "speech", "text": "Well well well, look at the wall street wolf!"},
                    {"type": "meme", "memeId": "stonks"},
                    {"type": "speech", "text": "Best of luck with your portfolio!"}
                ],
                "newMemories": []
            })
            old_keys = key_rotator._keys
            key_rotator._keys = [KeyInfo(alias="Key-1", secret="test_key_123")]
            try:
                with patch.object(gemini_service, "generate_content", return_value=(mock_gemini_json, "Key-1")):
                    conv = await db_service.create_conversation(title="Finance Test")
                    plan, _, _ = await reaction_director.plan_performance(
                        user_message="I bought crypto and invested all my savings!",
                        conversation_id=conv["id"],
                        history=[],
                        personality="sarcastic",
                    )
                    assert plan.emotion == "irony"
                    assert any(s.type == "meme" and s.meme_id == "stonks" for s in plan.segments)
                    await db_service.delete_conversation(conv["id"])
            finally:
                key_rotator._keys = old_keys
                await meme_service.delete_meme("stonks")

        asyncio.run(run())

    def test_serious_distress_omits_memes(self):
        async def run():
            mock_gemini_json = json.dumps({
                "voice": "female",
                "emotion": "calm",
                "reasoning": "Distress message, omitting all memes",
                "segments": [
                    {"type": "speech", "text": "I am truly sorry to hear that. I am here for you."}
                ],
                "newMemories": []
            })
            old_keys = key_rotator._keys
            key_rotator._keys = [KeyInfo(alias="Key-1", secret="test_key_123")]
            try:
                with patch.object(gemini_service, "generate_content", return_value=(mock_gemini_json, "Key-1")):
                    conv = await db_service.create_conversation(title="Distress Test")
                    plan, _, _ = await reaction_director.plan_performance(
                        user_message="I am feeling deeply hurt and depressed today.",
                        conversation_id=conv["id"],
                        history=[],
                        personality="calm_supportive",
                    )
                    assert all(s.type != "meme" for s in plan.segments)
                    assert plan.emotion == "calm"
                    await db_service.delete_conversation(conv["id"])
            finally:
                key_rotator._keys = old_keys

        asyncio.run(run())

    def test_memory_contextual_callback(self):
        async def run():
            mock_gemini_json = json.dumps({
                "voice": "female",
                "emotion": "curious",
                "reasoning": "Referencing user marathon training from memories",
                "segments": [
                    {"type": "speech", "text": "Good morning! How is the running marathon training coming along?"}
                ],
                "newMemories": [{"key": "user_training", "content": "User is training for a marathon"}]
            })
            old_keys = key_rotator._keys
            key_rotator._keys = [KeyInfo(alias="Key-1", secret="test_key_123")]
            try:
                with patch.object(gemini_service, "generate_content", return_value=(mock_gemini_json, "Key-1")):
                    conv = await db_service.create_conversation(title="Callback Test")
                    plan, created_keys, _ = await reaction_director.plan_performance(
                        user_message="Good morning, what are we doing today?",
                        conversation_id=conv["id"],
                        history=[{"role": "user", "content": "I am training for a running marathon."}],
                    )
                    full_speech = " ".join(s.text for s in plan.segments if s.type == "speech")
                    assert "marathon" in full_speech.lower() or "running" in full_speech.lower()
                    assert "user_training" in created_keys
                    await db_service.delete_conversation(conv["id"])
            finally:
                key_rotator._keys = old_keys

        asyncio.run(run())

    def test_no_keys_in_production_raises_recoverable_error(self):
        async def run():
            old_keys = key_rotator._keys
            try:
                key_rotator._keys = []
                conv = await db_service.create_conversation(title="No Keys Test")
                with pytest.raises(NoKeysConfiguredError) as exc_info:
                    await reaction_director.plan_performance(
                        user_message="Hello Vadivelu",
                        conversation_id=conv["id"],
                        history=[],
                    )
                assert "No Gemini API keys configured" in str(exc_info.value)
                await db_service.delete_conversation(conv["id"])
            finally:
                key_rotator._keys = old_keys

        asyncio.run(run())


# ============================================================================
# 7. FastAPI Endpoints & API Integration Tests
# ============================================================================


class TestAPIEndpoints:
    """Test full HTTP endpoints using FastAPI TestClient."""

    def test_health_endpoint(self, client: TestClient):
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ("ok", "degraded")
        assert data["database"]["connected"] is True
        assert "keyRotation" in data

    def test_chat_message_endpoint_no_keys_returns_503(self, client: TestClient):
        old_keys = key_rotator._keys
        try:
            key_rotator._keys = []
            res = client.post(
                "/api/chat/message",
                json={"content": "Hello Vadivelu! Tell me something funny."},
            )
            assert res.status_code == 503
            assert "No Gemini API keys configured" in res.json()["detail"]
        finally:
            key_rotator._keys = old_keys

    def test_chat_message_endpoint_with_gemini(self, client: TestClient):
        asyncio.run(meme_service.create_meme(
            id="aahaa",
            title="Aahaa",
            file_path="memes/aahaa.mp3",
            audio_url="/memes/aahaa.mp3",
            emotion="laughter",
        ))
        mock_gemini_json = json.dumps({
            "voice": "female",
            "emotion": "laughter",
            "reasoning": "Greeting user with humor",
            "segments": [
                {"type": "speech", "text": "Vanakkam! Vadivelu AI here!"},
                {"type": "meme", "memeId": "aahaa"},
                {"type": "speech", "text": "What is on your mind today?"}
            ],
            "newMemories": []
        })
        old_keys = key_rotator._keys
        key_rotator._keys = [KeyInfo(alias="Key-1", secret="test_key_123")]
        try:
            with patch.object(gemini_service, "generate_content", return_value=(mock_gemini_json, "Key-1")):
                res = client.post(
                    "/api/chat/message",
                    json={"content": "Hello Vadivelu! Tell me something funny."},
                )
                assert res.status_code == 200
                data = res.json()
                assert "userMessage" in data
                assert "assistantMessage" in data
                assert "performance" in data
                assert data["userMessage"]["role"] == "user"
                assert data["assistantMessage"]["role"] == "assistant"
                assert len(data["performance"]["segments"]) == 3
        finally:
            key_rotator._keys = old_keys
            asyncio.run(meme_service.delete_meme("aahaa"))

    def test_tts_synthesize_endpoint(self, client: TestClient):
        res = client.post(
            "/api/tts/synthesize",
            json={"text": "Synthesizing test speech audio", "gender": "female"},
        )
        assert res.status_code == 200
        assert res.headers["content-type"] == "audio/mpeg"
        assert len(res.content) > 1000

    def test_tts_stream_endpoint(self, client: TestClient):
        res = client.get(
            "/api/tts/stream",
            params={"text": "Streaming test speech audio", "gender": "male"},
        )
        assert res.status_code == 200
        assert res.headers["content-type"] == "audio/mpeg"
        assert len(res.content) > 1000

    def test_conversations_api(self, client: TestClient):
        # Create
        res = client.post("/api/conversations", json={"title": "API Test Conv", "personality": "normal"})
        assert res.status_code == 200
        conv_id = res.json()["id"]

        # List
        res_list = client.get("/api/conversations")
        assert res_list.status_code == 200
        assert any(c["id"] == conv_id for c in res_list.json())

        # Detail
        res_detail = client.get(f"/api/conversations/{conv_id}")
        assert res_detail.status_code == 200
        assert res_detail.json()["id"] == conv_id

        # Patch
        res_patch = client.patch(f"/api/conversations/{conv_id}", json={"title": "Updated Title"})
        assert res_patch.status_code == 200
        assert res_patch.json()["title"] == "Updated Title"

        # Delete
        res_del = client.delete(f"/api/conversations/{conv_id}")
        assert res_del.status_code == 200
        assert res_del.json()["success"] is True

    def test_memories_api(self, client: TestClient):
        # Create
        res = client.post("/api/memories", json={"key": "api_test_key", "content": "Test fact content"})
        assert res.status_code == 200
        mem_id = res.json()["id"]

        # List
        res_list = client.get("/api/memories")
        assert res_list.status_code == 200
        assert any(m["id"] == mem_id for m in res_list.json())

        # Patch
        res_patch = client.patch(f"/api/memories/{mem_id}", json={"content": "Updated content"})
        assert res_patch.status_code == 200
        assert res_patch.json()["content"] == "Updated content"

        # Delete
        res_del = client.delete(f"/api/memories/{mem_id}")
        assert res_del.status_code == 200
        assert res_del.json()["success"] is True

    def test_memes_api(self, client: TestClient):
        # Create test meme via API
        asyncio.run(meme_service.create_meme(
            id="test_api_meme",
            title="API Test Meme",
            file_path="memes/test_api_meme.mp3",
            audio_url="/memes/test_api_meme.mp3",
            emotion="laughter",
        ))

        res = client.get("/api/memes")
        assert res.status_code == 200
        memes = res.json()
        assert len(memes) >= 1

        # Patch favorite
        res_patch = client.patch("/api/memes/test_api_meme", json={"isFavorite": True})
        assert res_patch.status_code == 200
        assert res_patch.json()["isFavorite"] is True

        # Clean up
        asyncio.run(meme_service.delete_meme("test_api_meme"))

    def test_dialogues_and_memes_search_api(self, client: TestClient):
        # 1. Search without params on /api/dialogues/search
        res = client.get("/api/dialogues/search")
        assert res.status_code == 200
        items = res.json()
        assert isinstance(items, list)
        if len(items) > 0:
            first = items[0]
            assert "id" in first
            assert "title" in first
            assert "durationMs" in first
            assert first["durationMs"] > 0
            assert "status" in first
            assert first["status"] in ("available", "cooldown")
            assert "tags" in first
            assert isinstance(first["tags"], list)

        # 2. Search on /api/memes/search
        res_memes = client.get("/api/memes/search", params={"query": "Muruga"})
        assert res_memes.status_code == 200
        muruga_items = res_memes.json()
        assert isinstance(muruga_items, list)

        # 3. Search with status filter
        res_avail = client.get("/api/dialogues/search", params={"status": "available"})
        assert res_avail.status_code == 200
        for item in res_avail.json():
            assert item["isAvailableNow"] is True
            assert item["status"] == "available"

    def test_settings_api(self, client: TestClient):
        res_get = client.get("/api/settings")
        assert res_get.status_code == 200
        assert "defaultPersonality" in res_get.json()

        res_post = client.post("/api/settings", json={"volume": 0.85})
        assert res_post.status_code == 200
        assert res_post.json()["volume"] == 0.85

    def test_search_api(self, client: TestClient):
        res = client.get("/api/search", params={"query": "Vadivelu"})
        assert res.status_code == 200
        data = res.json()
        assert "conversations" in data
        assert "messages" in data

    def test_static_meme_serving(self, client: TestClient):
        test_file = settings.MEME_STORAGE_PATH / "test_static.mp3"
        test_file.write_bytes(b"TEST_AUDIO_BYTES_FOR_STATIC_SERVING")
        try:
            res_audio = client.get("/memes/test_static.mp3")
            assert res_audio.status_code == 200
            assert res_audio.content == b"TEST_AUDIO_BYTES_FOR_STATIC_SERVING"
        finally:
            if test_file.exists():
                test_file.unlink()


# ============================================================================
# 8. Dialogue Relevance Ranker & Semantic Scoring Tests
# ============================================================================


class TestDialogueRelevanceRanker:
    """Test fuzzy/semantic relevance ranking algorithm in SupabaseDialogueService."""

    @pytest.fixture(autouse=True)
    def reset_cooldowns(self):
        supabase_dialogue_service.reset_cooldowns()

    def test_token_overlap_ranking(self):
        async def run():
            # Query containing argument and fight keywords
            ranked = await supabase_dialogue_service.rank_dialogues(
                prompt="Why are you two fighting and arguing in the marketplace?",
                emotion="argument",
                limit=5,
            )
            assert len(ranked) > 0
            # Top ranked dialogue should match argument/conflict tags or text
            top = ranked[0]
            assert top["relevanceScore"] > 30.0
            assert top["emotion"] in ("angry", "annoyed") or "argument" in top.get("tags", [])
            # Should have reasons explaining match
            assert len(top.get("relevanceReasons", [])) > 0

        asyncio.run(run())

    def test_emotion_priority_weighting(self):
        async def run():
            # Test celebration weighting
            celeb_ranked = await supabase_dialogue_service.rank_dialogues(
                prompt="We are ready for the grand stage performance!",
                emotion="celebration",
                limit=3,
            )
            assert len(celeb_ranked) > 0
            top_celeb = celeb_ranked[0]
            assert top_celeb["emotion"] in ("enthusiastic", "happy", "celebration") or any(
                t in ("stage performance", "enthusiastic") for t in top_celeb.get("tags", [])
            )

            # Test frustration weighting
            frust_ranked = await supabase_dialogue_service.rank_dialogues(
                prompt="Waking up in the morning is such a frustrating struggle!",
                emotion="frustration",
                limit=3,
            )
            assert len(frust_ranked) > 0
            top_frust = frust_ranked[0]
            assert "frustrated" in top_frust["emotion"] or "morning struggle" in top_frust.get("tags", [])

        asyncio.run(run())

    def test_anti_repetition_and_diversity_penalty(self):
        async def run():
            # Get initial top dialogue for drama
            prompt = "What kind of terrible atrocity is this suffering?"
            initial_ranked = await supabase_dialogue_service.rank_dialogues(
                prompt=prompt, emotion="drama", limit=3
            )
            top_dialogue = initial_ranked[0]
            top_id = top_dialogue["id"]
            initial_score = top_dialogue["relevanceScore"]

            # Record usage to trigger cooldown and recent history penalty
            supabase_dialogue_service.record_usage(top_id)

            # Re-rank with same prompt
            reranked = await supabase_dialogue_service.rank_dialogues(
                prompt=prompt, emotion="drama", limit=3
            )
            # The used dialogue should now be penalized and have isAvailableNow = False
            penalized_item = next((d for d in reranked if d["id"] == top_id), None)
            if penalized_item:
                assert penalized_item["relevanceScore"] < initial_score
                assert penalized_item["isAvailableNow"] is False

            # Top dialogue now must be available and distinct
            assert reranked[0]["id"] != top_id
            assert reranked[0]["isAvailableNow"] is True

        asyncio.run(run())

    def test_signature_phrase_trigger(self):
        async def run():
            # Mention Kaippulla
            ranked = await supabase_dialogue_service.rank_dialogues(
                prompt="Hello, is this Kaippulla speaking? Sanga thalaivar!",
                limit=3,
            )
            top = ranked[0]
            assert top["id"].startswith("1f079e82")
            assert "Kaippulla" in top["lineText"]
            assert any("Signature Vadivelu phrase" in r for r in top["relevanceReasons"])

        asyncio.run(run())

    def test_top_15_ranked_dialogues_limit(self):
        async def run():
            ranked = await supabase_dialogue_service.rank_dialogues(
                prompt="Tell me something hilarious and funny!",
                emotion="comedy",
                limit=15,
            )
            assert len(ranked) <= 15
            # Ensure strictly ordered by relevanceScore descending
            scores = [d["relevanceScore"] for d in ranked]
            assert scores == sorted(scores, reverse=True)

        asyncio.run(run())

    def test_dialogue_format_for_director(self):
        async def run():
            ranked = await supabase_dialogue_service.rank_dialogues(limit=5)
            formatted = supabase_dialogue_service.format_ranked_dialogues_for_director(ranked)
            assert "[TOP" in formatted
            assert "CONTEXTUALLY RANKED VADIVELU DIALOGUES" in formatted
            assert "ID:" in formatted
            assert "Score:" in formatted

        asyncio.run(run())


# ============================================================================
# 9. Long-Term Memory Retrieval & Context Callbacks Tests
# ============================================================================


class TestMemoryRetrievalAndContextCallbacks:
    """Test memory relevance ranking, callback prompt formatting, and director prompt injection."""

    def test_retrieve_relevant_memories_associations(self):
        async def run():
            # Seed a training memory
            await memory_service.create_memory(
                key="user_training",
                content="User is training for a marathon running competition",
            )
            # Retrieve with prompt mentioning running / race
            ranked, relevant_keys = await memory_service.retrieve_relevant_memories(
                prompt="I just finished a 10k run and won a trophy!",
            )
            assert "user_training" in relevant_keys
            top_mem = ranked[0]
            assert top_mem["key"] == "user_training"
            assert top_mem["isRelevant"] is True

        asyncio.run(run())

    def test_format_memories_with_passive_knowledge(self):
        async def run():
            memories = [
                {"key": "user_training", "content": "User is training for a marathon", "isRelevant": True},
                {"key": "user_pet", "content": "User has a golden retriever", "isRelevant": False},
            ]
            formatted = memory_service.format_memories_for_prompt(
                memories, relevant_keys=["user_training"]
            )
            assert "user_training" in formatted
            assert "[BACKGROUND USER KNOWLEDGE" in formatted
            assert "Context Note:" in formatted

        asyncio.run(run())

    def test_director_injects_ranked_dialogues_and_memories(self):
        async def run():
            # Seed user memory
            await memory_service.create_memory(
                key="user_training",
                content="User is training for an international marathon",
            )
            mock_gemini_json = json.dumps({
                "voice": "female",
                "emotion": "celebration",
                "reasoning": "User won the marathon, making callback",
                "segments": [
                    {"type": "speech", "text": "All that marathon training really paid off! Super performance!"}
                ],
                "newMemories": []
            })
            captured_instruction = ""

            async def mock_generate_content(*args, **kwargs):
                nonlocal captured_instruction
                captured_instruction = kwargs.get("system_instruction", "")
                return mock_gemini_json, "Key-1"

            old_keys = key_rotator._keys
            key_rotator._keys = [KeyInfo(alias="Key-1", secret="test_key_123")]
            try:
                with patch.object(gemini_service, "generate_content", side_effect=mock_generate_content):
                    conv = await db_service.create_conversation(title="Callback Test")
                    plan, _, _ = await reaction_director.plan_performance(
                        user_message="I won the marathon race today!",
                        conversation_id=conv["id"],
                        history=[],
                        personality="high_energy",
                    )
                    assert plan is not None
                    # Verify system_instruction contains both top 15 ranked dialogues and memories
                    assert "[TOP" in captured_instruction
                    assert "CONTEXTUALLY RANKED VADIVELU DIALOGUES" in captured_instruction
                    assert "[BACKGROUND USER KNOWLEDGE" in captured_instruction
                    assert "user_training" in captured_instruction
                    await db_service.delete_conversation(conv["id"])
            finally:
                key_rotator._keys = old_keys

        asyncio.run(run())

    def test_multi_voice_per_segment_presynthesis(self):
        async def run():
            raw_segments = [
                {"type": "speech", "text": "Line 1 in female voice", "voice": "female"},
                {"type": "speech", "text": "Line 2 in male voice", "voice": "male"},
            ]
            enriched = await reaction_director._enrich_and_presynthesize_segments(
                raw_segments=raw_segments,
                meme_map={},
                memes_enabled=True,
                voice="female",
            )
            assert len(enriched) == 2
            assert enriched[0].type == "speech"
            assert enriched[0].voice == "female"
            assert enriched[0].audio_url is not None
            assert enriched[1].type == "speech"
            assert enriched[1].voice == "male"
            assert enriched[1].audio_url is not None
            # Verify separate cache keys for distinct voices
            assert enriched[0].audio_url != enriched[1].audio_url

        asyncio.run(run())

    def test_web_search_math_weather_tools(self):
        async def run():
            from app.services.web_search_service import web_search_service
            from app.services.tool_service import tool_registry

            # Test safe math
            math_res = web_search_service.calculate_math("sqrt(100) * 5 + 12")
            assert math_res["status"] == "success"
            assert math_res["result"] == 62

            # Test tool registry
            math_tool_res = await tool_registry.execute_tool("calculate_math", {"expression": "25 * 4"})
            assert math_tool_res["result"]["result"] == 100

            # Test weather lookup
            weather_tool_res = await tool_registry.execute_tool("lookup_weather", {"location": "Chennai"})
            assert "result" in weather_tool_res
            assert "location" in weather_tool_res["result"]

        asyncio.run(run())

    def test_transcribe_audio_endpoint(self):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.services.web_search_service import web_search_service

        client = TestClient(app)
        with patch.object(web_search_service, "transcribe_audio", return_value="hello vadivelu"):
            # Send dummy audio bytes
            response = client.post(
                "/api/chat/transcribe",
                files={"file": ("test.webm", b"RIFFdummydataaudio", "audio/webm")}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["transcript"] == "hello vadivelu"

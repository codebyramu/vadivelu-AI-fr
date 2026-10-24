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


# ============================================================================
# 4. Seed Meme Library Tests
# ============================================================================


class TestMemeLibrary:
    """Test seed memes, audio files, SVGs, cooldowns, and catalog formatting."""

    def test_seed_memes_loaded(self):
        async def run():
            memes = await meme_service.list_memes()
            meme_ids = {m["id"] for m in memes}
            expected = {"adengappa", "kalakkunga", "stonks", "aahaa", "vadapoche", "enna_koduma"}
            assert expected.issubset(meme_ids)

        asyncio.run(run())

    def test_seed_meme_audio_files_exist_and_playable(self):
        memes_dir = settings.MEME_STORAGE_PATH
        expected = ["adengappa", "kalakkunga", "stonks", "aahaa", "vadapoche", "enna_koduma"]
        for m_id in expected:
            audio_path = memes_dir / f"{m_id}.mp3"
            svg_path = memes_dir / f"{m_id}.svg"
            assert audio_path.is_file(), f"Audio file {audio_path} does not exist"
            assert audio_path.stat().st_size > 5000, f"Audio file {audio_path} is too small"
            assert svg_path.is_file(), f"SVG file {svg_path} does not exist"
            assert svg_path.stat().st_size > 100, f"SVG file {svg_path} is too small"

    def test_meme_cooldown_tracking(self):
        async def run():
            # Initially available
            meme = await meme_service.get_meme("kalakkunga")
            assert meme is not None

            # Record usage
            await meme_service.record_usage("kalakkunga")
            updated = await meme_service.get_meme("kalakkunga")
            assert updated["isAvailableNow"] is False
            assert updated["useCount"] >= 1

        asyncio.run(run())

    def test_meme_director_format(self):
        async def run():
            memes = await meme_service.list_memes()
            formatted = meme_service.format_memes_for_director(memes)
            assert "adengappa" in formatted
            assert "kalakkunga" in formatted

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
                    await db_service.delete_conversation(conv["id"])
            finally:
                key_rotator._keys = old_keys

        asyncio.run(run())

    def test_financial_irony_performance(self):
        async def run():
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
        res = client.get("/api/memes")
        assert res.status_code == 200
        memes = res.json()
        assert len(memes) >= 6

        # Patch favorite
        meme_id = memes[0]["id"]
        res_patch = client.patch(f"/api/memes/{meme_id}", json={"isFavorite": True})
        assert res_patch.status_code == 200
        assert res_patch.json()["isFavorite"] is True

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
        for meme_id in ["adengappa", "kalakkunga", "stonks", "aahaa", "vadapoche", "enna_koduma"]:
            res_audio = client.get(f"/memes/{meme_id}.mp3")
            assert res_audio.status_code == 200
            assert len(res_audio.content) > 5000

            res_svg = client.get(f"/memes/{meme_id}.svg")
            assert res_svg.status_code == 200
            assert len(res_svg.content) > 100

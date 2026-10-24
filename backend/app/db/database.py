"""SQLite Database Access Layer with Async Wrappers."""

import asyncio
import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings

_local = threading.local()


def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def get_db_connection() -> sqlite3.Connection:
    """Get thread-local SQLite connection with WAL mode and row factory."""
    if not hasattr(_local, "conn") or _local.conn is None:
        settings.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(
            str(settings.DATABASE_PATH),
            check_same_thread=False,
            timeout=30.0,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.execute("PRAGMA foreign_keys=ON;")
        _local.conn = conn
    return _local.conn


def init_db() -> None:
    """Initialize database tables, indexes, and initial seeds."""
    conn = get_db_connection()
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                personality TEXT NOT NULL DEFAULT 'normal',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                voice TEXT,
                performance_json TEXT,
                audio_url TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                key TEXT NOT NULL,
                content TEXT NOT NULL,
                source_conversation_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS memes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                audio_url TEXT NOT NULL,
                thumbnail_url TEXT,
                duration_ms INTEGER NOT NULL DEFAULT 1500,
                tags TEXT NOT NULL DEFAULT '[]',
                emotion TEXT NOT NULL,
                context_hint TEXT NOT NULL,
                cooldown_seconds INTEGER NOT NULL DEFAULT 30,
                last_used_at TEXT,
                use_count INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(is_active);
            CREATE INDEX IF NOT EXISTS idx_memes_emotion ON memes(emotion);
            """
        )

    # Seed initial settings if empty
    seed_default_settings(conn)


def seed_default_settings(conn: sqlite3.Connection) -> None:
    """Populate default settings if empty."""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM settings")
    if cursor.fetchone()[0] > 0:
        return

    default_settings = {
        "gemini_model": settings.GEMINI_MODEL,
        "voice_gender": settings.DEFAULT_VOICE_GENDER,
        "speaking_rate": "1.0",
        "speaking_pitch": "0.0",
        "volume": "1.0",
        "meme_volume": "1.0",
        "memes_enabled": "true",
        "meme_frequency": "normal",
        "voice_mode": "push_to_talk",
        "default_personality": "normal",
        "memory_enabled": "true",
        "auto_save_memory": "true",
        "theme": "dark",
        "audio_retention_days": "7",
    }

    with conn:
        for k, v in default_settings.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v)
            )


class DatabaseService:
    """Async database service operations."""

    # --- Conversations ---

    @staticmethod
    def _create_conv_sync(title: Optional[str], personality: str) -> Dict[str, Any]:
        conn = get_db_connection()
        conv_id = f"conv_{uuid.uuid4().hex[:12]}"
        now = utc_now_iso()
        actual_title = title.strip() if title and title.strip() else "New Conversation"
        with conn:
            conn.execute(
                "INSERT INTO conversations (id, title, personality, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (conv_id, actual_title, personality, now, now),
            )
        return {
            "id": conv_id,
            "title": actual_title,
            "personality": personality,
            "createdAt": now,
            "updatedAt": now,
            "messageCount": 0,
            "lastMessage": None,
        }

    async def create_conversation(
        self, title: Optional[str] = None, personality: str = "normal"
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(self._create_conv_sync, title, personality)

    @staticmethod
    def _get_conv_sync(conv_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT c.*, 
                   COUNT(m.id) as msg_count,
                   (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.id = ?
            GROUP BY c.id
            """,
            (conv_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "title": row["title"],
            "personality": row["personality"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "messageCount": row["msg_count"],
            "lastMessage": row["last_msg"],
        }

    async def get_conversation(self, conv_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._get_conv_sync, conv_id)

    @staticmethod
    def _list_convs_sync(search: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        if search:
            q = f"%{search.strip()}%"
            cur.execute(
                """
                SELECT c.*, 
                       COUNT(m.id) as msg_count,
                       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.title LIKE ? OR c.id IN (SELECT conversation_id FROM messages WHERE content LIKE ?)
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                """,
                (q, q),
            )
        else:
            cur.execute(
                """
                SELECT c.*, 
                       COUNT(m.id) as msg_count,
                       (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                """
            )
        rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "personality": r["personality"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
                "messageCount": r["msg_count"],
                "lastMessage": r["last_msg"],
            }
            for r in rows
        ]

    async def list_conversations(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._list_convs_sync, search)

    @staticmethod
    def _update_conv_sync(
        conv_id: str, title: Optional[str], personality: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        now = utc_now_iso()
        fields = ["updated_at = ?"]
        values = [now]
        if title is not None:
            fields.append("title = ?")
            values.append(title.strip())
        if personality is not None:
            fields.append("personality = ?")
            values.append(personality)
        values.append(conv_id)

        with conn:
            conn.execute(
                f"UPDATE conversations SET {', '.join(fields)} WHERE id = ?",
                tuple(values),
            )
        return DatabaseService._get_conv_sync(conv_id)

    async def update_conversation(
        self, conv_id: str, title: Optional[str] = None, personality: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._update_conv_sync, conv_id, title, personality)

    @staticmethod
    def _delete_conv_sync(conv_id: str) -> bool:
        conn = get_db_connection()
        with conn:
            cur = conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
            return cur.rowcount > 0

    async def delete_conversation(self, conv_id: str) -> bool:
        return await asyncio.to_thread(self._delete_conv_sync, conv_id)

    # --- Messages ---

    @staticmethod
    def _create_msg_sync(
        conversation_id: str,
        role: str,
        content: str,
        voice: Optional[str] = None,
        performance_dict: Optional[Dict[str, Any]] = None,
        audio_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        now = utc_now_iso()
        perf_json = json.dumps(performance_dict) if performance_dict else None

        with conn:
            conn.execute(
                """
                INSERT INTO messages
                (id, conversation_id, role, content, voice, performance_json, audio_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    msg_id,
                    conversation_id,
                    role,
                    content,
                    voice,
                    perf_json,
                    audio_url,
                    now,
                ),
            )
            # Update parent conversation timestamp
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )

        return {
            "id": msg_id,
            "conversationId": conversation_id,
            "role": role,
            "content": content,
            "voice": voice,
            "performance": performance_dict,
            "audioUrl": audio_url,
            "createdAt": now,
        }

    async def create_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        voice: Optional[str] = None,
        performance_dict: Optional[Dict[str, Any]] = None,
        audio_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._create_msg_sync,
            conversation_id,
            role,
            content,
            voice,
            performance_dict,
            audio_url,
        )

    @staticmethod
    def _get_msgs_sync(conversation_id: str) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        )
        rows = cur.fetchall()
        msgs = []
        for r in rows:
            perf = None
            if r["performance_json"]:
                try:
                    perf = json.loads(r["performance_json"])
                except Exception:
                    pass
            msgs.append(
                {
                    "id": r["id"],
                    "conversationId": r["conversation_id"],
                    "role": r["role"],
                    "content": r["content"],
                    "voice": r["voice"],
                    "performance": perf,
                    "audioUrl": r["audio_url"],
                    "createdAt": r["created_at"],
                }
            )
        return msgs

    async def get_conversation_messages(self, conversation_id: str) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._get_msgs_sync, conversation_id)

    @staticmethod
    def _delete_messages_after_sync(message_id: str) -> Optional[str]:
        """Delete message and all subsequent messages in the conversation (for branching/regenerate)."""
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT conversation_id, created_at FROM messages WHERE id = ?", (message_id,))
        row = cur.fetchone()
        if not row:
            return None
        conv_id = row["conversation_id"]
        created_at = row["created_at"]
        with conn:
            conn.execute(
                "DELETE FROM messages WHERE conversation_id = ? AND created_at >= ?",
                (conv_id, created_at),
            )
        return conv_id

    async def delete_messages_after(self, message_id: str) -> Optional[str]:
        return await asyncio.to_thread(self._delete_messages_after_sync, message_id)

    # --- Memories ---

    @staticmethod
    def _create_memory_sync(
        key: str, content: str, source_conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        mem_id = f"mem_{uuid.uuid4().hex[:12]}"
        now = utc_now_iso()
        with conn:
            # Check if active memory with same key already exists, update it if so
            cur = conn.execute(
                "SELECT id FROM memories WHERE key = ? AND is_active = 1", (key,)
            )
            existing = cur.fetchone()
            if existing:
                conn.execute(
                    "UPDATE memories SET content = ?, updated_at = ?, source_conversation_id = ? WHERE id = ?",
                    (content, now, source_conversation_id, existing["id"]),
                )
                mem_id = existing["id"]
            else:
                conn.execute(
                    """
                    INSERT INTO memories (id, key, content, source_conversation_id, created_at, updated_at, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                    """,
                    (mem_id, key, content, source_conversation_id, now, now),
                )
        return {
            "id": mem_id,
            "key": key,
            "content": content,
            "sourceConversationId": source_conversation_id,
            "createdAt": now,
            "updatedAt": now,
            "isActive": True,
        }

    async def create_memory(
        self, key: str, content: str, source_conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._create_memory_sync, key, content, source_conversation_id
        )

    @staticmethod
    def _list_memories_sync(search: Optional[str] = None, active_only: bool = True) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        query = "SELECT * FROM memories WHERE 1=1"
        params: List[Any] = []
        if active_only:
            query += " AND is_active = 1"
        if search:
            query += " AND (key LIKE ? OR content LIKE ?)"
            s = f"%{search.strip()}%"
            params.extend([s, s])
        query += " ORDER BY updated_at DESC"
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        return [
            {
                "id": r["id"],
                "key": r["key"],
                "content": r["content"],
                "sourceConversationId": r["source_conversation_id"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
                "isActive": bool(r["is_active"]),
            }
            for r in rows
        ]

    async def list_memories(
        self, search: Optional[str] = None, active_only: bool = True
    ) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._list_memories_sync, search, active_only)

    @staticmethod
    def _update_memory_sync(
        mem_id: str,
        key: Optional[str] = None,
        content: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        now = utc_now_iso()
        fields = ["updated_at = ?"]
        values = [now]
        if key is not None:
            fields.append("key = ?")
            values.append(key.strip())
        if content is not None:
            fields.append("content = ?")
            values.append(content.strip())
        if is_active is not None:
            fields.append("is_active = ?")
            values.append(1 if is_active else 0)
        values.append(mem_id)

        with conn:
            cur = conn.execute(
                f"UPDATE memories SET {', '.join(fields)} WHERE id = ?", tuple(values)
            )
            if cur.rowcount == 0:
                return None

        cur = conn.execute("SELECT * FROM memories WHERE id = ?", (mem_id,))
        r = cur.fetchone()
        return {
            "id": r["id"],
            "key": r["key"],
            "content": r["content"],
            "sourceConversationId": r["source_conversation_id"],
            "createdAt": r["created_at"],
            "updatedAt": r["updated_at"],
            "isActive": bool(r["is_active"]),
        }

    async def update_memory(
        self,
        mem_id: str,
        key: Optional[str] = None,
        content: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(
            self._update_memory_sync, mem_id, key, content, is_active
        )

    @staticmethod
    def _delete_memory_sync(mem_id: str) -> bool:
        conn = get_db_connection()
        with conn:
            cur = conn.execute("DELETE FROM memories WHERE id = ?", (mem_id,))
            return cur.rowcount > 0

    async def delete_memory(self, mem_id: str) -> bool:
        return await asyncio.to_thread(self._delete_memory_sync, mem_id)

    @staticmethod
    def _clear_memories_sync() -> int:
        conn = get_db_connection()
        with conn:
            cur = conn.execute("DELETE FROM memories")
            return cur.rowcount

    async def clear_all_memories(self) -> int:
        return await asyncio.to_thread(self._clear_memories_sync)

    # --- Memes ---

    @staticmethod
    def _list_memes_sync() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM memes ORDER BY is_favorite DESC, use_count DESC, id ASC")
        rows = cur.fetchall()
        now_ts = datetime.now(timezone.utc).timestamp()
        results = []
        for r in rows:
            tags = []
            try:
                tags = json.loads(r["tags"])
            except Exception:
                pass
            last_used = r["last_used_at"]
            is_available = True
            if last_used:
                try:
                    last_ts = datetime.fromisoformat(last_used).timestamp()
                    if (now_ts - last_ts) < r["cooldown_seconds"]:
                        is_available = False
                except Exception:
                    pass

            results.append(
                {
                    "id": r["id"],
                    "title": r["title"],
                    "filePath": r["file_path"],
                    "audioUrl": r["audio_url"],
                    "thumbnailUrl": r["thumbnail_url"],
                    "durationMs": r["duration_ms"],
                    "tags": tags,
                    "emotion": r["emotion"],
                    "contextHint": r["context_hint"],
                    "cooldownSeconds": r["cooldown_seconds"],
                    "lastUsedAt": r["last_used_at"],
                    "useCount": r["use_count"],
                    "isFavorite": bool(r["is_favorite"]),
                    "isAvailableNow": is_available,
                }
            )
        return results

    async def list_memes(self) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._list_memes_sync)

    @staticmethod
    def _get_meme_sync(meme_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM memes WHERE id = ?", (meme_id,))
        r = cur.fetchone()
        if not r:
            return None
        tags = []
        try:
            tags = json.loads(r["tags"])
        except Exception:
            pass
        now_ts = datetime.now(timezone.utc).timestamp()
        is_available = True
        if r["last_used_at"]:
            try:
                last_ts = datetime.fromisoformat(r["last_used_at"]).timestamp()
                if (now_ts - last_ts) < r["cooldown_seconds"]:
                    is_available = False
            except Exception:
                pass

        return {
            "id": r["id"],
            "title": r["title"],
            "filePath": r["file_path"],
            "audioUrl": r["audio_url"],
            "thumbnailUrl": r["thumbnail_url"],
            "durationMs": r["duration_ms"],
            "tags": tags,
            "emotion": r["emotion"],
            "contextHint": r["context_hint"],
            "cooldownSeconds": r["cooldown_seconds"],
            "lastUsedAt": r["last_used_at"],
            "useCount": r["use_count"],
            "isFavorite": bool(r["is_favorite"]),
            "isAvailableNow": is_available,
        }

    async def get_meme(self, meme_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._get_meme_sync, meme_id)

    @staticmethod
    def _create_meme_sync(
        id: str,
        title: str,
        file_path: str,
        audio_url: str,
        thumbnail_url: Optional[str],
        duration_ms: int,
        tags: List[str],
        emotion: str,
        context_hint: str,
        cooldown_seconds: int = 30,
    ) -> Dict[str, Any]:
        conn = get_db_connection()
        tags_json = json.dumps(tags)
        with conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO memes
                (id, title, file_path, audio_url, thumbnail_url, duration_ms, tags, emotion, context_hint, cooldown_seconds, use_count, is_favorite)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
                """,
                (
                    id,
                    title,
                    file_path,
                    audio_url,
                    thumbnail_url,
                    duration_ms,
                    tags_json,
                    emotion,
                    context_hint,
                    cooldown_seconds,
                ),
            )
        return {
            "id": id,
            "title": title,
            "filePath": file_path,
            "audioUrl": audio_url,
            "thumbnailUrl": thumbnail_url,
            "durationMs": duration_ms,
            "tags": tags,
            "emotion": emotion,
            "contextHint": context_hint,
            "cooldownSeconds": cooldown_seconds,
            "lastUsedAt": None,
            "useCount": 0,
            "isFavorite": False,
            "isAvailableNow": True,
        }

    async def create_meme(
        self,
        id: str,
        title: str,
        file_path: str,
        audio_url: str,
        thumbnail_url: Optional[str] = None,
        duration_ms: int = 1500,
        tags: Optional[List[str]] = None,
        emotion: str = "laughter",
        context_hint: str = "",
        cooldown_seconds: int = 30,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._create_meme_sync,
            id,
            title,
            file_path,
            audio_url,
            thumbnail_url,
            duration_ms,
            tags or [],
            emotion,
            context_hint,
            cooldown_seconds,
        )

    @staticmethod
    def _update_meme_sync(
        meme_id: str,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
        emotion: Optional[str] = None,
        context_hint: Optional[str] = None,
        cooldown_seconds: Optional[int] = None,
        is_favorite: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        fields = []
        values = []
        if title is not None:
            fields.append("title = ?")
            values.append(title.strip())
        if tags is not None:
            fields.append("tags = ?")
            values.append(json.dumps(tags))
        if emotion is not None:
            fields.append("emotion = ?")
            values.append(emotion)
        if context_hint is not None:
            fields.append("context_hint = ?")
            values.append(context_hint.strip())
        if cooldown_seconds is not None:
            fields.append("cooldown_seconds = ?")
            values.append(cooldown_seconds)
        if is_favorite is not None:
            fields.append("is_favorite = ?")
            values.append(1 if is_favorite else 0)

        if not fields:
            return DatabaseService._get_meme_sync(meme_id)

        values.append(meme_id)
        with conn:
            conn.execute(
                f"UPDATE memes SET {', '.join(fields)} WHERE id = ?", tuple(values)
            )
        return DatabaseService._get_meme_sync(meme_id)

    async def update_meme(
        self,
        meme_id: str,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
        emotion: Optional[str] = None,
        context_hint: Optional[str] = None,
        cooldown_seconds: Optional[int] = None,
        is_favorite: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(
            self._update_meme_sync,
            meme_id,
            title,
            tags,
            emotion,
            context_hint,
            cooldown_seconds,
            is_favorite,
        )

    @staticmethod
    def _record_meme_use_sync(meme_id: str) -> None:
        conn = get_db_connection()
        now = utc_now_iso()
        with conn:
            conn.execute(
                "UPDATE memes SET use_count = use_count + 1, last_used_at = ? WHERE id = ?",
                (now, meme_id),
            )

    async def record_meme_use(self, meme_id: str) -> None:
        await asyncio.to_thread(self._record_meme_use_sync, meme_id)

    @staticmethod
    def _reset_meme_cooldowns_sync() -> None:
        conn = get_db_connection()
        with conn:
            conn.execute("UPDATE memes SET last_used_at = NULL")

    async def reset_all_meme_cooldowns(self) -> None:
        await asyncio.to_thread(self._reset_meme_cooldowns_sync)

    @staticmethod
    def _delete_meme_sync(meme_id: str) -> bool:
        conn = get_db_connection()
        with conn:
            cur = conn.execute("DELETE FROM memes WHERE id = ?", (meme_id,))
            return cur.rowcount > 0

    async def delete_meme(self, meme_id: str) -> bool:
        return await asyncio.to_thread(self._delete_meme_sync, meme_id)

    # --- Settings ---

    @staticmethod
    def _get_settings_sync() -> Dict[str, Any]:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT key, value FROM settings")
        rows = cur.fetchall()
        data = {r["key"]: r["value"] for r in rows}

        def parse_bool(v: Any, default: bool) -> bool:
            if v is None:
                return default
            return str(v).lower() in ("true", "1", "yes")

        def parse_float(v: Any, default: float) -> float:
            try:
                return float(v)
            except (ValueError, TypeError):
                return default

        def parse_int(v: Any, default: int) -> int:
            try:
                return int(v)
            except (ValueError, TypeError):
                return default

        return {
            "geminiModel": data.get("gemini_model", settings.GEMINI_MODEL),
            "voiceGender": data.get("voice_gender", settings.DEFAULT_VOICE_GENDER),
            "speakingRate": parse_float(data.get("speaking_rate"), 1.0),
            "speakingPitch": parse_float(data.get("speaking_pitch"), 0.0),
            "volume": parse_float(data.get("volume"), 1.0),
            "memeVolume": parse_float(data.get("meme_volume"), 1.0),
            "memesEnabled": parse_bool(data.get("memes_enabled"), True),
            "memeFrequency": data.get("meme_frequency", "normal"),
            "voiceMode": data.get("voice_mode", "push_to_talk"),
            "defaultPersonality": data.get("default_personality", "normal"),
            "memoryEnabled": parse_bool(data.get("memory_enabled"), True),
            "autoSaveMemory": parse_bool(data.get("auto_save_memory"), True),
            "theme": data.get("theme", "dark"),
            "audioRetentionDays": parse_int(data.get("audio_retention_days"), 7),
        }

    async def get_settings(self) -> Dict[str, Any]:
        return await asyncio.to_thread(self._get_settings_sync)

    @staticmethod
    def _update_settings_sync(updates: Dict[str, Any]) -> Dict[str, Any]:
        conn = get_db_connection()
        # Map camelCase to snake_case db keys
        mapping = {
            "geminiModel": "gemini_model",
            "voiceGender": "voice_gender",
            "speakingRate": "speaking_rate",
            "speakingPitch": "speaking_pitch",
            "volume": "volume",
            "memeVolume": "meme_volume",
            "memesEnabled": "memes_enabled",
            "memeFrequency": "meme_frequency",
            "voiceMode": "voice_mode",
            "defaultPersonality": "default_personality",
            "memoryEnabled": "memory_enabled",
            "autoSaveMemory": "auto_save_memory",
            "theme": "theme",
            "audioRetentionDays": "audio_retention_days",
        }

        with conn:
            for camel, val in updates.items():
                if val is None:
                    continue
                db_k = mapping.get(camel, camel)
                str_val = str(val).lower() if isinstance(val, bool) else str(val)
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (db_k, str_val),
                )
        return DatabaseService._get_settings_sync()

    async def update_settings(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        return await asyncio.to_thread(self._update_settings_sync, updates)

    # --- Search ---

    @staticmethod
    def _search_sync(query: str) -> Dict[str, Any]:
        conn = get_db_connection()
        cur = conn.cursor()
        q = f"%{query.strip()}%"

        # Search conversations
        cur.execute(
            """
            SELECT c.*, COUNT(m.id) as msg_count,
                   (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.title LIKE ?
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            LIMIT 20
            """,
            (q,),
        )
        conv_rows = cur.fetchall()
        convs = [
            {
                "id": r["id"],
                "title": r["title"],
                "personality": r["personality"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
                "messageCount": r["msg_count"],
                "lastMessage": r["last_msg"],
            }
            for r in conv_rows
        ]

        # Search messages
        cur.execute(
            """
            SELECT * FROM messages
            WHERE content LIKE ?
            ORDER BY created_at DESC
            LIMIT 30
            """,
            (q,),
        )
        msg_rows = cur.fetchall()
        msgs = []
        for r in msg_rows:
            perf = None
            if r["performance_json"]:
                try:
                    perf = json.loads(r["performance_json"])
                except Exception:
                    pass
            msgs.append(
                {
                    "id": r["id"],
                    "conversationId": r["conversation_id"],
                    "role": r["role"],
                    "content": r["content"],
                    "voice": r["voice"],
                    "performance": perf,
                    "audioUrl": r["audio_url"],
                    "createdAt": r["created_at"],
                }
            )

        return {"query": query, "conversations": convs, "messages": msgs}

    async def search(self, query: str) -> Dict[str, Any]:
        return await asyncio.to_thread(self._search_sync, query)


db_service = DatabaseService()

"""Health check endpoint exposing system status, DB health, and key rotator stats."""

from fastapi import APIRouter
from app.core.key_rotator import key_rotator
from app.db.database import get_db_connection

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("")
async def get_health():
    """Returns system status, active keys count, and database health."""
    # Check DB
    db_ok = False
    memes_count = 0
    memories_count = 0
    convs_count = 0
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM memes")
        memes_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM memories")
        memories_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM conversations")
        convs_count = cur.fetchone()[0]
        db_ok = True
    except Exception:
        db_ok = False

    key_status = key_rotator.get_status()

    is_ok = db_ok and (key_status["activeKeysCount"] > 0 or not key_rotator.has_keys)
    overall_status = "ok" if is_ok else "degraded"

    return {
        "status": overall_status,
        "database": {
            "connected": db_ok,
            "memesCount": memes_count,
            "memoriesCount": memories_count,
            "conversationsCount": convs_count,
        },
        "keyRotation": key_status,
        "ttsEngine": "Edge-TTS (active)",
    }

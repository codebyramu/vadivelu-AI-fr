#!/usr/bin/env python3
"""
Vadivelu AI — Migrate Local SQLite Data to Supabase
Usage:
    .venv/bin/python backend/migrate_to_supabase.py

Reads from local SQLite (backend/data/vadivelu.db) and uploads to Supabase via PostgREST.
Requires in .env:
    SUPABASE_URL=https://jkgewxlsmazlxotygysr.supabase.co
    SUPABASE_KEY=your_service_role_key
"""

import json
import os
import sqlite3
import sys
from pathlib import Path
import httpx

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
DB_PATH = BACKEND_DIR / "data" / "vadivelu.db"


def load_env():
    for env_file in [ROOT_DIR / ".env", BACKEND_DIR / ".env"]:
        if env_file.is_file():
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v


def main():
    load_env()
    supabase_url = os.getenv("SUPABASE_URL", "https://jkgewxlsmazlxotygysr.supabase.co").rstrip("/")
    supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_key:
        print("❌ Error: SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY is missing in your .env file.")
        print("Please add your Supabase service_role key to .env:")
        print("SUPABASE_URL=https://jkgewxlsmazlxotygysr.supabase.co")
        print("SUPABASE_KEY=eyJh...")
        sys.exit(1)

    if not DB_PATH.exists():
        print(f"ℹ️ No local SQLite database found at {DB_PATH}. Nothing to migrate.")
        sys.exit(0)

    print(f"🚀 Migrating from local SQLite ({DB_PATH}) to Supabase ({supabase_url})...")

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    client = httpx.Client(timeout=30.0, headers=headers)

    # 1. Migrate Conversations
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM conversations")
        convs = [dict(r) for r in cur.fetchall()]
        if convs:
            res = client.post(f"{supabase_url}/rest/v1/conversations", json=convs)
            res.raise_for_status()
            print(f"✅ Migrated {len(convs)} conversations.")
        else:
            print("ℹ️ No conversations to migrate.")
    except Exception as e:
        print(f"⚠️ Error migrating conversations: {e}")

    # 2. Migrate Messages
    try:
        cur.execute("SELECT * FROM messages")
        msgs = [dict(r) for r in cur.fetchall()]
        if msgs:
            # batch upload in chunks of 50
            for i in range(0, len(msgs), 50):
                chunk = msgs[i:i + 50]
                res = client.post(f"{supabase_url}/rest/v1/messages", json=chunk)
                res.raise_for_status()
            print(f"✅ Migrated {len(msgs)} messages.")
        else:
            print("ℹ️ No messages to migrate.")
    except Exception as e:
        print(f"⚠️ Error migrating messages: {e}")

    # 3. Migrate Memories
    try:
        cur.execute("SELECT * FROM memories")
        mems = []
        for r in cur.fetchall():
            d = dict(r)
            d["is_active"] = bool(d.get("is_active", 1))
            mems.append(d)
        if mems:
            res = client.post(f"{supabase_url}/rest/v1/memories", json=mems)
            res.raise_for_status()
            print(f"✅ Migrated {len(mems)} memories.")
    except Exception as e:
        print(f"⚠️ Error migrating memories: {e}")

    # 4. Migrate Memes
    try:
        cur.execute("SELECT * FROM memes")
        memes = []
        for r in cur.fetchall():
            d = dict(r)
            if isinstance(d.get("tags"), str):
                try:
                    d["tags"] = json.loads(d["tags"])
                except Exception:
                    d["tags"] = []
            d["is_favorite"] = bool(d.get("is_favorite", 0))
            memes.append(d)
        if memes:
            res = client.post(f"{supabase_url}/rest/v1/memes", json=memes)
            res.raise_for_status()
            print(f"✅ Migrated {len(memes)} memes.")
    except Exception as e:
        print(f"⚠️ Error migrating memes: {e}")

    # 5. Migrate Settings
    try:
        cur.execute("SELECT * FROM settings")
        settings_rows = [dict(r) for r in cur.fetchall()]
        if settings_rows:
            res = client.post(f"{supabase_url}/rest/v1/settings", json=settings_rows)
            res.raise_for_status()
            print(f"✅ Migrated {len(settings_rows)} settings.")
    except Exception as e:
        print(f"⚠️ Error migrating settings: {e}")

    print("\n🎉 Migration finished! Your Supabase database is synced and ready.")


if __name__ == "__main__":
    main()

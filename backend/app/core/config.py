"""Application configuration and environment variables."""

import os
from pathlib import Path
from typing import Optional


def load_env_file(filepath: Path) -> None:
    """Simple .env parser to populate os.environ without requiring third-party library."""
    if not filepath.is_file():
        return
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("'\"")
                if key and key not in os.environ:
                    os.environ[key] = val


# Locate root and backend directories
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent

# Attempt to load .env from root or backend
load_env_file(ROOT_DIR / ".env")
load_env_file(BACKEND_DIR / ".env")


class Settings:
    """Global configuration settings."""

    # Server
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Gemini
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")

    # Storage Paths
    BACKEND_DIR: Path = BACKEND_DIR
    DATA_DIR: Path = BACKEND_DIR / "data"
    DATABASE_PATH: Path = BACKEND_DIR / "data" / "vadivelu.db"
    MEME_STORAGE_PATH: Path = BACKEND_DIR / "data" / "memes"
    CACHE_STORAGE_PATH: Path = BACKEND_DIR / "data" / "cache"

    # Edge-TTS Ultra-Natural Expressive Voices
    DEFAULT_VOICE_GENDER: str = os.getenv("DEFAULT_VOICE_GENDER", "female")
    DEFAULT_MALE_VOICE: str = os.getenv("DEFAULT_MALE_VOICE", "en-US-AndrewMultilingualNeural")
    DEFAULT_FEMALE_VOICE: str = os.getenv("DEFAULT_FEMALE_VOICE", "en-US-AvaMultilingualNeural")

    # Cooldowns and timeouts
    DEFAULT_MEME_COOLDOWN_SECONDS: int = 30
    DEFAULT_KEY_COOLDOWN_SECONDS: int = 15
    MAX_KEY_COOLDOWN_SECONDS: int = 300

    def __init__(self):
        # Ensure directories exist
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.MEME_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
        self.CACHE_STORAGE_PATH.mkdir(parents=True, exist_ok=True)


settings = Settings()

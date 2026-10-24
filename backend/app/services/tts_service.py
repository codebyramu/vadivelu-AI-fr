"""Edge-TTS Multi-Voice Engine with Caching and Streaming Support."""

import asyncio
import hashlib
import logging
import os
from pathlib import Path
from typing import AsyncGenerator, Optional, Tuple

import edge_tts

from app.core.config import settings

logger = logging.getLogger("vadivelu.tts")

VOICE_MAP = {
    "male": settings.DEFAULT_MALE_VOICE,
    "female": settings.DEFAULT_FEMALE_VOICE,
}


def resolve_voice(voice: Optional[str] = None, gender: Optional[str] = None) -> str:
    """Resolve voice name from explicit name or gender ('male'/'female')."""
    if voice and voice.strip():
        v = voice.strip().lower()
        if v in VOICE_MAP:
            return VOICE_MAP[v]
        return voice.strip()

    if gender and gender.strip().lower() in VOICE_MAP:
        return VOICE_MAP[gender.strip().lower()]

    default_g = settings.DEFAULT_VOICE_GENDER.lower()
    return VOICE_MAP.get(default_g, settings.DEFAULT_FEMALE_VOICE)


def get_cache_key(text: str, voice: str, rate: Optional[str], pitch: Optional[str]) -> str:
    """Compute sha256 cache key for synthesis parameters."""
    raw = f"{voice}::{rate or '+0%'}::{pitch or '+0Hz'}::{text.strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


class TTSService:
    """TTS engine wrapping Edge-TTS with on-disk caching."""

    def __init__(self, cache_dir: Optional[Path] = None):
        self.cache_dir = cache_dir or settings.CACHE_STORAGE_PATH
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._synthesis_lock = asyncio.Lock()

    def get_cached_audio(
        self, text: str, voice: str, rate: Optional[str] = None, pitch: Optional[str] = None
    ) -> Optional[bytes]:
        """Check if audio exists in cache and return bytes."""
        cache_key = get_cache_key(text, voice, rate, pitch)
        cache_file = self.cache_dir / f"{cache_key}.mp3"
        if cache_file.is_file():
            try:
                return cache_file.read_bytes()
            except Exception as e:
                logger.warning(f"Failed to read cache file {cache_file}: {e}")
        return None

    def get_cached_file_path(
        self, text: str, voice: str, rate: Optional[str] = None, pitch: Optional[str] = None
    ) -> Path:
        """Get the filesystem path where the synthesized audio should be stored."""
        cache_key = get_cache_key(text, voice, rate, pitch)
        return self.cache_dir / f"{cache_key}.mp3"

    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        gender: Optional[str] = None,
        rate: Optional[str] = None,
        pitch: Optional[str] = None,
    ) -> bytes:
        """Synthesize text into MP3 audio bytes, checking cache first."""
        clean_text = text.strip()
        if not clean_text:
            return b""

        actual_voice = resolve_voice(voice, gender)
        cache_file = self.get_cached_file_path(clean_text, actual_voice, rate, pitch)

        if cache_file.is_file() and cache_file.stat().st_size > 0:
            return cache_file.read_bytes()

        # Synthesize via edge_tts
        actual_rate = rate or "+0%"
        actual_pitch = pitch or "+0Hz"

        comm = edge_tts.Communicate(
            text=clean_text,
            voice=actual_voice,
            rate=actual_rate,
            pitch=actual_pitch,
        )

        audio_chunks = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

        audio_bytes = b"".join(audio_chunks)

        if audio_bytes:
            # Write to disk cache
            try:
                temp_file = cache_file.with_suffix(".tmp")
                temp_file.write_bytes(audio_bytes)
                temp_file.replace(cache_file)
            except Exception as e:
                logger.warning(f"Failed to write audio cache: {e}")

        return audio_bytes

    async def stream_audio(
        self,
        text: str,
        voice: Optional[str] = None,
        gender: Optional[str] = None,
        rate: Optional[str] = None,
        pitch: Optional[str] = None,
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio chunks for fast time-to-first-byte playback."""
        clean_text = text.strip()
        if not clean_text:
            return

        actual_voice = resolve_voice(voice, gender)
        cache_file = self.get_cached_file_path(clean_text, actual_voice, rate, pitch)

        if cache_file.is_file() and cache_file.stat().st_size > 0:
            # Yield from cached file in chunks
            with open(cache_file, "rb") as f:
                while chunk := f.read(4096):
                    yield chunk
            return

        # Stream directly and cache
        actual_rate = rate or "+0%"
        actual_pitch = pitch or "+0Hz"
        comm = edge_tts.Communicate(
            text=clean_text,
            voice=actual_voice,
            rate=actual_rate,
            pitch=actual_pitch,
        )

        accumulated = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                data = chunk["data"]
                accumulated.append(data)
                yield data

        if accumulated:
            full_audio = b"".join(accumulated)
            try:
                temp_file = cache_file.with_suffix(".tmp")
                temp_file.write_bytes(full_audio)
                temp_file.replace(cache_file)
            except Exception as e:
                logger.warning(f"Failed to write streaming cache: {e}")


tts_service = TTSService()

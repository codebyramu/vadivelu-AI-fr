"""Edge-TTS Multi-Voice Engine with Caching and Streaming Support."""

import asyncio
import hashlib
import io
import logging
import os
from pathlib import Path
from typing import AsyncGenerator, Dict, Optional, Tuple, Union

import edge_tts
import httpx

from app.core.config import settings

logger = logging.getLogger("vadivelu.tts")

VOICE_MAP = {
    "male": settings.DEFAULT_MALE_VOICE,
    "female": settings.DEFAULT_FEMALE_VOICE,
}

# In-memory duration cache for remote URLs and dialogue clips
_URL_DURATION_CACHE: Dict[str, int] = {
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/ft_08_BestofVadivel-SMSToneVadivel.mp3": 3840,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/ft_02_AahaaAahaa-SMSToneVadivel.mp3": 5799,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/040_22_vadivelu.mp3": 8515,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/044_26_vadivelu.mp3": 6478,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/037_19_vadivelu.mp3": 8620,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/039_21_vadivelu.mp3": 9103,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/042_24_vadivelu.mp3": 9978,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/045_27_vadivelu.mp3": 7584,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/046_28_vadivelu.mp3": 8856,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/041_23_vadivelu.mp3": 6024,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/043_25_vadivelu.mp3": 8736,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/ft_06_Adengappa-SMSToneVadivel.mp3": 4560,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/038_20_vadivelu.mp3": 8496,
    "https://jkgewxlsmazlxotygysr.supabase.co/storage/v1/object/public/vadivelu-clips/clips/ft_10_VadaPoche-SMSToneVadivel.mp3": 4896,
}

KNOWN_DIALOGUE_DURATIONS: Dict[str, int] = {
    "5dbb8a7a-7b09-49c8-93bc-b887a944d6f6": 3840,
    "dd84cf98-9c8d-40c5-9a1b-469975730572": 5799,
    "91924279-ca4d-48ff-b966-3a583c32f3e8": 8515,
    "89b6f255-555e-4af0-8644-ea3f3b9952cc": 6478,
    "351e65eb-eee0-4e59-aa35-258eb9b3d50c": 8620,
    "1fe8378e-5ec7-4c89-a4e3-8f3584db0c04": 9103,
    "ace2d4ed-63af-405d-9544-991985ba7d21": 9978,
    "1f079e82-3c89-4985-9e4f-2515c808a189": 7584,
    "8383bf2a-0ffa-4305-8066-a0599afaf1a0": 8856,
    "44e98537-47d1-4b1e-a9a4-4087cb0f43e0": 6024,
    "fb2ca2eb-df5f-49f7-984b-11529ffebbf6": 8736,
    "b80c5952-948c-4c51-ad48-156a9c7a7364": 4560,
    "75311105-ec9a-4334-96ad-e854294e6178": 8496,
    "f09a8265-b86f-48d3-ad64-3b68a3abbc65": 4896,
    # Seed memes
    "adengappa": 2000,
    "kalakkunga": 1800,
    "stonks": 2200,
    "aahaa": 1900,
    "vadapoche": 2100,
    "enna_koduma": 2300,
}


def parse_mp3_duration_ms(data: bytes) -> int:
    """Parse exact MP3 audio duration in milliseconds from raw audio bytes.

    Uses Mutagen MP3 parser first, with pure-Python MP3 frame header parsing and
    Edge-TTS 48kbps bitrate estimation fallbacks.
    """
    if not data or len(data) < 4:
        return 0

    # 1. Try mutagen MP3
    try:
        from mutagen.mp3 import MP3

        audio = MP3(io.BytesIO(data))
        if audio.info and audio.info.length and audio.info.length > 0:
            return int(round(audio.info.length * 1000))
    except Exception as e:
        logger.debug(f"Mutagen MP3 parse skipped/failed: {e}")

    # 2. Frame-walking parser (MPEG Audio Layer III)
    bitrates_mpeg1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
    bitrates_mpeg2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
    sample_rates = {
        3: [44100, 48000, 32000],  # MPEG 1
        2: [22050, 24000, 16000],  # MPEG 2
        0: [11025, 12000, 8000],   # MPEG 2.5
    }

    pos = 0
    total_samples = 0
    sample_rate = 24000
    n = len(data)

    # Skip ID3v2 header if present
    if data.startswith(b"ID3") and len(data) >= 10:
        tag_size = (
            ((data[6] & 0x7F) << 21)
            | ((data[7] & 0x7F) << 14)
            | ((data[8] & 0x7F) << 7)
            | (data[9] & 0x7F)
        )
        pos = 10 + tag_size

    while pos + 4 <= n:
        if data[pos] == 0xFF and (data[pos + 1] & 0xE0) == 0xE0:
            b1 = data[pos + 1]
            b2 = data[pos + 2]
            version_bits = (b1 >> 3) & 0x03
            layer_bits = (b1 >> 1) & 0x03

            if version_bits != 1 and layer_bits == 1:  # Layer III
                bitrate_idx = (b2 >> 4) & 0x0F
                sr_idx = (b2 >> 2) & 0x03
                padding = (b2 >> 1) & 0x01

                if bitrate_idx not in (0, 15) and sr_idx < 3:
                    version = 3 if version_bits == 3 else (2 if version_bits == 2 else 0)
                    sr = sample_rates[version][sr_idx]
                    sample_rate = sr
                    if version == 3:
                        bitrate = bitrates_mpeg1[bitrate_idx] * 1000
                        samples = 1152
                    else:
                        bitrate = bitrates_mpeg2[bitrate_idx] * 1000
                        samples = 576

                    frame_len = (samples // 8 * bitrate) // sr + padding
                    if frame_len <= 0:
                        pos += 1
                        continue
                    total_samples += samples
                    pos += frame_len
                    continue
        pos += 1

    if sample_rate > 0 and total_samples > 0:
        return int(round((total_samples / sample_rate) * 1000))

    # 3. Fallback: Edge-TTS standard 48 kbps bitrate estimation
    return max(200, int(round((len(data) * 8 / 48000) * 1000)))


def estimate_speech_duration_ms(text: str) -> int:
    """Accurately estimate speech duration from text content when audio bytes are not yet rendered."""
    clean = text.strip()
    if not clean:
        return 0

    words = len(clean.split())
    chars = len(clean)
    # Average conversational tempo: ~380ms per word + 300ms natural sentence padding
    word_est = int(words * 380) + 300
    char_est = int(chars * 55) + 300
    return max(400, max(word_est, char_est))


def get_audio_duration_ms(source: Union[bytes, Path, str]) -> int:
    """Calculate exact audio duration in milliseconds from bytes, file path, or audio URL."""
    if isinstance(source, bytes):
        return parse_mp3_duration_ms(source)

    if isinstance(source, Path):
        if source.is_file() and source.stat().st_size > 0:
            try:
                return parse_mp3_duration_ms(source.read_bytes())
            except Exception as e:
                logger.warning(f"Failed to read audio file for duration: {e}")
        return 0

    if isinstance(source, str):
        s = source.strip()
        if not s:
            return 0

        # Check known dialogue IDs
        if s in KNOWN_DIALOGUE_DURATIONS:
            return KNOWN_DIALOGUE_DURATIONS[s]

        # Check URL duration cache
        if s in _URL_DURATION_CACHE:
            return _URL_DURATION_CACHE[s]

        # Remote HTTP/HTTPS audio URL
        if s.startswith("http://") or s.startswith("https://"):
            try:
                # Fetch first 48KB via range request or regular get for headers
                headers = {"Range": "bytes=0-49151"}
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(s, headers=headers)
                    if resp.status_code in (200, 206) and len(resp.content) > 0:
                        dur = parse_mp3_duration_ms(resp.content)
                        if dur > 0:
                            _URL_DURATION_CACHE[s] = dur
                            return dur
            except Exception as e:
                logger.debug(f"Remote audio duration probe failed for {s}: {e}")
            return 2200

        # Local path check
        candidates = [
            Path(s),
            settings.MEME_STORAGE_PATH / s.lstrip("/"),
            settings.MEME_STORAGE_PATH / Path(s).name,
            settings.CACHE_STORAGE_PATH / s.lstrip("/"),
            settings.CACHE_STORAGE_PATH / Path(s).name,
        ]
        for c in candidates:
            if c.is_file() and c.stat().st_size > 0:
                try:
                    dur = parse_mp3_duration_ms(c.read_bytes())
                    if dur > 0:
                        return dur
                except Exception:
                    pass

    return 0


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

    def get_audio_duration_ms(self, source: Union[bytes, Path, str]) -> int:
        """Calculate exact audio duration in milliseconds."""
        return get_audio_duration_ms(source)

    def estimate_speech_duration_ms(self, text: str) -> int:
        """Estimate speech duration from text."""
        return estimate_speech_duration_ms(text)

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

    async def synthesize_with_duration(
        self,
        text: str,
        voice: Optional[str] = None,
        gender: Optional[str] = None,
        rate: Optional[str] = None,
        pitch: Optional[str] = None,
    ) -> Tuple[bytes, int]:
        """Synthesize text into MP3 audio bytes and return exact duration in milliseconds."""
        audio_bytes = await self.synthesize(
            text=text,
            voice=voice,
            gender=gender,
            rate=rate,
            pitch=pitch,
        )
        duration_ms = 0
        if audio_bytes:
            duration_ms = self.get_audio_duration_ms(audio_bytes)
        if duration_ms <= 0:
            duration_ms = self.estimate_speech_duration_ms(text)
        return audio_bytes, duration_ms

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

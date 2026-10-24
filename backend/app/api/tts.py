"""TTS endpoints for speech synthesis and streaming."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from app.models.schemas import TTSRequest
from app.services.tts_service import tts_service

router = APIRouter(prefix="/api/tts", tags=["TTS"])


@router.post("/synthesize")
async def synthesize_speech(req: TTSRequest):
    """Synthesizes text into high-quality MP3 audio with caching."""
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        audio_bytes = await tts_service.synthesize(
            text=req.text,
            voice=req.voice,
            gender=req.gender,
            rate=req.rate,
            pitch=req.pitch,
        )
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="synthesized.mp3"',
                "Cache-Control": "public, max-age=86400",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {e}")


@router.get("/stream")
async def stream_speech(
    text: str = Query(..., description="Text to synthesize"),
    voice: Optional[str] = Query(None, description="Voice short name"),
    gender: Optional[str] = Query(None, description="Voice gender: male or female"),
    rate: Optional[str] = Query(None, description="Speaking rate, e.g. +10%"),
    pitch: Optional[str] = Query(None, description="Speaking pitch, e.g. +5Hz"),
):
    """Stream synthesized audio chunks for low latency playback."""
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        generator = tts_service.stream_audio(
            text=text,
            voice=voice,
            gender=gender,
            rate=rate,
            pitch=pitch,
        )
        return StreamingResponse(
            generator,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'inline; filename="stream.mp3"',
                "Transfer-Encoding": "chunked",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS stream error: {e}")

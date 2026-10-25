"""FastAPI Main Application for Vadivelu AI."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.chat import router as chat_router
from app.api.conversations import router as conv_router
from app.api.health import router as health_router
from app.api.memes import dialogues_router
from app.api.memes import router as memes_router
from app.api.memories import router as memories_router
from app.api.settings import router as settings_router
from app.api.tts import router as tts_router
from app.core.config import settings
from app.db.database import init_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vadivelu.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: run initialization on startup."""
    logger.info("Initializing SQLite database and seed assets...")
    init_db()
    settings.MEME_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    settings.CACHE_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    logger.info("Vadivelu AI Backend successfully started.")
    yield
    logger.info("Vadivelu AI Backend shutting down.")


app = FastAPI(
    title="Vadivelu AI Backend",
    description="Apple-inspired minimalist conversational AI voice companion with iconic reaction meme clips.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for React / Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for meme audio and thumbnails
app.mount(
    "/memes",
    StaticFiles(directory=str(settings.MEME_STORAGE_PATH)),
    name="memes",
)

# Mount cache for pre-synthesized audio chunks if needed
app.mount(
    "/cache",
    StaticFiles(directory=str(settings.CACHE_STORAGE_PATH)),
    name="cache",
)

# Include API Routers
app.include_router(health_router)
app.include_router(chat_router)
app.include_router(tts_router)
app.include_router(conv_router)
app.include_router(memories_router)
app.include_router(memes_router)
app.include_router(dialogues_router)
app.include_router(settings_router)


@app.get("/")
async def root():
    """Root status ping."""
    return {
        "app": "Vadivelu AI Backend",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )

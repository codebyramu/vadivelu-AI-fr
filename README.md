# 🎭 Vadivelu AI — Premium AI Voice Chat with Persistent Memory & Intelligent Meme Reactions

Vadivelu AI is an Apple-inspired conversational AI voice companion powered primarily by Google Gemini. It combines voice conversation, long-term persistent memory across chats, adaptive response length, and the **Reaction Director** — an intelligent orchestrator that performs responses by seamlessly interleaving natural AI speech with iconic meme audio clips at exactly the right emotional moments.

---

## 🌟 Key Features

### 1. 🎬 The Reaction Director
- Structured response planning with voice gender selection and ordered segments:
  ```json
  {
    "voice": "female",
    "emotion": "celebration",
    "segments": [
      { "type": "speech", "text": "Brooo, congrats brooo!" },
      { "type": "meme", "memeId": "adengappa", "title": "Adengappa!" },
      { "type": "speech", "text": "You actually did a great job, bro!" },
      { "type": "meme", "memeId": "kalakkunga", "title": "Kalakkunga Kalakkunga!" },
      { "type": "speech", "text": "Keep going, champion!" }
    ]
  }
  ```
- **Zero-Latency Audio Preloading**: All speech audio segments and meme clips are fetched/synthesized and preloaded into memory before playback commences, guaranteeing smooth transitions.
- **Sequential Playback Engine**: Waits for audio completion events between segments (`speech` ➔ `meme` ➔ `speech`).
- **Immediate Interruption**: User speech or interruption promptly cancels active playback, clears queued segments, and starts fresh.
- **Emotion & Tone Awareness**: Celebrations get celebratory memes; serious/crisis queries receive calm, empathetic responses with memes automatically suppressed.

### 2. 🔑 Multi-Key Gemini API Key Rotator & Fallback
- Dynamically loads `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, ..., `GEMINI_API_KEY_N` from environment.
- Concurrency-safe round-robin selection.
- Automatic key health tracking: rate-limited keys (429) enter temporary cooldown; transient errors trigger bounded retries with exponential backoff; invalid keys are quarantined.
- Key secrets are never logged or exposed to the client; all logs use aliases (`Key-1`, `Key-2`).

### 3. 🧠 Persistent Long-Term Memory
- Automatically extracts user facts, background, and preferences across chats.
- Performs context-aware callbacks (e.g., remembering your running training when you announce winning a gold medal).
- Full user control: view, edit, add, delete, or clear saved memories anytime.

### 4. 🎙️ Natural Voice Modes
- **Push-to-Talk**: Hold or tap microphone to speak.
- **Continuous Conversation**: Hands-free voice conversation with real-time turn detection and silence timeout.
- **Sonic Waveform Visualizer**: Real-time concentric ripple and waveform visualizer connected to the Web Audio API.

### 5. 🎛️ Per-Chat Personality Presets
- Normal
- Funny Friend
- Sarcastic
- High Energy
- Calm & Supportive
- Study & Technical Mode

### 6. ⌘ Command Palette (`Ctrl + K` / `Cmd + K`)
- Fast navigation, search conversations, toggle voice mode, toggle memes, adjust personality, and switch themes.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Gemini API Key(s) from [Google AI Studio](https://aistudio.google.com/)

### 1. Setup Environment
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Open `.env` and add your Gemini API keys:
```env
GEMINI_API_KEY_1=AIzaSy...
GEMINI_API_KEY_2=AIzaSy...
GEMINI_API_KEY_3=AIzaSy...
```

### 2. Launch with Single Command
```bash
./start.sh
```
This starts:
- **Backend API**: `http://localhost:8000`
- **Frontend App**: `http://localhost:5173`

---

## 🧪 Running Tests
```bash
./test.sh
```
Runs the backend pytest suite and the frontend TypeScript/Vite build verification.

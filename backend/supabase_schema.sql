-- ========================================================================
-- Vadivelu AI — Supabase PostgreSQL Schema & Seeds
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jkgewxlsmazlxotygysr/sql/new
-- ========================================================================

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    personality TEXT NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    voice TEXT,
    performance_json TEXT,
    audio_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Long-Term Memories Table
CREATE TABLE IF NOT EXISTS public.memories (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    content TEXT NOT NULL,
    source_conversation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. Meme Library Table
CREATE TABLE IF NOT EXISTS public.memes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 1500,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    emotion TEXT NOT NULL,
    context_hint TEXT NOT NULL,
    cooldown_seconds INTEGER NOT NULL DEFAULT 30,
    last_used_at TIMESTAMPTZ,
    use_count INTEGER NOT NULL DEFAULT 0,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. User Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memories_active ON public.memories(is_active);
CREATE INDEX IF NOT EXISTS idx_memes_emotion ON public.memes(emotion);

-- Initial Meme Seeds
INSERT INTO public.memes (id, title, file_path, audio_url, thumbnail_url, duration_ms, tags, emotion, context_hint, cooldown_seconds, use_count, is_favorite)
VALUES
    ('adengappa', 'Adengappa!', 'memes/adengappa.mp3', '/memes/adengappa.mp3', '/memes/adengappa.svg', 2000, '["shock", "surprise", "classic", "tamil"]'::jsonb, 'shock', 'Huge surprise or disbelief', 30, 0, false),
    ('kalakkunga', 'Kalakkunga Kalakkunga!', 'memes/kalakkunga.mp3', '/memes/kalakkunga.mp3', '/memes/kalakkunga.svg', 1800, '["celebration", "victory", "hype", "win"]'::jsonb, 'celebration', 'Awesome achievement or victory', 30, 0, false),
    ('stonks', 'Stonks!', 'memes/stonks.mp3', '/memes/stonks.mp3', '/memes/stonks.svg', 2200, '["money", "finance", "sarcasm", "crypto"]'::jsonb, 'irony', 'Questionable financial or strategic move', 30, 0, false),
    ('aahaa', 'Aahaa Aahaa!', 'memes/aahaa.mp3', '/memes/aahaa.mp3', '/memes/aahaa.svg', 1900, '["funny", "laugh", "humor", "comedy"]'::jsonb, 'laughter', 'Funny or ridiculous situation', 30, 0, false),
    ('vadapoche', 'Vada Poche!', 'memes/vadapoche.mp3', '/memes/vadapoche.mp3', '/memes/vadapoche.svg', 2100, '["regret", "missed", "food", "sad-funny"]'::jsonb, 'awkward', 'Disappointment or missed chance', 30, 0, false),
    ('enna_koduma', 'Enna Koduma Saravanan Idhu!', 'memes/enna_koduma.mp3', '/memes/enna_koduma.mp3', '/memes/enna_koduma.svg', 2300, '["drama", "overreaction", "dramatic", "cinema"]'::jsonb, 'awkward', 'Unbelievable drama or suffering', 30, 0, false)
ON CONFLICT (id) DO NOTHING;

-- Initial Settings Seeds
INSERT INTO public.settings (key, value)
VALUES
    ('gemini_model', 'gemini-2.5-flash'),
    ('voice_gender', 'female'),
    ('speaking_rate', '1.0'),
    ('speaking_pitch', '0.0'),
    ('volume', '1.0'),
    ('meme_volume', '1.0'),
    ('memes_enabled', 'true'),
    ('meme_frequency', 'normal'),
    ('voice_mode', 'push_to_talk'),
    ('default_personality', 'normal'),
    ('memory_enabled', 'true'),
    ('auto_save_memory', 'true'),
    ('theme', 'dark'),
    ('audio_retention_days', '7')
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security (RLS) with open policy for service_role / development
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon/authenticated roles in development (or backend service_role)
CREATE POLICY "Allow public access for conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for memories" ON public.memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for memes" ON public.memes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

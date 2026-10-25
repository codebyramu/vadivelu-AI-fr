"""Supabase Direct Dialogues Integration Service with Intelligent Fuzzy/Semantic Relevance Ranking.

Connects directly to the user's Supabase project:
Project: https://jkgewxlsmazlxotygysr.supabase.co
Table: dialogues

Features:
1. Live Vadivelu punchlines and authentic media_url audio links.
2. Intelligent fuzzy/semantic relevance ranking algorithm with:
   - Token overlap and fuzzy keyword similarity across line_text, line_translation, situation_tags, and emotion_tags.
   - Emotion priority weighting (celebration, argument, comedy, frustration, romance, shock, drama).
   - Diversity & anti-repetition penalty (recent usage decay + usage frequency penalty).
3. Extraction and injection of the top 15 most contextually relevant dialogues for the Reaction Director.
"""

import asyncio
import difflib
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import httpx
from app.services.tts_service import KNOWN_DIALOGUE_DURATIONS, get_audio_duration_ms

logger = logging.getLogger("vadivelu.supabase")

# Common English stop words to filter out during tokenization
STOP_WORDS: Set[str] = {
    "a", "about", "above", "after", "again", "all", "am", "an", "and", "any",
    "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "cannot", "could",
    "did", "do", "does", "doing", "don't", "down", "during", "each", "few",
    "for", "from", "further", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "i'm",
    "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
    "let's", "me", "more", "most", "my", "myself", "no", "nor", "not", "of",
    "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "she", "should", "so", "some",
    "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too",
    "under", "until", "up", "very", "was", "wasn't", "we", "were", "what",
    "when", "where", "which", "while", "who", "whom", "why", "with", "won't",
    "would", "you", "your", "yours", "yourself", "yourselves"
}

# Emotion clusters defining semantic relationships and keyword triggers
EMOTION_CLUSTERS: Dict[str, Dict[str, Any]] = {
    "celebration": {
        "tags": ["celebration", "enthusiastic", "excited", "happy", "energetic", "victory", "hype"],
        "keywords": [
            "win", "won", "passed", "success", "achieved", "completed", "champion",
            "competition", "victory", "first", "marathon", "running", "trophy",
            "hurray", "party", "cheers", "super", "ready", "stage", "thayaar"
        ],
        "weight": 24.0,
    },
    "argument": {
        "tags": ["argument", "angry", "conflict", "confrontation", "aggressive", "argumentative", "annoyed"],
        "keywords": [
            "fight", "sanda", "dispute", "quarrel", "yell", "shout", "clash", "rival",
            "opponent", "confront", "marketplace", "why", "who", "dare", "attack"
        ],
        "weight": 24.0,
    },
    "comedy": {
        "tags": ["comedy", "humor", "amused", "laughing", "playful", "humorous", "confident", "phone_call"],
        "keywords": [
            "funny", "laugh", "joke", "comedy", "haha", "chuckle", "hilarious",
            "ridiculous", "prank", "kaippulla", "sanga", "thalaivar", "valibar"
        ],
        "weight": 22.0,
    },
    "frustration": {
        "tags": ["frustrated", "frustration", "annoyance", "annoyed", "exhausted", "complaining", "morning struggle", "awkward"],
        "keywords": [
            "frustrated", "struggle", "annoying", "irritated", "tired", "morning",
            "traffic", "stuck", "bug", "exhausted", "deductions", "work", "salary",
            "failed", "bad luck", "ruined", "missed"
        ],
        "weight": 24.0,
    },
    "romance": {
        "tags": ["romance", "romantic", "flirt", "sweetheart", "affection"],
        "keywords": [
            "love", "crush", "date", "romantic", "propose", "marriage", "bath",
            "brush", "teeth", "charming", "handsome", "beautiful", "girl", "boy"
        ],
        "weight": 24.0,
    },
    "shock": {
        "tags": ["shock", "surprise", "disbelief", "stunned", "unexpected"],
        "keywords": [
            "shock", "shocking", "surprise", "omg", "what happened", "unbelievable",
            "adengappa", "sudden", "unexpectedly", "jaw", "astounded"
        ],
        "weight": 24.0,
    },
    "drama": {
        "tags": ["drama", "serious", "suffering", "cultural discussion", "advice", "devotion", "reverence"],
        "keywords": [
            "drama", "suffering", "tragedy", "pain", "atrocity", "saravanan",
            "koduma", "serious", "muruga", "temple", "modesty", "values", "patience"
        ],
        "weight": 24.0,
    },
}

# Signature Tamil / cultural keywords mapped to distinct dialogues
SIGNATURE_PHRASES: Dict[str, List[str]] = {
    "kaippulla": ["1f079e82"],
    "president": ["1f079e82"],
    "sanga thalaivar": ["1f079e82"],
    "saravanan": ["75311105"],
    "koduma": ["75311105"],
    "atrocity": ["75311105"],
    "sanda": ["1fe8378e"],
    "fight": ["1fe8378e"],
    "muruga": ["5dbb8a7a"],
    "temple": ["5dbb8a7a", "91924279", "351e65eb"],
    "bath": ["8383bf2a"],
    "kulikiren": ["8383bf2a"],
    "morning": ["fb2ca2eb"],
    "struggle": ["fb2ca2eb"],
    "thayaaraaga": ["b80c5952"],
    "ready": ["b80c5952"],
    "modesty": ["dd84cf98"],
    "adakkam": ["dd84cf98"],
    "singam": ["44e98537"],
    "lion": ["44e98537"],
}


def tokenize_query(text: str) -> List[str]:
    """Tokenize and filter text into lowercase non-stopword tokens."""
    tokens = re.findall(r"[a-zA-Z0-9_\u0B80-\u0BFF]+", text.lower())
    return [t for t in tokens if len(t) > 2 and t not in STOP_WORDS]


class SupabaseDialogueService:
    """Manages real-time fetching, caching, and intelligent relevance ranking of Supabase dialogues."""

    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", "https://jkgewxlsmazlxotygysr.supabase.co").rstrip("/")
        self.supabase_key = os.getenv("SUPABASE_KEY", "sb_publishable_bRK6AIBgZykhSsed0rjzpA_gQxaL7sf")
        self._cached_dialogues: List[Dict[str, Any]] = []
        self._cache_timestamp: float = 0.0
        self._cache_ttl_seconds: float = 60.0  # Cache for 1 minute for ultra-fast Gemini responses
        self._cooldown_tracker: Dict[str, float] = {}  # id -> timestamp of last usage
        self._recent_usage_history: List[str] = []  # sliding window of recently used dialogue IDs
        self._max_recent_history: int = 20
        self._default_cooldown: float = 30.0

    @property
    def is_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    def _headers(self) -> Dict[str, str]:
        key = os.getenv("SUPABASE_KEY") or self.supabase_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    async def fetch_dialogues(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Fetch all dialogues from Supabase table, cached in-memory."""
        now = time.time()
        if not force_refresh and self._cached_dialogues and (now - self._cache_timestamp < self._cache_ttl_seconds):
            return self._enrich_availability(self._cached_dialogues)

        if not self.is_configured:
            logger.warning("Supabase URL or Key not configured.")
            return []

        try:
            endpoint = f"{self.supabase_url}/rest/v1/dialogues"
            params = {
                "select": "*",
                "order": "created_at.asc",
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(endpoint, headers=self._headers(), params=params)
                if res.status_code != 200:
                    logger.error(f"Failed to fetch from Supabase (status {res.status_code}): {res.text}")
                    return self._enrich_availability(self._cached_dialogues)

                raw_data = res.json()
                mapped = []
                for row in raw_data:
                    d_id = str(row.get("id"))
                    line_text = row.get("line_text") or ""
                    line_translation = row.get("line_translation") or ""
                    sit_tags = row.get("situation_tags") or []
                    emo_tags = row.get("emotion_tags") or []
                    all_tags = list(sit_tags) + list(emo_tags)
                    media_url = row.get("media_url") or ""

                    primary_emotion = emo_tags[0] if emo_tags else "comedy"

                    # Exact audio duration resolution (using pre-calibrated duration map, URL probe, or local cache)
                    dur_ms = KNOWN_DIALOGUE_DURATIONS.get(d_id)
                    if not dur_ms and media_url:
                        dur_ms = get_audio_duration_ms(media_url)
                    if not dur_ms or dur_ms <= 0:
                        dur_ms = 2200

                    item = {
                        "id": d_id,
                        "title": line_text,
                        "lineText": line_text,
                        "lineTranslation": line_translation,
                        "filePath": media_url,
                        "audioUrl": media_url,
                        "thumbnailUrl": None,
                        "durationMs": dur_ms,
                        "tags": all_tags,
                        "situationTags": sit_tags,
                        "emotionTags": emo_tags,
                        "emotion": primary_emotion,
                        "contextHint": line_translation or line_text,
                        "intensity": row.get("intensity", "mid"),
                        "cooldownSeconds": int(self._default_cooldown),
                        "useCount": row.get("usage_count", 0),
                        "isFavorite": False,
                    }
                    mapped.append(item)

                self._cached_dialogues = mapped
                self._cache_timestamp = now
                logger.info(f"Loaded {len(mapped)} Vadivelu dialogues directly from Supabase with exact durations.")
                return self._enrich_availability(self._cached_dialogues)

        except Exception as e:
            logger.error(f"Exception fetching Supabase dialogues: {e}", exc_info=True)
            return self._enrich_availability(self._cached_dialogues)

    def _enrich_availability(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add live isAvailableNow and status based on cooldown tracking."""
        now = time.time()
        result = []
        for item in items:
            copy_item = dict(item)
            last_used = self._cooldown_tracker.get(item["id"])
            if last_used and (now - last_used < self._default_cooldown):
                copy_item["isAvailableNow"] = False
                copy_item["remainingCooldown"] = int(self._default_cooldown - (now - last_used))
                copy_item["status"] = "cooldown"
            else:
                copy_item["isAvailableNow"] = True
                copy_item["remainingCooldown"] = 0
                copy_item["status"] = "available"
            result.append(copy_item)
        return result

    async def get_dialogue(self, dialogue_id: str) -> Optional[Dict[str, Any]]:
        """Find a specific dialogue by ID."""
        dialogues = await self.fetch_dialogues()
        for d in dialogues:
            if d["id"] == dialogue_id:
                return d
        return None

    def calculate_relevance_score(
        self,
        dialogue: Dict[str, Any],
        prompt: Optional[str] = None,
        emotion: Optional[str] = None,
        personality: Optional[str] = None,
    ) -> Tuple[float, List[str]]:
        """Computes intelligent fuzzy/semantic relevance score for a single dialogue.

        Scoring dimensions:
        1. Token overlap / fuzzy keyword similarity across line_text, line_translation, situation_tags, and emotion_tags.
        2. Emotion priority weighting (boost dialogues matching conversation mood).
        3. Personality alignment.
        4. Diversity & anti-repetition penalty (recent usage decay + frequency penalty).
        """
        score = 5.0  # Base score to guarantee positive baseline for available items
        reasons: List[str] = []

        d_id = str(dialogue.get("id"))
        line_text = (dialogue.get("lineText") or dialogue.get("title") or "").lower()
        line_trans = (dialogue.get("lineTranslation") or dialogue.get("contextHint") or "").lower()
        tags = [t.lower() for t in dialogue.get("tags", [])]
        emo_tags = [t.lower() for t in dialogue.get("emotionTags", [])]
        sit_tags = [t.lower() for t in dialogue.get("situationTags", [])]
        primary_emo = dialogue.get("emotion", "").lower()
        is_available = dialogue.get("isAvailableNow", True)

        prompt_str = (prompt or "").strip().lower()
        query_tokens = tokenize_query(prompt_str) if prompt_str else []

        # -------------------------------------------------------------
        # 1. EMOTION PRIORITY WEIGHTING
        # -------------------------------------------------------------
        target_emo = (emotion or "").strip().lower()

        # If no explicit emotion is provided, detect mood from prompt keywords
        if not target_emo and prompt_str:
            for emo_name, cluster in EMOTION_CLUSTERS.items():
                if any(kw in prompt_str for kw in cluster["keywords"]):
                    target_emo = emo_name
                    break

        if target_emo:
            # Check cluster mapping
            matched_cluster = None
            for cluster_name, cluster_data in EMOTION_CLUSTERS.items():
                if target_emo == cluster_name or target_emo in cluster_data["tags"]:
                    matched_cluster = cluster_data
                    break

            if matched_cluster:
                # Direct match with primary emotion
                if primary_emo in matched_cluster["tags"]:
                    score += matched_cluster["weight"]
                    reasons.append(f"Emotion match ({primary_emo} in {target_emo} mood, +{matched_cluster['weight']}pts)")
                # Secondary match in emotion_tags
                elif any(t in matched_cluster["tags"] for t in emo_tags):
                    score += matched_cluster["weight"] * 0.75
                    reasons.append(f"Emotion tag match (+{matched_cluster['weight'] * 0.75:.1f}pts)")
                # Keyword alignment within cluster
                elif any(kw in prompt_str for kw in matched_cluster["keywords"]):
                    score += 10.0
                    reasons.append(f"Emotion cluster keyword overlap (+10pts)")
            else:
                # General emotion string match
                if target_emo in primary_emo or primary_emo in target_emo:
                    score += 18.0
                    reasons.append(f"Direct emotion match '{target_emo}' (+18pts)")
                elif any(target_emo in t for t in emo_tags):
                    score += 12.0
                    reasons.append(f"Emotion tag overlap '{target_emo}' (+12pts)")

        # -------------------------------------------------------------
        # 2. TOKEN OVERLAP & FUZZY KEYWORD SIMILARITY
        # -------------------------------------------------------------
        if query_tokens:
            matched_tokens = 0
            for token in query_tokens:
                token_matched = False

                # Situation tags exact or substring match
                for st in sit_tags:
                    if token == st:
                        score += 14.0
                        token_matched = True
                        reasons.append(f"Situation tag exact match '{token}' (+14pts)")
                        break
                    elif token in st or st in token:
                        score += 8.0
                        token_matched = True
                        reasons.append(f"Situation tag partial match '{token}' in '{st}' (+8pts)")
                        break

                if token_matched:
                    matched_tokens += 1
                    continue

                # Translation token match
                if token in line_trans:
                    score += 6.0
                    token_matched = True
                    reasons.append(f"Translation keyword match '{token}' (+6pts)")
                else:
                    # Fuzzy match against words in translation
                    for trans_word in line_trans.split():
                        clean_word = re.sub(r"\W+", "", trans_word)
                        if len(clean_word) >= 4 and len(token) >= 4:
                            ratio = difflib.SequenceMatcher(None, token, clean_word).ratio()
                            if ratio >= 0.85:
                                score += 5.0
                                token_matched = True
                                reasons.append(f"Fuzzy keyword match '{token}' ~ '{clean_word}' ({ratio:.2f}, +5pts)")
                                break

                # Text token match (Tamil/romanized)
                if token in line_text:
                    score += 5.0
                    token_matched = True
                    reasons.append(f"Dialogue text match '{token}' (+5pts)")

                if token_matched:
                    matched_tokens += 1

            if matched_tokens > 1:
                # Multiple token overlap synergy bonus
                synergy = matched_tokens * 3.0
                score += synergy
                reasons.append(f"Multi-token synergy ({matched_tokens} tokens, +{synergy}pts)")

        # -------------------------------------------------------------
        # 3. SIGNATURE TAMIL PHRASES TRIGGER
        # -------------------------------------------------------------
        for phrase, matching_ids in SIGNATURE_PHRASES.items():
            if phrase in prompt_str and any(d_id.startswith(mid) or mid in d_id for mid in matching_ids):
                score += 30.0
                reasons.append(f"Signature Vadivelu phrase trigger '{phrase}' (+30pts)")

        # -------------------------------------------------------------
        # 4. PERSONALITY ALIGNMENT BOOST
        # -------------------------------------------------------------
        if personality:
            p_lower = personality.lower()
            if p_lower == "high_energy" and primary_emo in ("enthusiastic", "excited", "celebration"):
                score += 8.0
                reasons.append(f"High-energy personality alignment (+8pts)")
            elif p_lower == "sarcastic" and primary_emo in ("annoyed", "frustrated", "irony", "angry"):
                score += 8.0
                reasons.append(f"Sarcastic personality alignment (+8pts)")
            elif p_lower == "funny_friend" and primary_emo in ("comedy", "playful", "amused", "happy"):
                score += 8.0
                reasons.append(f"Funny friend personality alignment (+8pts)")
            elif p_lower == "calm_supportive" and primary_emo in ("serious", "informative", "devotion", "calm"):
                score += 8.0
                reasons.append(f"Calm supportive personality alignment (+8pts)")

        # -------------------------------------------------------------
        # 5. DIVERSITY & ANTI-REPETITION PENALTY
        # -------------------------------------------------------------
        # Penalty if currently on cooldown
        if not is_available:
            score -= 100.0
            reasons.append("ON COOLDOWN penalty (-100pts)")

        # Sliding window penalty for recently used dialogues
        if d_id in self._recent_usage_history:
            idx = self._recent_usage_history.index(d_id)
            if idx == 0:
                score -= 35.0
                reasons.append("Immediate prior turn repetition penalty (-35pts)")
            elif idx <= 2:
                score -= 20.0
                reasons.append(f"Recent turn repetition penalty (turn -{idx+1}, -20pts)")
            elif idx <= 5:
                score -= 10.0
                reasons.append(f"Recent turn repetition penalty (turn -{idx+1}, -10pts)")

        # Frequency penalty proportional to historical usage count
        use_count = dialogue.get("useCount", 0)
        if use_count > 0:
            freq_penalty = min(use_count * 1.5, 15.0)
            score -= freq_penalty
            reasons.append(f"Usage frequency penalty ({use_count} prior uses, -{freq_penalty:.1f}pts)")

        return score, reasons

    async def rank_dialogues(
        self,
        dialogues: Optional[Union[List[Dict[str, Any]], str]] = None,
        prompt: Optional[str] = None,
        emotion: Optional[str] = None,
        personality: Optional[str] = None,
        limit: int = 15,
    ) -> List[Dict[str, Any]]:
        """Ranks all available dialogues using fuzzy/semantic scoring and returns top `limit`."""
        if isinstance(dialogues, str):
            if prompt is None:
                prompt = dialogues
            dialogues = None

        if dialogues is None:
            dialogues = await self.fetch_dialogues()

        if not dialogues:
            return []

        scored_items: List[Tuple[float, Dict[str, Any]]] = []
        for d in dialogues:
            score, reasons = self.calculate_relevance_score(
                dialogue=d,
                prompt=prompt,
                emotion=emotion,
                personality=personality,
            )
            item_copy = dict(d)
            item_copy["relevanceScore"] = round(score, 1)
            item_copy["relevanceReasons"] = reasons
            scored_items.append((score, item_copy))

        # Sort descending by score
        scored_items.sort(key=lambda x: x[0], reverse=True)

        # Slice top `limit`
        top_ranked = [item for _, item in scored_items[:limit]]
        return top_ranked

    def format_ranked_dialogues_for_director(self, ranked_dialogues: List[Dict[str, Any]]) -> str:
        """Formats the top contextually ranked dialogues for injection into the Reaction Director prompt."""
        if not ranked_dialogues:
            return "No Vadivelu dialogues currently available in soundboard."

        lines = [f"[TOP {len(ranked_dialogues)} CONTEXTUALLY RANKED VADIVELU DIALOGUES (SUPABASE SOUNDBOARD)]:"]
        for idx, d in enumerate(ranked_dialogues, 1):
            d_id = d.get("id", "")
            line_text = d.get("lineText") or d.get("title", "")
            trans = d.get("lineTranslation") or d.get("contextHint", "")
            emo = d.get("emotion", "comedy")
            score = d.get("relevanceScore", 0.0)
            status = "AVAILABLE" if d.get("isAvailableNow", True) else "ON COOLDOWN"
            reasons = "; ".join(d.get("relevanceReasons", [])[:2])

            lines.append(
                f"{idx}. ID: '{d_id}' | Tamil: \"{line_text}\" | English: \"{trans}\" | Mood: {emo} | Status: {status} | Score: {score}"
            )
            if reasons:
                lines.append(f"   Context Fit: {reasons}")

        return "\n".join(lines)

    async def search_dialogues(
        self, query: Optional[str] = None, emotion: Optional[str] = None, limit: int = 15
    ) -> List[Dict[str, Any]]:
        """Search dialogues using the intelligent ranking algorithm."""
        dialogues = await self.fetch_dialogues()
        return await self.rank_dialogues(dialogues=dialogues, prompt=query, emotion=emotion, limit=limit)

    def record_usage(self, dialogue_id: str) -> None:
        """Mark dialogue as used to initiate cooldown and update recent usage history."""
        self._cooldown_tracker[dialogue_id] = time.time()
        # Add to front of recent history
        if dialogue_id in self._recent_usage_history:
            self._recent_usage_history.remove(dialogue_id)
        self._recent_usage_history.insert(0, dialogue_id)
        if len(self._recent_usage_history) > self._max_recent_history:
            self._recent_usage_history.pop()

    def reset_cooldowns(self) -> None:
        """Reset cooldown tracker and recent usage history."""
        self._cooldown_tracker.clear()
        self._recent_usage_history.clear()


supabase_dialogue_service = SupabaseDialogueService()

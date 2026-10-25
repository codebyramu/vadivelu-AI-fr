"""Pydantic models matching shared/types.ts."""

from typing import List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field

VoiceGender = Literal["male", "female"]

PersonalityPreset = Literal[
    "normal",
    "funny_friend",
    "sarcastic",
    "high_energy",
    "calm_supportive",
    "study_technical",
]


class BaseSchema(BaseModel):
    """Base schema configured for camelCase and flexibility."""

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        serialize_by_alias=True,
    )


class SpeechSegment(BaseSchema):
    type: Literal["speech"] = "speech"
    text: str
    voice: Optional[VoiceGender] = None
    audio_url: Optional[str] = Field(default=None, alias="audioUrl")
    duration_ms: Optional[int] = Field(default=None, alias="durationMs")


class MemeSegment(BaseSchema):
    type: Literal["meme"] = "meme"
    meme_id: str = Field(alias="memeId")
    title: Optional[str] = None
    audio_url: Optional[str] = Field(default=None, alias="audioUrl")
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    duration_ms: Optional[int] = Field(default=None, alias="durationMs")


class PauseSegment(BaseSchema):
    type: Literal["pause"] = "pause"
    duration_ms: int = Field(default=400, alias="durationMs")


PerformanceSegment = Union[SpeechSegment, MemeSegment, PauseSegment]


class ToolCallInfo(BaseSchema):
    tool: str
    query: Optional[str] = None
    result_summary: Optional[str] = Field(default=None, alias="resultSummary")
    items_count: Optional[int] = Field(default=None, alias="itemsCount")


class CandidateDialoguePreview(BaseSchema):
    id: str
    line_text: Optional[str] = Field(default=None, alias="lineText")
    line_translation: Optional[str] = Field(default=None, alias="lineTranslation")
    relevance_score: Optional[float] = Field(default=None, alias="relevanceScore")
    emotion: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)


class ThoughtProcess(BaseSchema):
    reasoning: Optional[str] = None
    duration_ms: Optional[int] = Field(default=1200, alias="durationMs")
    searches: Optional[List[str]] = Field(default_factory=list)
    tools_called: Optional[List[ToolCallInfo]] = Field(default_factory=list, alias="toolsCalled")
    memories_considered: Optional[List[str]] = Field(default_factory=list, alias="memoriesConsidered")
    selected_dialogue_id: Optional[str] = Field(default=None, alias="selectedDialogueId")
    selected_dialogue_title: Optional[str] = Field(default=None, alias="selectedDialogueTitle")
    top_ranked_candidates: Optional[List[CandidateDialoguePreview]] = Field(
        default_factory=list, alias="topRankedCandidates"
    )


class PerformancePlan(BaseSchema):
    voice: VoiceGender
    emotion: Optional[str] = "neutral"
    reasoning: Optional[str] = None
    segments: List[PerformanceSegment]
    thought_process: Optional[ThoughtProcess] = Field(default=None, alias="thoughtProcess")


class Message(BaseSchema):
    id: str
    conversation_id: str = Field(alias="conversationId")
    role: Literal["user", "assistant", "system"]
    content: str
    voice: Optional[VoiceGender] = None
    performance: Optional[PerformancePlan] = None
    audio_url: Optional[str] = Field(default=None, alias="audioUrl")
    created_at: str = Field(alias="createdAt")


class Conversation(BaseSchema):
    id: str
    title: str
    personality: PersonalityPreset = "normal"
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    message_count: Optional[int] = Field(default=0, alias="messageCount")
    last_message: Optional[str] = Field(default=None, alias="lastMessage")


class ConversationDetail(Conversation):
    messages: List[Message] = Field(default_factory=list)


class ConversationCreate(BaseSchema):
    title: Optional[str] = None
    personality: Optional[PersonalityPreset] = "normal"


class ConversationUpdate(BaseSchema):
    title: Optional[str] = None
    personality: Optional[PersonalityPreset] = None


class MemeMetadata(BaseSchema):
    id: str
    title: str
    file_path: str = Field(alias="filePath")
    audio_url: str = Field(alias="audioUrl")
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    duration_ms: int = Field(alias="durationMs")
    tags: List[str]
    emotion: str
    context_hint: str = Field(alias="contextHint")
    cooldown_seconds: int = Field(alias="cooldownSeconds")
    last_used_at: Optional[str] = Field(default=None, alias="lastUsedAt")
    use_count: int = Field(default=0, alias="useCount")
    is_favorite: bool = Field(default=False, alias="isFavorite")
    is_available_now: bool = Field(default=True, alias="isAvailableNow")
    remaining_cooldown: Optional[int] = Field(default=0, alias="remainingCooldown")
    line_text: Optional[str] = Field(default=None, alias="lineText")
    line_translation: Optional[str] = Field(default=None, alias="lineTranslation")
    intensity: Optional[str] = Field(default=None, alias="intensity")
    status: Optional[str] = Field(default="available", alias="status")


class MemeCreate(BaseSchema):
    id: str
    title: str
    file_path: str = Field(alias="filePath")
    audio_url: str = Field(alias="audioUrl")
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    duration_ms: int = Field(default=1500, alias="durationMs")
    tags: List[str] = Field(default_factory=list)
    emotion: str = "laughter"
    context_hint: str = Field(default="", alias="contextHint")
    cooldown_seconds: int = Field(default=30, alias="cooldownSeconds")


class MemeUpdate(BaseSchema):
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    emotion: Optional[str] = None
    context_hint: Optional[str] = Field(default=None, alias="contextHint")
    cooldown_seconds: Optional[int] = Field(default=None, alias="cooldownSeconds")
    is_favorite: Optional[bool] = Field(default=None, alias="isFavorite")


class MemoryItem(BaseSchema):
    id: str
    key: str
    content: str
    source_conversation_id: Optional[str] = Field(default=None, alias="sourceConversationId")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    is_active: bool = Field(default=True, alias="isActive")


class MemoryCreate(BaseSchema):
    key: str
    content: str
    source_conversation_id: Optional[str] = Field(default=None, alias="sourceConversationId")


class MemoryUpdate(BaseSchema):
    key: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = Field(default=None, alias="isActive")


class UserSettings(BaseSchema):
    gemini_model: str = Field(default="gemini-2.5-flash", alias="geminiModel")
    voice_gender: VoiceGender = Field(default="female", alias="voiceGender")
    speaking_rate: float = Field(default=1.0, alias="speakingRate")
    speaking_pitch: float = Field(default=0.0, alias="speakingPitch")
    volume: float = Field(default=1.0, alias="volume")
    meme_volume: float = Field(default=1.0, alias="memeVolume")
    memes_enabled: bool = Field(default=True, alias="memesEnabled")
    meme_frequency: Literal["low", "normal", "high"] = Field(default="normal", alias="memeFrequency")
    voice_mode: Literal["push_to_talk", "continuous"] = Field(default="push_to_talk", alias="voiceMode")
    default_personality: PersonalityPreset = Field(default="normal", alias="defaultPersonality")
    memory_enabled: bool = Field(default=True, alias="memoryEnabled")
    auto_save_memory: bool = Field(default=True, alias="autoSaveMemory")
    theme: Literal["light", "dark", "system"] = Field(default="dark", alias="theme")
    audio_retention_days: int = Field(default=7, alias="audioRetentionDays")


class UserSettingsUpdate(BaseSchema):
    gemini_model: Optional[str] = Field(default=None, alias="geminiModel")
    voice_gender: Optional[VoiceGender] = Field(default=None, alias="voiceGender")
    speaking_rate: Optional[float] = Field(default=None, alias="speakingRate")
    speaking_pitch: Optional[float] = Field(default=None, alias="speakingPitch")
    volume: Optional[float] = Field(default=None, alias="volume")
    meme_volume: Optional[float] = Field(default=None, alias="memeVolume")
    memes_enabled: Optional[bool] = Field(default=None, alias="memesEnabled")
    meme_frequency: Optional[Literal["low", "normal", "high"]] = Field(default=None, alias="memeFrequency")
    voice_mode: Optional[Literal["push_to_talk", "continuous"]] = Field(default=None, alias="voiceMode")
    default_personality: Optional[PersonalityPreset] = Field(default=None, alias="defaultPersonality")
    memory_enabled: Optional[bool] = Field(default=None, alias="memoryEnabled")
    auto_save_memory: Optional[bool] = Field(default=None, alias="autoSaveMemory")
    theme: Optional[Literal["light", "dark", "system"]] = Field(default=None, alias="theme")
    audio_retention_days: Optional[int] = Field(default=None, alias="audioRetentionDays")


class SendMessageRequest(BaseSchema):
    conversation_id: Optional[str] = Field(default=None, alias="conversationId")
    content: str
    voice_override: Optional[VoiceGender] = Field(default=None, alias="voiceOverride")
    personality_override: Optional[PersonalityPreset] = Field(default=None, alias="personalityOverride")


class SendMessageResponse(BaseSchema):
    user_message: Message = Field(alias="userMessage")
    assistant_message: Message = Field(alias="assistantMessage")
    performance: PerformancePlan
    memories_created: List[str] = Field(default_factory=list, alias="memoriesCreated")
    key_alias_used: str = Field(alias="keyAliasUsed")


class TTSRequest(BaseSchema):
    text: str
    voice: Optional[str] = None
    gender: Optional[VoiceGender] = None
    rate: Optional[str] = None
    pitch: Optional[str] = None


class SearchResponse(BaseSchema):
    query: str
    conversations: List[Conversation] = Field(default_factory=list)
    messages: List[Message] = Field(default_factory=list)

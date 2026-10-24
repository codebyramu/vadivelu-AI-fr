export type VoiceGender = 'male' | 'female';

export interface SpeechSegment {
  type: 'speech';
  text: string;
  audioUrl?: string; // Preloaded or generated audio URL
}

export interface MemeSegment {
  type: 'meme';
  memeId: string;
  title?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  durationMs?: number;
}

export interface PauseSegment {
  type: 'pause';
  durationMs: number;
}

export type PerformanceSegment = SpeechSegment | MemeSegment | PauseSegment;

export interface PerformancePlan {
  voice: VoiceGender;
  emotion?: string;
  reasoning?: string;
  segments: PerformanceSegment[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  voice?: VoiceGender;
  performance?: PerformancePlan;
  audioUrl?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  personality: PersonalityPreset;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string;
}

export type PersonalityPreset = 
  | 'normal' 
  | 'funny_friend' 
  | 'sarcastic' 
  | 'high_energy' 
  | 'calm_supportive' 
  | 'study_technical';

export interface MemeMetadata {
  id: string;
  title: string;
  filePath: string;
  audioUrl: string;
  thumbnailUrl?: string;
  durationMs: number;
  tags: string[];
  emotion: string; // e.g. "celebration", "shock", "irony", "laughter", "awkward"
  contextHint: string;
  cooldownSeconds: number;
  lastUsedAt?: string | null;
  useCount: number;
  isFavorite: boolean;
}

export interface MemoryItem {
  id: string;
  key: string;
  content: string;
  sourceConversationId?: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface UserSettings {
  geminiModel: string;
  voiceGender: VoiceGender;
  speakingRate: number;
  speakingPitch: number;
  volume: number;
  memeVolume: number;
  memesEnabled: boolean;
  memeFrequency: 'low' | 'normal' | 'high';
  voiceMode: 'push_to_talk' | 'continuous';
  defaultPersonality: PersonalityPreset;
  memoryEnabled: boolean;
  autoSaveMemory: boolean;
  theme: 'light' | 'dark' | 'system';
  audioRetentionDays: number;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  voiceOverride?: VoiceGender;
  personalityOverride?: PersonalityPreset;
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
  performance: PerformancePlan;
  memoriesCreated?: string[];
  keyAliasUsed: string;
}

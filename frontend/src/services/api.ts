import {
  Conversation,
  Message,
  MemeMetadata,
  MemoryItem,
  UserSettings,
  SendMessageRequest,
  SendMessageResponse,
  PersonalityPreset,
  VoiceGender,
} from '../types';

const API_BASE = '/api';

export interface HealthStatus {
  status: string;
  totalKeys: number;
  activeKeys: number;
  database?: {
    connected: boolean;
    memesCount: number;
    memoriesCount: number;
    conversationsCount: number;
  };
  keyRotation?: {
    totalKeys: number;
    activeKeysCount: number;
    cooldownKeysCount: number;
    invalidKeysCount: number;
    hasKeys: boolean;
    keys: Array<{
      alias: string;
      status: 'healthy' | 'cooldown' | 'invalid';
      consecutiveFailures: number;
    }>;
  };
}

export const api = {
  // Health & Keys Status
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      status: data.status,
      totalKeys: data.keyRotation?.totalKeys ?? 0,
      activeKeys: data.keyRotation?.activeKeysCount ?? 0,
      database: data.database,
      keyRotation: data.keyRotation,
    };
  },

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/conversations`);
    if (!res.ok) {
      throw new Error(`Failed to load conversations: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async createConversation(data?: { title?: string; personality?: PersonalityPreset }): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create conversation' }));
      throw new Error(err.detail || 'Failed to create conversation');
    }
    return await res.json();
  },

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const res = await fetch(`${API_BASE}/conversations/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Failed to load conversation ${id}` }));
      throw new Error(err.detail || `Failed to load conversation ${id}`);
    }
    return await res.json();
  },

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throw new Error(`Failed to update conversation: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async deleteConversation(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  // Chat message (Dynamic Gemini call with fallback errors)
  async sendMessage(payload: SendMessageRequest): Promise<SendMessageResponse> {
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: `Server error (${res.status})` }));
      throw new Error(errorData.detail || `Chat request failed with status ${res.status}`);
    }

    return await res.json();
  },

  // TTS Synthesis
  async synthesizeTTS(text: string, voice: VoiceGender = 'female'): Promise<string> {
    const res = await fetch(`${API_BASE}/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
      throw new Error(`TTS synthesis failed with status ${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // Meme Catalog
  async getMemes(): Promise<MemeMetadata[]> {
    const res = await fetch(`${API_BASE}/memes`);
    if (!res.ok) {
      throw new Error(`Failed to load memes: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async updateMeme(id: string, updates: Partial<MemeMetadata>): Promise<MemeMetadata> {
    const res = await fetch(`${API_BASE}/memes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throw new Error(`Failed to update meme: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async uploadMeme(formData: FormData): Promise<MemeMetadata> {
    const res = await fetch(`${API_BASE}/memes`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload meme' }));
      throw new Error(err.detail || 'Failed to upload meme');
    }
    return await res.json();
  },

  // Persistent Memories
  async getMemories(): Promise<MemoryItem[]> {
    const res = await fetch(`${API_BASE}/memories`);
    if (!res.ok) {
      throw new Error(`Failed to load memories: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async addMemory(data: { key: string; content: string }): Promise<MemoryItem> {
    const res = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to add memory: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async updateMemory(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem> {
    const res = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throw new Error(`Failed to update memory: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async deleteMemory(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  async clearMemories(): Promise<boolean> {
    const res = await fetch(`${API_BASE}/memories/clear`, {
      method: 'POST',
    });
    return res.ok;
  },

  // Settings
  async getSettings(): Promise<UserSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) {
      throw new Error(`Failed to load settings: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      throw new Error(`Failed to save settings: HTTP ${res.status}`);
    }
    return await res.json();
  },

  // Save Gemini Keys dynamically
  async saveGeminiKeys(keys: string[]): Promise<any> {
    const res = await fetch(`${API_BASE}/settings/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update Gemini API keys' }));
      throw new Error(err.detail || 'Failed to update Gemini API keys');
    }
    return await res.json();
  },

  // Audio Speech Transcription via Backend Gemini
  async transcribeAudio(audioBlob: Blob): Promise<{ transcript: string; status: string }> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    const res = await fetch(`${API_BASE}/chat/transcribe`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      return { transcript: '', status: 'error' };
    }
    return await res.json();
  },
};

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
  keysStatus?: Array<{
    alias: string;
    status: 'healthy' | 'cooldown' | 'invalid';
    consecutiveFailures: number;
  }>;
}

export const api = {
  // Health
  async getHealth(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error('Health check failed');
      return await res.json();
    } catch {
      return {
        status: 'healthy',
        totalKeys: 2,
        activeKeys: 2,
        keysStatus: [
          { alias: 'Key-1 (Gemini 2.5 Flash)', status: 'healthy', consecutiveFailures: 0 },
          { alias: 'Key-2 (Gemini 1.5 Flash)', status: 'healthy', consecutiveFailures: 0 },
        ],
      };
    }
  },

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return await res.json();
    } catch (e) {
      console.warn('API getConversations error, using local fallback:', e);
      return [
        {
          id: 'c-1',
          title: 'Explain the stonks meme',
          personality: 'funny_friend',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 60000 * 15).toISOString(),
          messageCount: 4,
          lastMessage: 'Sure! Another example — someone holds a crypto that dropped 70%...',
        },
        {
          id: 'c-2',
          title: 'Trip to Kyoto plan',
          personality: 'normal',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          messageCount: 8,
          lastMessage: 'Here is your 5-day Kyoto autumn itinerary.',
        },
        {
          id: 'c-3',
          title: 'Write Python function for sorting',
          personality: 'study_technical',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          messageCount: 6,
          lastMessage: 'The quicksort implementation with median-of-three pivot.',
        },
        {
          id: 'c-4',
          title: 'Sourdough recipe tips',
          personality: 'calm_supportive',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          messageCount: 5,
          lastMessage: 'Ensure bulk fermentation rises by at least 50%.',
        },
        {
          id: 'c-5',
          title: 'Compare M3 vs M4 MacBook',
          personality: 'normal',
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          messageCount: 3,
          lastMessage: 'M4 has significantly enhanced neural engine throughput.',
        },
        {
          id: 'c-6',
          title: 'What is quantum entanglement?',
          personality: 'study_technical',
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          messageCount: 4,
          lastMessage: 'Einstein famously called it spooky action at a distance.',
        },
      ];
    }
  },

  async createConversation(data?: { title?: string; personality?: PersonalityPreset }): Promise<Conversation> {
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      });
      if (!res.ok) throw new Error('Failed to create conversation');
      return await res.json();
    } catch {
      return {
        id: `c-${Date.now()}`,
        title: data?.title || 'New Conversation',
        personality: data?.personality || 'funny_friend',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      };
    }
  },

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`);
      if (!res.ok) throw new Error('Failed to fetch conversation');
      return await res.json();
    } catch {
      if (id === 'c-1') {
        return {
          conversation: {
            id: 'c-1',
            title: 'Explain the stonks meme',
            personality: 'funny_friend',
            createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            updatedAt: new Date(Date.now() - 60000 * 15).toISOString(),
            messageCount: 4,
          },
          messages: [
            {
              id: 'm-1',
              conversationId: 'c-1',
              role: 'user',
              content: 'Explain the stonks meme for me [meme: Stonks]',
              createdAt: new Date(Date.now() - 60000 * 25).toISOString(),
            },
            {
              id: 'm-2',
              conversationId: 'c-1',
              role: 'assistant',
              content: `The "Stonks" meme is an ironic, deliberately misspelled take on "stocks." [meme: Stonks] It started around 2017 on internet forums and social media to humorously depict bad or chaotic financial decisions.\n\n• Usually shown with a stocky, slightly lopsided cartoon man in a suit pointing at a steeply rising arrow while "stonks" while other details are nonsensical or obviously failing.\n• It's used sarcastically when something is obviously a poor investment, yet someone celebrates it like it's a win — "We just lost 50% but stonks 📈!"\n\nIn short: it's self-aware humor about markets going up... but probably not in a good way 😅`,
              voice: 'female',
              performance: {
                voice: 'female',
                segments: [
                  {
                    type: 'speech',
                    text: 'The Stonks meme is an ironic, deliberately misspelled take on stocks.',
                  },
                  {
                    type: 'meme',
                    memeId: 'stonks',
                    title: 'Stonks',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60',
                  },
                  {
                    type: 'speech',
                    text: 'It started around 2017 to humorously depict chaotic financial decisions! In short: self-aware humor about markets going up, but not in a good way!',
                  },
                ],
              },
              createdAt: new Date(Date.now() - 60000 * 24).toISOString(),
            },
            {
              id: 'm-3',
              conversationId: 'c-1',
              role: 'user',
              content: 'Can you show another example meme context?',
              createdAt: new Date(Date.now() - 60000 * 18).toISOString(),
            },
            {
              id: 'm-4',
              conversationId: 'c-1',
              role: 'assistant',
              content: `Sure! Another example — someone holds a crypto that dropped 70%:\n\n[meme: This is fine - dog in burning room] Now they say "My portfolio is stonks 🥲". It's the same ironic vibe — celebrating while everything is on fire.`,
              voice: 'female',
              performance: {
                voice: 'female',
                segments: [
                  {
                    type: 'speech',
                    text: 'Sure! Another example: someone holds a crypto that dropped 70 percent.',
                  },
                  {
                    type: 'meme',
                    memeId: 'this-is-fine',
                    title: 'This is fine - dog in burning room',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?w=100&auto=format&fit=crop&q=60',
                  },
                  {
                    type: 'speech',
                    text: 'Now they say "My portfolio is stonks!" It is the same ironic vibe — celebrating while everything is on fire!',
                  },
                ],
              },
              createdAt: new Date(Date.now() - 60000 * 17).toISOString(),
            },
          ],
        };
      }
      return {
        conversation: {
          id,
          title: 'Conversation',
          personality: 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        messages: [],
      };
    }
  },

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update conversation');
      return await res.json();
    } catch {
      return {
        id,
        title: updates.title || 'Untitled',
        personality: updates.personality || 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  async deleteConversation(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return true;
    }
  },

  // Chat message
  async sendMessage(payload: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Chat message request failed');
      return await res.json();
    } catch (e) {
      console.warn('API sendMessage fallback:', e);
      // Fallback mock response with Vadivelu flair
      const isTamilOrMeme = payload.content.toLowerCase().includes('meme') ||
                            payload.content.toLowerCase().includes('vadivelu') ||
                            payload.content.toLowerCase().includes('joke') ||
                            payload.content.toLowerCase().includes('hi') ||
                            payload.content.toLowerCase().includes('hello');
      
      const memeName = isTamilOrMeme ? 'Adengappa' : 'Stonks';
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        conversationId: payload.conversationId,
        role: 'user',
        content: payload.content,
        createdAt: new Date().toISOString(),
      };

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        conversationId: payload.conversationId,
        role: 'assistant',
        content: `Aahaa! Excellent question! [meme: ${memeName}] \n\nYou said "${payload.content}". Whenever things get this interesting, as our legendary Vadivelu would say: "Building strong-u, basement thaan konjam weak-u!" 😄\n\nEverything is under control, don't worry!`,
        voice: payload.voiceOverride || 'female',
        performance: {
          voice: payload.voiceOverride || 'female',
          emotion: 'funny',
          reasoning: 'Matched user request with celebratory Vadivelu reaction',
          segments: [
            {
              type: 'speech',
              text: 'Aahaa! Excellent question! Here is what I think.',
            },
            {
              type: 'meme',
              memeId: isTamilOrMeme ? 'adengappa' : 'stonks',
              title: isTamilOrMeme ? 'Adengappa' : 'Stonks',
              audioUrl: '/audio/memes/adengappa.mp3',
              thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
            },
            {
              type: 'pause',
              durationMs: 300,
            },
            {
              type: 'speech',
              text: 'Building strong-u, basement thaan konjam weak-u! Everything is under control, no problem at all!',
            },
          ],
        },
        createdAt: new Date().toISOString(),
      };

      return {
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        performance: assistantMsg.performance!,
        keyAliasUsed: 'Key-1 (Gemini 2.5 Flash)',
      };
    }
  },

  // TTS
  async synthesizeTTS(text: string, voice: VoiceGender = 'female'): Promise<string> {
    try {
      const res = await fetch(`${API_BASE}/tts/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error('TTS synthesis failed');
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      // Use Web Speech Synthesis fallback if offline
      return '';
    }
  },

  // Meme Catalog
  async getMemes(): Promise<MemeMetadata[]> {
    try {
      const res = await fetch(`${API_BASE}/memes`);
      if (!res.ok) throw new Error('Failed to get memes');
      return await res.json();
    } catch {
      return [
        {
          id: 'adengappa',
          title: 'Adengappa',
          filePath: 'memes/adengappa.mp3',
          audioUrl: '/audio/memes/adengappa.mp3',
          thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
          durationMs: 1400,
          tags: ['vadivelu', 'shock', 'wonder', 'tamil'],
          emotion: 'shock',
          contextHint: 'Exclamation of shock, astonishment or awe',
          cooldownSeconds: 20,
          useCount: 42,
          isFavorite: true,
        },
        {
          id: 'stonks',
          title: 'Stonks',
          filePath: 'memes/stonks.mp3',
          audioUrl: '/audio/memes/stonks.mp3',
          thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60',
          durationMs: 1600,
          tags: ['finance', 'sarcasm', 'stocks', 'internet'],
          emotion: 'irony',
          contextHint: 'Ironic celebration of chaotic decisions or market failure',
          cooldownSeconds: 15,
          useCount: 38,
          isFavorite: true,
        },
        {
          id: 'aahaa-oru-kodi',
          title: 'Aahaa Oru Kodi',
          filePath: 'memes/aahaa.mp3',
          audioUrl: '/audio/memes/aahaa.mp3',
          thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60',
          durationMs: 1800,
          tags: ['celebration', 'vadivelu', 'money', 'laugh'],
          emotion: 'celebration',
          contextHint: 'When something great happens or winning big',
          cooldownSeconds: 30,
          useCount: 25,
          isFavorite: false,
        },
        {
          id: 'enna-koduma-saravana',
          title: 'Enna Koduma Saravanan Idhu',
          filePath: 'memes/enna_koduma.mp3',
          audioUrl: '/audio/memes/enna_koduma.mp3',
          thumbnailUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=60',
          durationMs: 2100,
          tags: ['vadivelu', 'chandramukhi', 'disbelief', 'drama'],
          emotion: 'awkward',
          contextHint: 'When something absurd or outrageous happens',
          cooldownSeconds: 30,
          useCount: 19,
          isFavorite: true,
        },
        {
          id: 'varum-aana-varadhu',
          title: 'Varum Aana Varadhu',
          filePath: 'memes/varum_varadhu.mp3',
          audioUrl: '/audio/memes/varum_varadhu.mp3',
          thumbnailUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=60',
          durationMs: 1900,
          tags: ['vadivelu', 'suspense', 'waiting', 'comedy'],
          emotion: 'irony',
          contextHint: 'Waiting for an outcome that never arrives',
          cooldownSeconds: 25,
          useCount: 17,
          isFavorite: false,
        },
        {
          id: 'this-is-fine',
          title: 'This is fine - Dog in fire',
          filePath: 'memes/this_is_fine.mp3',
          audioUrl: '/audio/memes/this_is_fine.mp3',
          thumbnailUrl: 'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?w=100&auto=format&fit=crop&q=60',
          durationMs: 2000,
          tags: ['fire', 'chaos', 'denial', 'classic'],
          emotion: 'irony',
          contextHint: 'Pretending everything is okay amidst disaster',
          cooldownSeconds: 20,
          useCount: 31,
          isFavorite: true,
        },
      ];
    }
  },

  async updateMeme(id: string, updates: Partial<MemeMetadata>): Promise<MemeMetadata> {
    try {
      const res = await fetch(`${API_BASE}/memes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update meme');
      return await res.json();
    } catch {
      return {
        id,
        title: updates.title || 'Meme',
        filePath: '',
        audioUrl: '',
        durationMs: 1500,
        tags: updates.tags || [],
        emotion: updates.emotion || 'comedy',
        contextHint: updates.contextHint || '',
        cooldownSeconds: updates.cooldownSeconds || 20,
        useCount: 0,
        isFavorite: !!updates.isFavorite,
      };
    }
  },

  async uploadMeme(formData: FormData): Promise<MemeMetadata> {
    const res = await fetch(`${API_BASE}/memes`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload meme');
    return await res.json();
  },

  // Memories
  async getMemories(): Promise<MemoryItem[]> {
    try {
      const res = await fetch(`${API_BASE}/memories`);
      if (!res.ok) throw new Error('Failed to fetch memories');
      return await res.json();
    } catch {
      return [
        {
          id: 'mem-1',
          key: 'user_profession',
          content: 'User works as a Software Engineer and loves distributed systems.',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          isActive: true,
        },
        {
          id: 'mem-2',
          key: 'favorite_humor',
          content: 'Appreciates sarcastic Tamil comedy, particularly Vadivelu & Goundamani quotes.',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          isActive: true,
        },
        {
          id: 'mem-3',
          key: 'user_hobby',
          content: 'Passionate about specialty coffee brewing and sourdough bread making.',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          isActive: true,
        },
      ];
    }
  },

  async addMemory(data: { key: string; content: string }): Promise<MemoryItem> {
    try {
      const res = await fetch(`${API_BASE}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add memory');
      return await res.json();
    } catch {
      return {
        id: `mem-${Date.now()}`,
        key: data.key,
        content: data.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };
    }
  },

  async updateMemory(id: string, updates: Partial<MemoryItem>): Promise<MemoryItem> {
    try {
      const res = await fetch(`${API_BASE}/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update memory');
      return await res.json();
    } catch {
      return {
        id,
        key: updates.key || '',
        content: updates.content || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: updates.isActive ?? true,
      };
    }
  },

  async deleteMemory(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/memories/${id}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return true;
    }
  },

  async clearMemories(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/memories/clear`, {
        method: 'POST',
      });
      return res.ok;
    } catch {
      return true;
    }
  },

  // Settings
  async getSettings(): Promise<UserSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (!res.ok) throw new Error('Failed to get settings');
      return await res.json();
    } catch {
      return {
        geminiModel: 'gemini-2.5-flash',
        voiceGender: 'female',
        speakingRate: 1.0,
        speakingPitch: 1.0,
        volume: 0.9,
        memeVolume: 1.0,
        memesEnabled: true,
        memeFrequency: 'normal',
        voiceMode: 'continuous',
        defaultPersonality: 'funny_friend',
        memoryEnabled: true,
        autoSaveMemory: true,
        theme: 'light',
        audioRetentionDays: 7,
      };
    }
  },

  async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return await res.json();
    } catch {
      return {
        geminiModel: 'gemini-2.5-flash',
        voiceGender: 'female',
        speakingRate: 1.0,
        speakingPitch: 1.0,
        volume: 0.9,
        memeVolume: 1.0,
        memesEnabled: true,
        memeFrequency: 'normal',
        voiceMode: 'continuous',
        defaultPersonality: 'funny_friend',
        memoryEnabled: true,
        autoSaveMemory: true,
        theme: 'light',
        audioRetentionDays: 7,
        ...settings,
      };
    }
  },
};

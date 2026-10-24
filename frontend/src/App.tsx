import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, Message, UserSettings, PerformancePlan } from './types';
import { api } from './services/api';
import { useAudioPerformance } from './hooks/useAudioPerformance';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { MainChatView } from './components/MainChatView';
import { VoiceModeView } from './components/VoiceModeView';
import { MiniVoiceWidget } from './components/MiniVoiceWidget';
import { CommandPalette } from './components/CommandPalette';
import { MemeLibraryModal } from './components/MemeLibraryModal';
import { MemoryModal } from './components/MemoryModal';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  // Views & Modals
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isMiniVoiceOpen, setIsMiniVoiceOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMemeLibraryOpen, setIsMemeLibraryOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Settings & Theme
  const [settings, setSettings] = useState<UserSettings>(() => {
    const savedTheme = (localStorage.getItem('vadivelu_theme') as 'light' | 'dark') || 'light';
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
      defaultPersonality: 'normal',
      memoryEnabled: true,
      autoSaveMemory: true,
      theme: savedTheme,
      audioRetentionDays: 7,
    };
  });

  const isDark = settings.theme === 'dark';

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('vadivelu_theme', settings.theme);
  }, [isDark, settings.theme]);

  // Conversations & Messages
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Audio Performance Controller
  const audioPerformance = useAudioPerformance({
    defaultSpeechVolume: settings.volume,
    defaultMemeVolume: settings.memeVolume,
    onFinished: () => {
      setPlayingMessageId(null);
    },
  });

  // Load initial settings and conversations from REAL database
  useEffect(() => {
    api.getSettings().then(serverSettings => {
      setSettings(prev => ({
        ...prev,
        ...serverSettings,
        theme: (localStorage.getItem('vadivelu_theme') as any) || serverSettings.theme || 'light',
      }));
    }).catch(() => {});

    api.getConversations().then(data => {
      setConversations(data);
      if (data && data.length > 0) {
        setActiveConversationId(data[0].id);
      }
    }).catch(err => {
      console.warn('No initial conversations loaded:', err);
    });
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    api.getConversation(activeConversationId)
      .then(res => {
        setMessages(res.messages || []);
      })
      .catch(err => {
        console.error('Failed to load conversation messages:', err);
        setMessages([]);
      })
      .finally(() => {
        setIsLoadingMessages(false);
      });
  }, [activeConversationId]);

  // Audio Playback for a given message
  const handlePlayMessageAudio = useCallback((message: Message) => {
    if (playingMessageId === message.id && audioPerformance.isPlaying) {
      audioPerformance.interrupt();
      setPlayingMessageId(null);
      return;
    }

    setPlayingMessageId(message.id);

    // If message has a performance plan, execute it
    if (message.performance) {
      audioPerformance.playPerformance(message.performance);
    } else {
      // Synthesize clean speech without inline meme tags
      const cleanText = message.content.replace(/\[meme:\s*[^\]]+\]/gi, '').trim();
      if (!cleanText) return;
      const plan: PerformancePlan = {
        voice: message.voice || settings.voiceGender,
        segments: [{ type: 'speech', text: cleanText }],
      };
      audioPerformance.playPerformance(plan);
    }
  }, [playingMessageId, audioPerformance, settings.voiceGender]);

  // Handle message submission
  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Interrupt any existing playing audio
    audioPerformance.interrupt();
    setPlayingMessageId(null);

    let currentConvId = activeConversationId;

    // If there is no active conversation, create one in SQLite DB first
    if (!currentConvId) {
      try {
        const cleanTitle = content.length > 32 ? content.slice(0, 32).trim() + '...' : content.trim();
        const newConv = await api.createConversation({
          title: cleanTitle,
          personality: settings.defaultPersonality,
        });
        currentConvId = newConv.id;
        setActiveConversationId(newConv.id);
        setConversations(prev => [newConv, ...prev]);
      } catch (err: any) {
        console.error('Failed to create conversation:', err);
        return;
      }
    }

    // Temporary optimistic user message
    const tempUserId = `temp-${Date.now()}`;
    const tempUserMsg: Message = {
      id: tempUserId,
      conversationId: currentConvId,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const activeConv = conversations.find(c => c.id === currentConvId);
      const res = await api.sendMessage({
        conversationId: currentConvId,
        content: content.trim(),
        voiceOverride: settings.voiceGender,
        personalityOverride: activeConv?.personality || settings.defaultPersonality,
      });

      // Replace temp user message with actual server message and append assistant message
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserId);
        return [...filtered, res.userMessage, res.assistantMessage];
      });

      // Auto-update conversation title if it was "New Chat"
      const activeC = conversations.find(c => c.id === currentConvId);
      if (activeC && (activeC.title === 'New Chat' || activeC.title.startsWith('New '))) {
        const generatedTitle = content.length > 30 ? content.slice(0, 30).trim() + '...' : content.trim();
        api.updateConversation(currentConvId, { title: generatedTitle })
          .then(updated => {
            setConversations(list => list.map(c => c.id === updated.id ? { ...c, title: updated.title } : c));
          })
          .catch(() => {});
      }

      // If in Voice Mode or Mini Voice Widget, auto-play response performance!
      if ((isVoiceMode || isMiniVoiceOpen) && res.performance) {
        setPlayingMessageId(res.assistantMessage.id);
        audioPerformance.playPerformance(res.performance);
      }
    } catch (e: any) {
      console.error('Gemini chat request failed:', e);
      // Display the true server error message instead of fake content
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        conversationId: currentConvId,
        role: 'assistant',
        content: `⚠️ **Gemini API Error**: ${e.message || 'Failed to generate response. Please verify your Gemini API key in Settings.'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  }, [activeConversationId, conversations, settings, isVoiceMode, isMiniVoiceOpen, audioPerformance]);

  // Speech Recognition Hook
  const speechRecognition = useSpeechRecognition({
    mode: isVoiceMode || isMiniVoiceOpen ? settings.voiceMode : 'push_to_talk',
    onSpeechStart: () => {
      // User started talking, interrupt assistant playback immediately
      if (audioPerformance.isPlaying) {
        audioPerformance.interrupt();
        setPlayingMessageId(null);
      }
    },
    onFinalTranscript: (text: string) => {
      if (text.trim()) {
        handleSendMessage(text);
      }
    },
  });

  // Start Live Voice Chat (Mini UI in bottom right corner as requested)
  const handleOpenLiveVoice = useCallback(() => {
    setIsMiniVoiceOpen(true);
    speechRecognition.startListening();
  }, [speechRecognition]);

  // Close Live Voice Chat
  const handleCloseLiveVoice = useCallback(() => {
    setIsMiniVoiceOpen(false);
    speechRecognition.stopListening();
    if (audioPerformance.isPlaying) {
      audioPerformance.interrupt();
    }
  }, [speechRecognition, audioPerformance]);

  // New Chat handler: start empty!
  const handleNewChat = useCallback(async () => {
    try {
      const newConv = await api.createConversation({
        title: 'New Chat',
        personality: settings.defaultPersonality,
      });
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
    } catch (e) {
      console.error('Failed to create new chat:', e);
    }
  }, [settings.defaultPersonality]);

  // Delete conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(prev => {
        const remaining = prev.filter(c => c.id !== id);
        if (activeConversationId === id) {
          const nextActive = remaining.length > 0 ? remaining[0].id : '';
          setActiveConversationId(nextActive);
        }
        return remaining;
      });
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  }, [activeConversationId]);

  // Rename conversation
  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    try {
      const updated = await api.updateConversation(id, { title: newTitle });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: updated.title } : c));
    } catch (e) {
      console.error('Failed to rename conversation:', e);
    }
  }, []);

  // Theme toggle
  const handleToggleTheme = useCallback(() => {
    const nextTheme = isDark ? 'light' : 'dark';
    setSettings(prev => ({ ...prev, theme: nextTheme }));
    api.saveSettings({ theme: nextTheme }).catch(() => {});
  }, [isDark]);

  return (
    <div className={`w-screen h-screen overflow-hidden ${isDark ? 'dark bg-[#0b0e14] text-white' : 'bg-gray-100 text-slate-900'}`}>
      {/* Immersive Fullscreen Voice Mode View */}
      {isVoiceMode ? (
        <VoiceModeView
          onClose={() => setIsVoiceMode(false)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          isListening={speechRecognition.isListening}
          onToggleListening={() => {
            if (speechRecognition.isListening) speechRecognition.stopListening();
            else speechRecognition.startListening();
          }}
          onInterrupt={() => {
            audioPerformance.interrupt();
            setPlayingMessageId(null);
          }}
          playbackStatus={audioPerformance.status}
          activeMeme={audioPerformance.activeMeme}
          analyserNode={audioPerformance.analyserNode || speechRecognition.micAnalyser}
          messages={messages}
          transcript={speechRecognition.transcript}
          interimTranscript={speechRecognition.interimTranscript}
        />
      ) : (
        /* Main Chat View (macOS style window frame) */
        <MainChatView
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onOpenVoiceMode={handleOpenLiveVoice}
          onPlayMessageAudio={handlePlayMessageAudio}
          isAudioPlaying={audioPerformance.isPlaying}
          playingMessageId={playingMessageId}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenMemories={() => setIsMemoryModalOpen(true)}
          onOpenMemes={() => setIsMemeLibraryOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          personality={conversations.find(c => c.id === activeConversationId)?.personality || settings.defaultPersonality}
          onStartPushToTalk={() => speechRecognition.startListening()}
          onStopPushToTalk={() => speechRecognition.stopListening()}
          isListening={speechRecognition.isListening}
        />
      )}

      {/* Mini Voice Chat Widget in Bottom Right Corner (small as possible) */}
      {!isVoiceMode && (
        <MiniVoiceWidget
          isOpen={isMiniVoiceOpen}
          onClose={handleCloseLiveVoice}
          onExpandFullscreen={() => {
            setIsMiniVoiceOpen(false);
            setIsVoiceMode(true);
          }}
          isListening={speechRecognition.isListening}
          onToggleListening={() => {
            if (speechRecognition.isListening) speechRecognition.stopListening();
            else speechRecognition.startListening();
          }}
          onInterrupt={() => {
            audioPerformance.interrupt();
            setPlayingMessageId(null);
          }}
          playbackStatus={audioPerformance.status}
          activeMeme={audioPerformance.activeMeme}
          analyserNode={audioPerformance.analyserNode || speechRecognition.micAnalyser}
          transcript={speechRecognition.transcript}
          interimTranscript={speechRecognition.interimTranscript}
          isDarkTheme={isDark}
          voiceGender={settings.voiceGender}
        />
      )}

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={id => {
          setActiveConversationId(id);
          setIsCommandPaletteOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setIsCommandPaletteOpen(false);
        }}
        onToggleVoiceMode={handleOpenLiveVoice}
        onOpenMemes={() => {
          setIsCommandPaletteOpen(false);
          setIsMemeLibraryOpen(true);
        }}
        onOpenMemories={() => {
          setIsCommandPaletteOpen(false);
          setIsMemoryModalOpen(true);
        }}
        onOpenSettings={() => {
          setIsCommandPaletteOpen(false);
          setIsSettingsModalOpen(true);
        }}
        onToggleTheme={handleToggleTheme}
        isDarkTheme={isDark}
        memesEnabled={settings.memesEnabled}
        onToggleMemes={() => {
          const val = !settings.memesEnabled;
          setSettings(s => ({ ...s, memesEnabled: val }));
          api.saveSettings({ memesEnabled: val }).catch(() => {});
        }}
      />

      {/* Meme Library Catalog Modal */}
      <MemeLibraryModal
        isOpen={isMemeLibraryOpen}
        onClose={() => setIsMemeLibraryOpen(false)}
      />

      {/* Persistent Memory Manager Modal */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
      />

      {/* Settings & Gemini API Keys Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={updates => {
          setSettings(s => ({ ...s, ...updates }));
          api.saveSettings(updates).catch(() => {});
        }}
        isDarkTheme={isDark}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
};

export default App;

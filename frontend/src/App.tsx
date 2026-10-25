import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, Message, UserSettings, PerformancePlan } from './types';
import { api } from './services/api';
import { useAudioPerformance } from './hooks/useAudioPerformance';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { MainChatView } from './components/MainChatView';
import { VoiceModeView } from './components/VoiceModeView';
import { CommandPalette } from './components/CommandPalette';
import { MemeLibraryModal } from './components/MemeLibraryModal';
import { MemoryModal } from './components/MemoryModal';
import { SettingsModal } from './components/SettingsModal';
import { ToastNotification, ToastItem, ToastType } from './components/ToastNotification';

const getInitialConversationId = (): string => {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  const match = path.match(/^\/c\/([^/?#]+)/);
  if (match && match[1] && match[1] !== 'new') {
    return match[1];
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('c') || '';
};

export const App: React.FC = () => {
  // Views & Modals
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isMiniVoiceOpen, setIsMiniVoiceOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMemeLibraryOpen, setIsMemeLibraryOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Toast Notification System
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3200) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Sending Message Loading Indicator
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Theme State & System Preference Tracking
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('vadivelu_theme') as 'light' | 'dark' | 'system' | null;
    return saved || 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = themeChoice === 'system' ? systemPrefersDark : themeChoice === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('vadivelu_theme', themeChoice);
  }, [isDark, themeChoice]);

  // Settings
  const [settings, setSettings] = useState<UserSettings>(() => {
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
      theme: (localStorage.getItem('vadivelu_theme') as any) || 'system',
      audioRetentionDays: 7,
    };
  });

  // Conversations & Messages
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => getInitialConversationId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Sync conversation selection with browser Back / Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlId = getInitialConversationId();
      setActiveConversationId(urlId);
      if (!urlId) {
        setMessages([]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      const urlId = getInitialConversationId();
      // Only set active if URL specifically asked for that conversation
      if (urlId && data && data.some(c => c.id === urlId)) {
        setActiveConversationId(urlId);
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
        if (typeof window !== 'undefined') {
          window.history.pushState(null, '', `/c/${newConv.id}`);
        }
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
    setIsSendingMessage(true);

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
      showToast('Gemini API Error: Check settings', 'error');
      // Display the true server error message instead of fake content
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        conversationId: currentConvId,
        role: 'assistant',
        content: `⚠️ **Gemini API Error**: ${e.message || 'Failed to generate response. Please verify your Gemini API key in Settings.'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSendingMessage(false);
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

  // Start In-Chat Voice Widget by default (matching Images 1 & 2)
  const handleStartInChatVoice = useCallback(() => {
    setIsVoiceMode(false);
    setIsMiniVoiceOpen(true);
    speechRecognition.startListening();
  }, [speechRecognition]);

  // Expand to Fullscreen Advanced Voice Mode (matching Image 3)
  const handleExpandFullscreenVoice = useCallback(() => {
    setIsVoiceMode(true);
    setIsMiniVoiceOpen(false);
  }, []);

  // Minimize Fullscreen Voice Mode back to In-Chat circular widget
  const handleMinimizeVoiceMode = useCallback(() => {
    setIsVoiceMode(false);
    setIsMiniVoiceOpen(true);
  }, []);

  // Close Live Voice Session completely
  const handleCloseLiveVoice = useCallback(() => {
    setIsVoiceMode(false);
    setIsMiniVoiceOpen(false);
    speechRecognition.stopListening();
    if (audioPerformance.isPlaying) {
      audioPerformance.interrupt();
    }
  }, [speechRecognition, audioPerformance]);

  // Select conversation and sync browser URL to /c/:id
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    if (typeof window !== 'undefined') {
      if (id) {
        window.history.pushState(null, '', `/c/${id}`);
      } else {
        window.history.pushState(null, '', '/');
      }
    }
  }, []);

  // New Chat handler: clean empty home screen with root URL / (like ChatGPT)
  const handleNewChat = useCallback(() => {
    setActiveConversationId('');
    setMessages([]);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  }, []);

  // Delete conversation
  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(prev => {
        const remaining = prev.filter(c => c.id !== id);
        return remaining;
      });
      if (activeConversationId === id) {
        setActiveConversationId('');
        setMessages([]);
        if (typeof window !== 'undefined') {
          window.history.pushState(null, '', '/');
        }
      }
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

  // Theme toggle and selector
  const handleSelectTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    setThemeChoice(newTheme);
    setSettings(prev => ({ ...prev, theme: newTheme }));
    api.saveSettings({ theme: newTheme }).catch(() => {});
  }, []);

  const handleToggleTheme = useCallback(() => {
    const cycleMap: Record<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'> = {
      system: isDark ? 'light' : 'dark',
      light: 'dark',
      dark: 'light',
    };
    handleSelectTheme(cycleMap[themeChoice]);
  }, [themeChoice, isDark, handleSelectTheme]);

  return (
    <div className={`w-screen h-screen overflow-hidden ${isDark ? 'dark bg-black text-white' : 'bg-white text-black'} transition-colors duration-150`}>
      {/* Immersive Fullscreen Advanced Voice Mode View (Strictly matching Image 3) */}
      {isVoiceMode ? (
        <VoiceModeView
          onClose={handleCloseLiveVoice}
          onMinimize={handleMinimizeVoiceMode}
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
          onPlayMessageAudio={handlePlayMessageAudio}
          onSendMessage={handleSendMessage}
          isSendingMessage={isSendingMessage}
          isTranscribing={speechRecognition.isTranscribing}
        />
      ) : (
        /* Main Chat View (macOS style window frame) */
        <MainChatView
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onOpenVoiceMode={handleStartInChatVoice}
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
          themeChoice={themeChoice}
          onToggleTheme={handleToggleTheme}
          isSendingMessage={isSendingMessage}
          playbackStatus={audioPerformance.status}
          activeMeme={audioPerformance.activeMeme}
          onInterruptAudio={() => {
            audioPerformance.interrupt();
            setPlayingMessageId(null);
          }}
          onShowToast={showToast}
          isDarkTheme={isDark}
          isVoiceWidgetOpen={isMiniVoiceOpen}
          onCloseVoiceWidget={handleCloseLiveVoice}
          onExpandVoiceFullscreen={handleExpandFullscreenVoice}
          onToggleVoiceListening={() => {
            if (speechRecognition.isListening) speechRecognition.stopListening();
            else speechRecognition.startListening();
          }}
          voiceTranscript={speechRecognition.transcript}
          voiceInterimTranscript={speechRecognition.interimTranscript}
          isTranscribing={speechRecognition.isTranscribing}
        />
      )}

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={id => {
          handleSelectConversation(id);
          setIsCommandPaletteOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setIsCommandPaletteOpen(false);
        }}
        onToggleVoiceMode={handleStartInChatVoice}
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
        themeChoice={themeChoice}
        onSelectTheme={handleSelectTheme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Floating Apple-aesthetic Monochrome Toast Notifications */}
      <ToastNotification
        toasts={toasts}
        onDismiss={dismissToast}
        isDarkTheme={isDark}
      />
    </div>
  );
};

export default App;

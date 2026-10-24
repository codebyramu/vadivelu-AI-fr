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

export const App: React.FC = () => {
  // App views & Modals
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMemeLibraryOpen, setIsMemeLibraryOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Settings & Theme
  const [settings, setSettings] = useState<UserSettings>({
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
  });

  const isDark = settings.theme === 'dark';

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Conversations & Messages
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('c-1');
  const [messages, setMessages] = useState<Message[]>([]);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  // Audio Performance Controller
  const audioPerformance = useAudioPerformance({
    defaultSpeechVolume: settings.volume,
    defaultMemeVolume: settings.memeVolume,
    onFinished: () => {
      setPlayingMessageId(null);
    },
  });

  // Load initial settings and conversations
  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
    api.getConversations().then(data => {
      setConversations(data);
      if (data.length > 0) {
        setActiveConversationId(data[0].id);
      }
    }).catch(() => {});
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;
    api.getConversation(activeConversationId).then(res => {
      setMessages(res.messages);
    }).catch(() => {});
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
      // Synthesize ad-hoc plan
      const plan: PerformancePlan = {
        voice: message.voice || settings.voiceGender,
        segments: [
          {
            type: 'speech',
            text: message.content.replace(/\[meme:\s*[^\]]+\]/gi, ''),
          },
        ],
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

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `u-${Date.now()}`,
      conversationId: activeConversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const activeConv = conversations.find(c => c.id === activeConversationId);
      const res = await api.sendMessage({
        conversationId: activeConversationId,
        content,
        voiceOverride: settings.voiceGender,
        personalityOverride: activeConv?.personality || settings.defaultPersonality,
      });

      // Update messages with actual server assistant reply
      setMessages(prev => [...prev, res.assistantMessage]);

      // If in Voice Mode, automatically play performance!
      if (isVoiceMode && res.performance) {
        setPlayingMessageId(res.assistantMessage.id);
        audioPerformance.playPerformance(res.performance);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  }, [activeConversationId, conversations, settings, isVoiceMode, audioPerformance]);

  // Speech Recognition Hook
  const speechRecognition = useSpeechRecognition({
    mode: isVoiceMode ? settings.voiceMode : 'push_to_talk',
    onSpeechStart: () => {
      // User started talking, interrupt assistant playback immediately
      if (audioPerformance.isPlaying) {
        audioPerformance.interrupt();
        setPlayingMessageId(null);
      }
    },
    onFinalTranscript: (text) => {
      if (text.trim()) {
        handleSendMessage(text);
      }
    },
  });

  // Conversation Management Handlers
  const handleNewChat = useCallback(async () => {
    const newConv = await api.createConversation({
      title: 'New Conversation',
      personality: settings.defaultPersonality,
    });
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setMessages([]);
  }, [settings.defaultPersonality]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    await api.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
  }, [activeConversationId, conversations, handleNewChat]);

  const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
    await api.updateConversation(id, { title: newTitle });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  }, []);

  const handleSaveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const updated = await api.saveSettings(updates);
    setSettings(updated);
    if (updates.volume !== undefined) {
      audioPerformance.setSpeechVolume(updates.volume);
    }
    if (updates.memeVolume !== undefined) {
      audioPerformance.setMemeVolume(updates.memeVolume);
    }
  }, [audioPerformance]);

  const handleToggleTheme = useCallback(() => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    handleSaveSettings({ theme: nextTheme });
  }, [settings.theme, handleSaveSettings]);

  const handleToggleMemes = useCallback(() => {
    handleSaveSettings({ memesEnabled: !settings.memesEnabled });
  }, [settings.memesEnabled, handleSaveSettings]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVoiceMode(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsMemeLibraryOpen(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNewChat]);

  const activeConv = conversations.find(c => c.id === activeConversationId) || conversations[0];

  return (
    <div className="w-full h-screen overflow-hidden bg-gray-900 select-none">
      {isVoiceMode ? (
        <VoiceModeView
          onClose={() => {
            setIsVoiceMode(false);
            speechRecognition.stopListening();
          }}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          isListening={speechRecognition.isListening}
          onToggleListening={() => {
            if (speechRecognition.isListening) {
              speechRecognition.stopListening();
            } else {
              speechRecognition.startListening();
            }
          }}
          onInterrupt={() => {
            audioPerformance.interrupt();
            setPlayingMessageId(null);
          }}
          playbackStatus={audioPerformance.status}
          activeMeme={audioPerformance.activeMeme}
          analyserNode={speechRecognition.isListening ? speechRecognition.micAnalyser : audioPerformance.analyserNode}
          messages={messages}
          transcript={speechRecognition.transcript}
          interimTranscript={speechRecognition.interimTranscript}
        />
      ) : (
        <MainChatView
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onOpenVoiceMode={() => {
            setIsVoiceMode(true);
            // In continuous mode, start listening immediately
            if (settings.voiceMode === 'continuous') {
              speechRecognition.startListening();
            }
          }}
          onPlayMessageAudio={handlePlayMessageAudio}
          isAudioPlaying={audioPerformance.isPlaying}
          playingMessageId={playingMessageId}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenMemories={() => setIsMemoryModalOpen(true)}
          onOpenMemes={() => setIsMemeLibraryOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          personality={activeConv?.personality || settings.defaultPersonality}
          onStartPushToTalk={speechRecognition.startListening}
          onStopPushToTalk={speechRecognition.handlePushToTalkEnd}
          isListening={speechRecognition.isListening}
        />
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={id => setActiveConversationId(id)}
        onNewChat={handleNewChat}
        onToggleVoiceMode={() => setIsVoiceMode(v => !v)}
        onOpenMemes={() => setIsMemeLibraryOpen(true)}
        onOpenMemories={() => setIsMemoryModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onToggleTheme={handleToggleTheme}
        isDarkTheme={isDark}
        memesEnabled={settings.memesEnabled}
        onToggleMemes={handleToggleMemes}
      />

      {/* Modals */}
      <MemeLibraryModal
        isOpen={isMemeLibraryOpen}
        onClose={() => setIsMemeLibraryOpen(false)}
      />

      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        isDarkTheme={isDark}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
};
export default App;

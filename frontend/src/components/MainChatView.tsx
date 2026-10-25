import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  Sparkles,
  Info,
  Mic,
  Paperclip,
  ArrowUp,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Trash2,
  Check,
  Edit2,
  Play,
  Share2,
  Sun,
  Moon,
  Monitor,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Brain,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Conversation, Message, PersonalityPreset, ThoughtProcess } from '../types';
import { PlaybackStatus, ActiveMemeInfo } from '../hooks/useAudioPerformance';
import { ToastType } from './ToastNotification';
import { ThinkingDrawer } from './ThinkingDrawer';
import { MiniVoiceWidget } from './MiniVoiceWidget';

interface MainChatViewProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onOpenVoiceMode: () => void;
  onPlayMessageAudio: (message: Message) => void;
  isAudioPlaying: boolean;
  playingMessageId: string | null;
  onOpenSettings: () => void;
  onOpenMemories: () => void;
  onOpenMemes: () => void;
  onOpenCommandPalette: () => void;
  personality: PersonalityPreset;
  onStartPushToTalk: () => void;
  onStopPushToTalk: () => void;
  isListening: boolean;
  themeChoice?: 'light' | 'dark' | 'system';
  onToggleTheme?: () => void;
  isSendingMessage?: boolean;
  playbackStatus?: PlaybackStatus;
  activeMeme?: ActiveMemeInfo | null;
  onInterruptAudio?: () => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  isDarkTheme?: boolean;
  isVoiceWidgetOpen?: boolean;
  onCloseVoiceWidget?: () => void;
  onExpandVoiceFullscreen?: () => void;
  onToggleVoiceListening?: () => void;
  voiceTranscript?: string;
  voiceInterimTranscript?: string;
}

export const MainChatView: React.FC<MainChatViewProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  messages,
  onSendMessage,
  onOpenVoiceMode,
  onPlayMessageAudio,
  isAudioPlaying,
  playingMessageId,
  onOpenSettings,
  onOpenMemories,
  onOpenMemes,
  onOpenCommandPalette,
  onStartPushToTalk,
  onStopPushToTalk,
  isListening,
  themeChoice = 'system',
  onToggleTheme,
  isSendingMessage = false,
  playbackStatus = 'idle',
  activeMeme = null,
  onInterruptAudio,
  onShowToast,
  isDarkTheme = false,
  isVoiceWidgetOpen = false,
  onCloseVoiceWidget,
  onExpandVoiceFullscreen,
  onToggleVoiceListening,
  voiceTranscript = '',
  voiceInterimTranscript = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'up' | 'down'>>({});
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Thinking Drawer State (ChatGPT / Meta AI style right-side panel)
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [activeThoughtProcess, setActiveThoughtProcess] = useState<ThoughtProcess | null>(null);
  const [expandedInlineThoughtId, setExpandedInlineThoughtId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSendingMessage]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isSendingMessage) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast?.('Copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setFeedbackState(prev => ({
      ...prev,
      [id]: prev[id] === type ? undefined! : type,
    }));
    onShowToast?.(type === 'up' ? 'Feedback recorded: Helpful' : 'Feedback recorded: Not helpful', 'info');
  };

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
      onShowToast?.('Conversation renamed', 'success');
    }
    setEditingConvId(null);
  };

  // Toggle Thinking Drawer & Inline Thought (ChatGPT / Meta AI style)
  const handleToggleThinking = (msgId?: string, thought?: ThoughtProcess | null) => {
    if (msgId) {
      if (expandedInlineThoughtId === msgId && isThinkingOpen) {
        setExpandedInlineThoughtId(null);
        setIsThinkingOpen(false);
      } else {
        setExpandedInlineThoughtId(msgId);
        setActiveThoughtProcess(thought || null);
        setIsThinkingOpen(true);
      }
    } else {
      setIsThinkingOpen(prev => !prev);
      setActiveThoughtProcess(thought || null);
    }
  };

  // Render message text with styled inline meme badges [meme: ...]
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\[meme:\s*[^\]]+\])/gi);
    return parts.map((part, index) => {
      const match = part.match(/\[meme:\s*([^\]]+)\]/i);
      if (match) {
        const memeTitle = match[1].trim();
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 mx-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-300 dark:border-neutral-700 align-middle shadow-xs"
          >
            <span className="text-[11px]">🎭</span>
            <span>[meme: {memeTitle}]</span>
          </span>
        );
      }

      // Format text content
      return (
        <span key={index} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-white dark:bg-black text-black dark:text-white select-none overflow-hidden font-sans transition-colors duration-150">
      {/* Desktop App Window Title Bar */}
      <div className="h-10 bg-white dark:bg-black border-b border-neutral-200 dark:border-neutral-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="p-1 rounded-md text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition active:scale-95"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeft className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="w-5 h-5 rounded-md bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-black dark:text-white tracking-tight">
            Vadivelu AI
          </span>
        </div>

        <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-sm">
          {activeConversation?.title || 'New Chat'}
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleTheme && (
            <button
              onClick={() => {
                onToggleTheme();
                onShowToast?.(`Theme changed to ${themeChoice === 'dark' ? 'light' : 'dark'}`, 'sparkle');
              }}
              className="p-1 rounded-md text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition active:scale-90"
              title={`Theme: ${themeChoice} (Click to toggle)`}
            >
              {themeChoice === 'dark' ? (
                <Moon className="w-3.5 h-3.5" />
              ) : themeChoice === 'light' ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Monitor className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="p-1 rounded-md text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition active:scale-90"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onOpenCommandPalette}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white border border-neutral-200 dark:border-neutral-800 transition active:scale-95"
            title="Command Palette (Ctrl+K)"
          >
            ⌘K
          </button>
        </div>
      </div>

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <div
          className={`bg-[#fafafa] dark:bg-black border-r border-neutral-200 dark:border-neutral-800 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0 pointer-events-none'
          }`}
        >
          <div className="p-4 flex flex-col min-h-0 flex-1 w-72">
            {/* + New Chat Pill Button */}
            <button
              onClick={() => {
                onNewChat();
                onShowToast?.('New chat started', 'sparkle');
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black active:scale-[0.98] rounded-full text-sm font-semibold shadow-sm transition"
            >
              <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center font-bold text-xs leading-none">
                +
              </div>
              <span>New Chat</span>
            </button>

            {/* Recents Header */}
            <div className="mt-6 mb-2 px-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Recents
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {conversations.map(conv => {
                const isSelected = conv.id === activeConversationId;
                const isEditing = editingConvId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`group relative flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm transition cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-200/80 dark:bg-neutral-900 text-black dark:text-white font-medium border border-neutral-300 dark:border-neutral-800'
                        : 'text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/60 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {isEditing ? (
                      <form
                        onSubmit={e => handleSaveRename(conv.id, e)}
                        className="flex-1 flex items-center gap-1.5"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="flex-1 px-2 py-0.5 text-xs rounded bg-white dark:bg-black border border-black dark:border-white text-black dark:text-white outline-none"
                          autoFocus
                          onBlur={() => handleSaveRename(conv.id)}
                        />
                        <button type="submit" className="text-black dark:text-white">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isSelected && (
                            <MessageSquare className="w-4 h-4 text-black dark:text-white shrink-0" />
                          )}
                          <span className="truncate text-[13.5px]">{conv.title}</span>
                        </div>

                        {/* Hover options */}
                        <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                          <button
                            onClick={e => handleStartRename(conv, e)}
                            className="p-1 rounded text-neutral-400 hover:text-black dark:hover:text-white transition active:scale-90"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {conversations.length > 0 && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onDeleteConversation(conv.id);
                                onShowToast?.('Conversation deleted', 'info');
                              }}
                              className="p-1 rounded text-neutral-400 hover:text-black dark:hover:text-white transition active:scale-90"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Profile Footer */}
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 relative bg-[#fafafa] dark:bg-black w-72">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center justify-between p-2 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center text-xs font-semibold shrink-0 border border-neutral-300 dark:border-neutral-700">
                  VD
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-black dark:text-white truncate">
                    Vadivelu AI
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    Supabase + Gemini 3.5
                  </span>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-neutral-400 shrink-0" />
            </div>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl py-2 z-30 text-xs animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => { setShowUserMenu(false); onOpenSettings(); }}
                  className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white"
                >
                  Settings & Gemini Status
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); onOpenMemories(); }}
                  className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white"
                >
                  Memory Management
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); onOpenMemes(); }}
                  className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white"
                >
                  Supabase Dialogue Catalog
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-black min-w-0 transition-colors duration-150 relative">
          {/* Main Chat Header */}
          <div className="h-14 px-8 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-white dark:bg-black">
            {/* Title */}
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-lg font-semibold text-black dark:text-white truncate">
                {activeConversation?.title || 'New Chat'}
              </h1>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Audio Playing Stop Indicator in Header */}
              {isAudioPlaying && onInterruptAudio && (
                <button
                  onClick={onInterruptAudio}
                  className="flex items-center gap-1.5 text-xs font-semibold text-black dark:text-white bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 transition active:scale-95 shadow-2xs"
                  title="Stop audio playback"
                >
                  <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                  <span>Stop audio</span>
                </button>
              )}

              {/* Voice Ready Badge */}
              <div className="flex items-center gap-1.5 text-xs font-medium text-black dark:text-white bg-neutral-100 dark:bg-neutral-900 px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-800 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse" />
                <span>Voice ready</span>
              </div>

              {/* Info Icon */}
              <button
                onClick={() => setShowInfoModal(!showInfoModal)}
                className="p-2 rounded-xl text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition active:scale-95"
                title="Conversation info"
              >
                <Info className="w-5 h-5" />
              </button>

              {/* Voice Mode Mic Trigger */}
              <button
                onClick={() => {
                  onOpenVoiceMode();
                  onShowToast?.('Entering Live Voice Mode', 'audio');
                }}
                className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-black dark:hover:text-white transition active:scale-95"
                title="Open Live Voice Mode"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Info Modal Dropdown */}
          {showInfoModal && (
            <div className="mx-8 mt-2 p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs space-y-1.5 animate-in fade-in slide-in-from-top-1">
              <div className="font-semibold text-black dark:text-white">Session Information</div>
              <p className="text-neutral-500 dark:text-neutral-400">
                Persona: <span className="font-medium capitalize">{activeConversation?.personality || 'funny_friend'}</span> • Messages: {messages.length} • Powered by Gemini 3.5 Flash + Supabase Dialogues
              </p>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-8 pt-6 pb-36 space-y-6 bg-white dark:bg-black">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-20 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-black dark:text-white tracking-tight">
                  Vadivelu AI Voice Companion
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Ask any question, explore ideas, or speak naturally. Authentic Vadivelu comedic punchlines from your Supabase catalog will play seamlessly in real-time!
                </p>
                <button
                  onClick={() => {
                    onOpenVoiceMode();
                    onShowToast?.('Voice Mode initiated', 'audio');
                  }}
                  className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black rounded-full text-xs font-semibold shadow-sm flex items-center gap-2 active:scale-95 transition"
                >
                  <Mic className="w-4 h-4" />
                  <span>Launch Voice Mode</span>
                </button>
              </div>
            ) : (
              messages.map(msg => {
                const isUser = msg.role === 'user';
                const isPlayingThis = playingMessageId === msg.id && isAudioPlaying;

                if (isUser) {
                  return (
                    <div key={msg.id} className="flex justify-end animate-message-entry">
                      <div className="max-w-[75%] bg-black text-white dark:bg-white dark:text-black rounded-3xl rounded-br-lg px-5 py-3 text-[14.5px] leading-relaxed shadow-xs font-normal">
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  );
                }

                // Assistant Message Bubble
                const thought = msg.performance?.thoughtProcess;

                return (
                  <div key={msg.id} className="flex items-start gap-3.5 max-w-[85%] group animate-message-entry">
                    {/* Assistant Sparkle Icon Avatar */}
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex flex-col gap-2 min-w-0">
                      {/* ChatGPT / Meta AI Style Thought Button */}
                      {(thought || msg.performance?.reasoning) && (
                        <div className="flex flex-col gap-1.5 w-fit max-w-full">
                          <button
                            type="button"
                            onClick={() => handleToggleThinking(msg.id, thought || null)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors w-fit border ${
                              isThinkingOpen && activeThoughtProcess === thought
                                ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-xs'
                                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800'
                            }`}
                            title="Click to view thinking in right panel"
                          >
                            <Brain className="w-3.5 h-3.5" />
                            <span>
                              {thought?.toolsCalled?.some(t => t.tool === 'select_meme_reaction')
                                ? `Thought • Vadivelu reaction (${thought.toolsCalled.length} tools)`
                                : `Thought for ${thought?.durationMs ? (thought.durationMs / 1000).toFixed(1) : '1.8'}s`}
                            </span>
                            <ChevronDown
                              className={`w-3 h-3 transition-transform duration-200 ${
                                (isThinkingOpen && activeThoughtProcess === thought) || expandedInlineThoughtId === msg.id
                                  ? 'rotate-180'
                                  : ''
                              }`}
                            />
                          </button>

                          {/* ChatGPT style clean inline collapsible thought text */}
                          {expandedInlineThoughtId === msg.id && (
                            <div className="pl-3.5 py-1 border-l-2 border-neutral-300 dark:border-neutral-700 text-[12px] text-neutral-500 dark:text-neutral-400 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                              <p className="italic leading-relaxed text-neutral-700 dark:text-neutral-300">
                                {thought?.reasoning || 'Evaluated conversation context and formulated optimal response.'}
                              </p>
                              <div className="flex items-center gap-2 text-[10.5px] text-neutral-400 pt-0.5">
                                <span>{thought?.toolsCalled?.length ? `${thought.toolsCalled.length} tool calls` : 'Conversational response'}</span>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveThoughtProcess(thought || null);
                                    setIsThinkingOpen(true);
                                  }}
                                  className="text-black dark:text-white font-medium hover:underline inline-flex items-center gap-1"
                                >
                                  Open right panel <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div className="bg-neutral-100 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-black dark:text-white rounded-3xl rounded-tl-lg px-6 py-4 text-[14.5px] leading-relaxed shadow-xs">
                        {renderMessageContent(msg.content)}
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center gap-3 px-2 text-neutral-400 dark:text-neutral-500 text-xs">
                        {/* Thumbs up */}
                        <button
                          onClick={() => handleFeedback(msg.id, 'up')}
                          className={`p-1 rounded-md transition active:scale-90 ${
                            feedbackState[msg.id] === 'up'
                              ? 'text-black dark:text-white bg-neutral-200 dark:bg-neutral-800'
                              : 'hover:text-black dark:hover:text-white'
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Thumbs down */}
                        <button
                          onClick={() => handleFeedback(msg.id, 'down')}
                          className={`p-1 rounded-md transition active:scale-90 ${
                            feedbackState[msg.id] === 'down'
                              ? 'text-black dark:text-white bg-neutral-200 dark:bg-neutral-800'
                              : 'hover:text-black dark:hover:text-white'
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Copy */}
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="p-1 rounded-md hover:text-black dark:hover:text-white transition active:scale-90"
                          title="Copy to clipboard"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-black dark:text-white" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Read Aloud Button */}
                        <button
                          onClick={() => onPlayMessageAudio(msg)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition active:scale-95 ${
                            isPlayingThis
                              ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                              : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                          }`}
                          title="Perform speech & meme audio"
                        >
                          {isPlayingThis ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Read aloud</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Thinking / Shimmer Skeleton Loader */}
            {isSendingMessage && (
              <div className="flex items-start gap-3.5 max-w-[85%] animate-message-entry">
                <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0 shadow-xs mt-1 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div className="flex flex-col gap-2 min-w-[280px]">
                  <div className="bg-neutral-100 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl rounded-tl-lg px-6 py-4 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-ping" />
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 tracking-tight">
                          Thinking…
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleThinking(undefined, null)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-black dark:text-white transition active:scale-95"
                        title="Click to view live thinking & tools in right panel"
                      >
                        <Brain className="w-3 h-3" />
                        <span>{isThinkingOpen ? 'Hide thoughts' : 'View thoughts'}</span>
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-4/5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden relative">
                        <div className="absolute inset-0 animate-shimmer" />
                      </div>
                      <div className="h-3 w-3/5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden relative">
                        <div className="absolute inset-0 animate-shimmer" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Clean Input Area (Image 1 style) */}
          <div className="px-8 pb-3 pt-1 shrink-0 bg-white dark:bg-black">
            <form
              onSubmit={handleSubmit}
              className="relative max-w-4xl mx-auto bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded-full px-4 py-2.5 flex items-center gap-3 shadow-xs focus-within:border-black dark:focus-within:border-white transition-all"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={isSendingMessage ? 'Waiting for Vadivelu...' : 'Ask anything or click mic to speak...'}
                disabled={isSendingMessage}
                className="flex-1 bg-transparent border-none outline-none text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 px-2 disabled:opacity-50"
              />

              {/* Attachment Paperclip */}
              <button
                type="button"
                onClick={onOpenMemes}
                className="p-2 text-neutral-400 hover:text-black dark:hover:text-white transition-all duration-200 hover:rotate-12 active:scale-90"
                title="Attach meme sound"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Mic Button */}
              <button
                type="button"
                onClick={onOpenVoiceMode}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm ${
                  isListening
                    ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black animate-pulse ring-4 ring-neutral-400'
                    : 'bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black active:scale-95'
                }`}
                title="Start Live Voice Chat"
              >
                <Mic className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || isSendingMessage}
                className={`group relative p-2 rounded-full transition-all duration-200 active:scale-90 ${
                  inputText.trim() && !isSendingMessage
                    ? 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90 shadow-sm'
                    : 'text-neutral-300 dark:text-neutral-700 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5] transition-transform duration-200 group-hover:-translate-y-0.5" />
              </button>
            </form>

            {/* Disclaimer footer */}
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center mt-2 font-normal">
              AI Voice Chat can make mistakes. Consider checking important info.
            </div>
          </div>

          {/* Default In-Chat Voice Orb Widget (Images 1 & 2) — Perfectly aligned within chat area */}
          {isVoiceWidgetOpen && (
            <MiniVoiceWidget
              isOpen={isVoiceWidgetOpen}
              onClose={onCloseVoiceWidget || (() => {})}
              onExpandFullscreen={onExpandVoiceFullscreen}
              isListening={isListening}
              onToggleListening={onToggleVoiceListening || onStartPushToTalk}
              onInterrupt={onInterruptAudio || (() => {})}
              playbackStatus={playbackStatus}
              activeMeme={activeMeme}
              transcript={voiceTranscript}
              interimTranscript={voiceInterimTranscript}
              isDarkTheme={isDarkTheme}
            />
          )}
        </div>

        {/* Right Docked Thinking Process Drawer (ChatGPT / Meta AI style) */}
        {isThinkingOpen && (
          <ThinkingDrawer
            isOpen={isThinkingOpen}
            onClose={() => setIsThinkingOpen(false)}
            thoughtProcess={activeThoughtProcess || (messages.length > 0 ? messages[messages.length - 1]?.performance?.thoughtProcess : null)}
            isSendingMessage={isSendingMessage}
            activePrompt={inputText}
            isDarkTheme={isDarkTheme}
          />
        )}
      </div>
    </div>
  );
};

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
} from 'lucide-react';
import { Conversation, Message, PersonalityPreset } from '../types';

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
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'up' | 'down'>>({});
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setFeedbackState(prev => ({
      ...prev,
      [id]: prev[id] === type ? undefined! : type,
    }));
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
    }
    setEditingConvId(null);
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
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 mx-1 rounded-full text-xs font-semibold bg-blue-100/80 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 align-middle shadow-xs"
          >
            <span className="text-[11px]">🎭</span>
            <span>[meme: {memeTitle}]</span>
          </span>
        );
      }

      // Format bullet points and line breaks
      return (
        <span key={index} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-100 dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 select-none overflow-hidden font-sans">
      {/* macOS Window Title Bar */}
      <div className="h-10 bg-[#e8e9ec] dark:bg-[#161b22] border-b border-gray-300 dark:border-gray-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] cursor-pointer" />
        </div>
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300 tracking-tight">
          AI Voice Chat
        </div>
        <div className="w-12 text-right">
          <button
            onClick={onOpenCommandPalette}
            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Command Palette (Ctrl+K)"
          >
            ⌘K
          </button>
        </div>
      </div>

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (matching screenshot 0) */}
        <div className="w-72 bg-[#f4f5f7] dark:bg-[#12161f] border-r border-gray-200 dark:border-gray-800 flex flex-col justify-between shrink-0">
          <div className="p-4 flex flex-col min-h-0 flex-1">
            {/* + New Chat Pill Button */}
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] active:scale-[0.98] text-white rounded-full text-sm font-medium shadow-sm transition"
            >
              <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center font-bold text-xs leading-none">
                +
              </div>
              <span>New Chat</span>
            </button>

            {/* Recents Header */}
            <div className="mt-6 mb-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
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
                        ? 'bg-[#dbeafe]/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800/60'
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
                          className="flex-1 px-2 py-0.5 text-xs rounded bg-white dark:bg-gray-800 border border-blue-500 outline-none"
                          autoFocus
                          onBlur={() => handleSaveRename(conv.id)}
                        />
                        <button type="submit" className="text-blue-600">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {isSelected && (
                            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          )}
                          <span className="truncate text-[13.5px]">{conv.title}</span>
                        </div>

                        {/* Hover options */}
                        <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                          <button
                            onClick={e => handleStartRename(conv, e)}
                            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {conversations.length > 1 && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onDeleteConversation(conv.id);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-red-500"
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

          {/* User Profile Footer (matching screenshot 0: JD jdoe@example.com ...) */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 relative">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-200/50 dark:hover:bg-gray-800/50 cursor-pointer transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#7d8590] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  JD
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  jdoe@example.com
                </span>
              </div>
              <MoreHorizontal className="w-4 h-4 text-gray-500 shrink-0" />
            </div>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-[#1c222e] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl py-2 z-30 text-xs">
                <button
                  onClick={() => { setShowUserMenu(false); onOpenSettings(); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  Settings & Gemini Status
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); onOpenMemories(); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  Memory Management
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); onOpenMemes(); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  Meme Library Catalog
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0d1117] min-w-0">
          {/* Main Chat Header */}
          <div className="h-16 px-8 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between shrink-0">
            {/* Title */}
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {activeConversation?.title || 'Vadivelu AI'}
              </h1>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Voice Ready Badge */}
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Voice ready</span>
              </div>

              {/* Info Icon */}
              <button
                onClick={() => setShowInfoModal(!showInfoModal)}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                title="Conversation info"
              >
                <Info className="w-5 h-5" />
              </button>

              {/* Voice Mode Mic Trigger */}
              <button
                onClick={onOpenVoiceMode}
                className="p-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition"
                title="Open Immersive Voice Mode"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Info Modal Dropdown */}
          {showInfoModal && (
            <div className="mx-8 mt-2 p-4 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-2xl text-xs space-y-1.5 animate-in fade-in">
              <div className="font-semibold text-gray-700 dark:text-gray-200">Session Information</div>
              <p className="text-gray-500 dark:text-gray-400">
                Persona: <span className="font-medium capitalize">{activeConversation?.personality || 'funny_friend'}</span> • Messages: {messages.length} • Powered by Gemini Flash + Vadivelu Reaction Director
              </p>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-20 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Vadivelu AI Voice Companion
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Ask any question, explore ideas, or speak naturally. Iconic Vadivelu comedic punchlines will play at the perfect comedic moments!
                </p>
                <button
                  onClick={onOpenVoiceMode}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-md flex items-center gap-2"
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
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[75%] bg-[#1a73e8] text-white rounded-3xl rounded-br-lg px-5 py-3 text-[14.5px] leading-relaxed shadow-sm font-normal">
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  );
                }

                // Assistant Message Bubble
                return (
                  <div key={msg.id} className="flex items-start gap-3.5 max-w-[85%] group">
                    {/* Assistant Sparkle Icon Avatar */}
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#6366f1] to-[#8b5cf6] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col gap-2 min-w-0">
                      {/* Message Bubble */}
                      <div className="bg-[#f2f4f7] dark:bg-[#1a202c] text-gray-900 dark:text-gray-100 rounded-3xl rounded-tl-lg px-6 py-4 text-[14.5px] leading-relaxed shadow-xs">
                        {renderMessageContent(msg.content)}
                      </div>

                      {/* Action Bar (Thumbs Up, Down, Copy, Read aloud) */}
                      <div className="flex items-center gap-3 px-2 text-gray-500 dark:text-gray-400 text-xs">
                        {/* Thumbs up */}
                        <button
                          onClick={() => handleFeedback(msg.id, 'up')}
                          className={`p-1 rounded-md transition ${
                            feedbackState[msg.id] === 'up'
                              ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/40'
                              : 'hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Thumbs down */}
                        <button
                          onClick={() => handleFeedback(msg.id, 'down')}
                          className={`p-1 rounded-md transition ${
                            feedbackState[msg.id] === 'down'
                              ? 'text-red-600 bg-red-50 dark:bg-red-950/40'
                              : 'hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Copy */}
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="p-1 rounded-md hover:text-gray-800 dark:hover:text-gray-200 transition"
                          title="Copy to clipboard"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Read Aloud Button */}
                        <button
                          onClick={() => onPlayMessageAudio(msg)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                            isPlayingThis
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'hover:bg-gray-200/60 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
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
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Input Area Pill (matching screenshot 0) */}
          <div className="px-8 pb-3 pt-1 shrink-0">
            <form
              onSubmit={handleSubmit}
              className="relative max-w-4xl mx-auto bg-[#f4f5f7] dark:bg-[#161c26] border border-gray-200 dark:border-gray-800 rounded-full px-4 py-2.5 flex items-center gap-3 shadow-xs focus-within:border-blue-500 dark:focus-within:border-blue-500 transition"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Ask anything or hold mic to speak..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-2"
              />

              {/* Attachment Paperclip */}
              <button
                type="button"
                onClick={onOpenMemes}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                title="Attach meme sound"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Blue Circular Mic Button (supports push-to-talk & voice mode) */}
              <button
                type="button"
                onMouseDown={onStartPushToTalk}
                onMouseUp={onStopPushToTalk}
                onTouchStart={onStartPushToTalk}
                onTouchEnd={onStopPushToTalk}
                onClick={() => {
                  if (!isListening) onOpenVoiceMode();
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-300'
                    : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white active:scale-95'
                }`}
                title="Hold to speak (Push to talk) or click for Voice Mode"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2 rounded-full transition ${
                  inputText.trim()
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </form>

            {/* Disclaimer footer */}
            <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-2 font-normal">
              AI Voice Chat can make mistakes. Consider checking important info.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

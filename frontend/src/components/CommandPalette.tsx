import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Mic, Volume2, Sparkles, Database, Settings, Moon, Sun, X, MessageSquare } from 'lucide-react';
import { Conversation } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onToggleVoiceMode: () => void;
  onOpenMemes: () => void;
  onOpenMemories: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  isDarkTheme: boolean;
  memesEnabled: boolean;
  onToggleMemes: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
  onNewChat,
  onToggleVoiceMode,
  onOpenMemes,
  onOpenMemories,
  onOpenSettings,
  onToggleTheme,
  isDarkTheme,
  memesEnabled,
  onToggleMemes,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden text-black dark:text-white flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 gap-3 bg-white dark:bg-black">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search conversations..."
            className="w-full bg-transparent border-none outline-none text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action list */}
        <div className="overflow-y-auto p-2 space-y-1 bg-white dark:bg-black">
          {/* Quick Actions */}
          <div className="px-2 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Quick Actions
          </div>

          <button
            onClick={() => { onNewChat(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <span>New Chat</span>
            <span className="ml-auto text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 rounded">⌘N</span>
          </button>

          <button
            onClick={() => { onToggleVoiceMode(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <span>Immersive Voice Mode</span>
            <span className="ml-auto text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 rounded">⌘V</span>
          </button>

          <button
            onClick={() => { onToggleMemes(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <span>Memes: {memesEnabled ? 'Enabled' : 'Disabled'} (Toggle)</span>
            <span className="ml-auto text-xs text-neutral-400">{memesEnabled ? 'On' : 'Off'}</span>
          </button>

          <button
            onClick={() => { onOpenMemes(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Meme Library Manager</span>
            <span className="ml-auto text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 rounded">⌘M</span>
          </button>

          <button
            onClick={() => { onOpenMemories(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <span>Memory Management</span>
          </button>

          <button
            onClick={() => { onOpenSettings(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <span>Settings</span>
            <span className="ml-auto text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 rounded">⌘,</span>
          </button>

          <button
            onClick={() => { onToggleTheme(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0">
              {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </div>
            <span>Switch Theme ({isDarkTheme ? 'Dark Mode' : 'Light Mode'})</span>
          </button>

          {/* Conversations Section */}
          {filteredConversations.length > 0 && (
            <>
              <div className="px-2 pt-3 pb-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Conversations ({filteredConversations.length})
              </div>
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900 text-black dark:text-white transition text-left group"
                >
                  <MessageSquare className="w-4 h-4 text-neutral-400 group-hover:text-black dark:group-hover:text-white shrink-0" />
                  <span className="truncate flex-1">{conv.title}</span>
                  <span className="text-xs text-neutral-400 shrink-0">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
          <span>Navigation: <kbd className="font-mono bg-white dark:bg-black px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-black dark:text-white">↑</kbd> <kbd className="font-mono bg-white dark:bg-black px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-black dark:text-white">↓</kbd> to select</span>
          <span>Close: <kbd className="font-mono bg-white dark:bg-black px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 text-black dark:text-white">Esc</kbd></span>
        </div>
      </div>
    </div>
  );
};

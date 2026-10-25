import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Search,
  Brain,
  Globe,
  ExternalLink,
  BookOpen,
  CloudSun,
  Calculator,
  Play,
  RotateCw,
  Film,
  ArrowRight,
} from 'lucide-react';
import { ThoughtProcess } from '../types';

interface ThinkingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  thoughtProcess?: ThoughtProcess | null;
  isSendingMessage?: boolean;
  activePrompt?: string;
  isDarkTheme?: boolean;
}

export const ThinkingDrawer: React.FC<ThinkingDrawerProps> = ({
  isOpen,
  onClose,
  thoughtProcess,
  isSendingMessage = false,
  activePrompt = '',
  isDarkTheme = false,
}) => {
  const hasBrowserAction = !!(
    thoughtProcess?.browserUrl ||
    (thoughtProcess?.webResults && thoughtProcess.webResults.length > 0) ||
    thoughtProcess?.fetchedPage ||
    thoughtProcess?.searchQuery
  );

  const [activeTab, setActiveTab] = useState<'thought' | 'browser'>('thought');
  const [customUrl, setCustomUrl] = useState('');
  const [activeBrowserUrl, setActiveBrowserUrl] = useState('');

  // Switch tab and sync browser URL when new thoughtProcess arrives
  useEffect(() => {
    if (hasBrowserAction) {
      setActiveTab('browser');
      const url =
        thoughtProcess?.browserUrl ||
        thoughtProcess?.fetchedPage?.url ||
        (thoughtProcess?.searchQuery
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(thoughtProcess.searchQuery)}`
          : 'https://duckduckgo.com');
      setActiveBrowserUrl(url);
      setCustomUrl(url);
    } else {
      setActiveTab('thought');
    }
  }, [thoughtProcess, hasBrowserAction]);

  if (!isOpen) return null;

  const hasTools = thoughtProcess?.toolsCalled && thoughtProcess.toolsCalled.length > 0;
  const hasWebResults = thoughtProcess?.webResults && thoughtProcess.webResults.length > 0;
  const hasFetchedPage = !!thoughtProcess?.fetchedPage;
  const isYouTube =
    activeBrowserUrl.includes('youtube.com') ||
    (thoughtProcess?.searchQuery && thoughtProcess.searchQuery.toLowerCase().includes('youtube')) ||
    (thoughtProcess?.reasoning && thoughtProcess.reasoning.toLowerCase().includes('youtube'));

  // Extract YouTube search query if applicable
  let ytQuery = thoughtProcess?.searchQuery || '';
  if (!ytQuery && activeBrowserUrl.includes('search_query=')) {
    try {
      const parsed = new URL(activeBrowserUrl);
      ytQuery = parsed.searchParams.get('search_query') || '';
    } catch {
      ytQuery = '';
    }
  }

  const handleNavigate = (url: string) => {
    let clean = url.trim();
    if (!clean) return;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      if (clean.includes('.') && !clean.includes(' ')) {
        clean = 'https://' + clean;
      } else {
        clean = `https://duckduckgo.com/?q=${encodeURIComponent(clean)}`;
      }
    }
    setActiveBrowserUrl(clean);
    setCustomUrl(clean);
  };

  return (
    <aside
      className={`shrink-0 w-80 sm:w-96 md:w-[440px] h-full border-l flex flex-col shadow-2xl transition-all duration-200 ease-in-out select-none animate-in slide-in-from-right duration-200 z-20 ${
        isDarkTheme
          ? 'bg-black text-white border-neutral-800'
          : 'bg-white text-black border-neutral-200'
      }`}
    >
      {/* 1. Header with Clean Tab Bar (ChatGPT & Meta AI Style) */}
      <div className="h-14 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-950/50">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-neutral-200/60 dark:bg-neutral-900 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('thought')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'thought'
                ? 'bg-white dark:bg-black text-black dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Thinking</span>
            {thoughtProcess?.durationMs && (
              <span className="text-[10px] font-mono text-neutral-400">
                {(thoughtProcess.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('browser')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition relative ${
              activeTab === 'browser'
                ? 'bg-white dark:bg-black text-black dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Browser Preview</span>
            {hasBrowserAction && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-neutral-200/60 dark:hover:bg-neutral-900 text-neutral-400 hover:text-black dark:hover:text-white transition active:scale-95"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* ================= TAB A: CLEAN CHATGPT / META AI THINKING ================= */}
        {activeTab === 'thought' && (
          <div className="p-5 space-y-5 text-xs leading-relaxed">
            {/* Live generation pulse */}
            {isSendingMessage && (
              <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-black dark:text-white">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>Thinking & processing request...</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Formulating response, evaluating tools, and verifying natural tone.
                </p>
              </div>
            )}

            {/* Clean Thought Block (ChatGPT Style) */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                <span>Thought Summary</span>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[12.5px] leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                {thoughtProcess?.reasoning ||
                  (isSendingMessage
                    ? 'Understanding user prompt and formulating response strategy...'
                    : 'Delivered direct conversational response without requiring additional database searches.')}
              </div>
            </div>

            {/* Actions Taken / Tools Executed (Clean modern chips) */}
            {hasTools && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Actions Taken
                </div>
                <div className="space-y-2">
                  {thoughtProcess!.toolsCalled!.map((tool, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-black dark:text-white">
                          {tool.tool.includes('browser') || tool.tool.includes('web') ? (
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                          ) : tool.tool.includes('weather') ? (
                            <CloudSun className="w-3.5 h-3.5 text-amber-500" />
                          ) : tool.tool.includes('math') ? (
                            <Calculator className="w-3.5 h-3.5 text-emerald-500" />
                          ) : tool.tool.includes('meme') ? (
                            <Film className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                          <span className="capitalize">{tool.tool.replace(/_/g, ' ')}</span>
                        </div>
                        {tool.resultSummary && (
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                            {tool.resultSummary}
                          </div>
                        )}
                      </div>

                      {(tool.tool.includes('browser') || tool.tool.includes('web')) && (
                        <button
                          onClick={() => setActiveTab('browser')}
                          className="shrink-0 p-1.5 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center gap-1 hover:underline"
                        >
                          <span>View Preview</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Audio Dialogue (Clean badge ONLY when an authentic dialogue was played) */}
            {thoughtProcess?.selectedDialogueTitle && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>Dialogue Reaction Attached</span>
                </div>
                <div className="p-3 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-[12px] font-medium text-black dark:text-white flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span className="line-clamp-2">"{thoughtProcess.selectedDialogueTitle}"</span>
                </div>
              </div>
            )}

            {/* Memories Recalled (Only if meaningful facts were recalled) */}
            {thoughtProcess?.memoriesConsidered && thoughtProcess.memoriesConsidered.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Contextual Memories Recalled
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {thoughtProcess.memoriesConsidered.map((key, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800"
                    >
                      #{key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB B: LIVE IN-APP BROWSER & PREVIEW ================= */}
        {activeTab === 'browser' && (
          <div className="flex flex-col h-full bg-neutral-950 text-white select-text">
            {/* In-App Browser Address Bar (matching vadivelu-browser-app) */}
            <div className="p-3 border-b border-neutral-800 bg-neutral-900 flex flex-col gap-2 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNavigate(customUrl);
                }}
                className="flex items-center gap-2 bg-black/70 border border-neutral-700/80 rounded-xl px-2.5 py-1.5 focus-within:border-white transition"
              >
                <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Enter URL or search query..."
                  className="flex-1 bg-transparent border-none outline-none text-[11px] text-white font-mono placeholder-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => handleNavigate(customUrl)}
                  className="p-1 rounded text-neutral-400 hover:text-white transition"
                  title="Reload"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
                {activeBrowserUrl && (
                  <a
                    href={activeBrowserUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-neutral-400 hover:text-white transition"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </form>

              {/* Quick Navigation Shortcuts (from vadivelu-browser-app) */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] pb-0.5">
                <button
                  onClick={() =>
                    handleNavigate(
                      `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery || 'whats AI')}`
                    )
                  }
                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>YouTube</span>
                </button>
                <button
                  onClick={() => handleNavigate('https://www.google.com/')}
                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                >
                  <span>Google</span>
                </button>
                <button
                  onClick={() => handleNavigate('https://github.com/codebyramu')}
                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                >
                  <span>GitHub</span>
                </button>
                <button
                  onClick={() => handleNavigate('https://en.wikipedia.org/')}
                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                >
                  <span>Wikipedia</span>
                </button>
              </div>
            </div>

            {/* Live Preview Display Canvas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* YouTube Live Embed & Video Results */}
              {isYouTube ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-red-500 fill-current" />
                      <span>YouTube Search Preview</span>
                    </span>
                    <a
                      href={
                        activeBrowserUrl ||
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery || 'whats AI')}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-red-400 hover:underline flex items-center gap-1"
                    >
                      <span>Open in YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Embedded YouTube search player frame */}
                  <div className="w-full aspect-video rounded-2xl overflow-hidden border border-neutral-800 bg-black shadow-lg">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
                        ytQuery || 'whats AI'
                      )}`}
                      title="YouTube Preview"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>

                  {/* Web results / Video search cards */}
                  {hasWebResults && (
                    <div className="space-y-2 pt-2">
                      <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Search Matches
                      </div>
                      {thoughtProcess!.webResults!.map((result, idx) => (
                        <a
                          key={idx}
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition group space-y-1"
                        >
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {result.domain || 'youtube.com'}
                          </div>
                          <div className="text-xs font-medium text-white group-hover:text-red-400 leading-snug line-clamp-2">
                            {result.title}
                          </div>
                          {result.snippet && (
                            <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                              {result.snippet}
                            </p>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : hasFetchedPage && thoughtProcess?.fetchedPage ? (
                /* In-App Web Reader for Articles / Links */
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-2">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                        <span>In-App Article Reader</span>
                      </div>
                      <a
                        href={thoughtProcess.fetchedPage.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-white transition flex items-center gap-1"
                      >
                        <span>Full Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="text-sm font-semibold text-white leading-snug">
                      {thoughtProcess.fetchedPage.title}
                    </div>

                    <div className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line p-3 rounded-xl bg-black/60 border border-neutral-800/80 max-h-96 overflow-y-auto">
                      {thoughtProcess.fetchedPage.content || 'Content extracted and analyzed.'}
                    </div>
                  </div>
                </div>
              ) : hasWebResults ? (
                /* Live Search Result Feed */
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Search Results ({thoughtProcess!.webResults!.length})
                  </div>
                  {thoughtProcess!.webResults!.map((result, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span className="font-mono text-neutral-500 uppercase">{result.domain || 'web'}</span>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-white font-medium hover:underline"
                        >
                          <span>Visit</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs font-semibold text-white group-hover:underline leading-snug"
                      >
                        {result.title}
                      </a>
                      {result.snippet && (
                        <p className="text-[11px] text-neutral-400 line-clamp-3 leading-relaxed">
                          {result.snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Default Browser Home Canvas (matching vadivelu-browser-app home.html) */
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 text-red-500 flex items-center justify-center font-bold text-xl shadow-lg">
                    V
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">VadiVelu In-App Browser</div>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      Ask Vadivelu to search for anything, open YouTube, or inspect links right here in this side panel.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 text-center shrink-0">
        <button
          onClick={onClose}
          className="w-full py-1.5 px-3 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white transition active:scale-95"
        >
          Collapse Side Panel
        </button>
      </div>
    </aside>
  );
};

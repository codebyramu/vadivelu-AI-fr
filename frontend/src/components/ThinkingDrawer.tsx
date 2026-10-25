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
  Tv,
} from 'lucide-react';
import { ThoughtProcess, WebSearchResult } from '../types';

interface ThinkingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  thoughtProcess?: ThoughtProcess | null;
  isSendingMessage?: boolean;
  activePrompt?: string;
  isDarkTheme?: boolean;
}

// Helper to extract a 11-char YouTube video ID from various URL formats
function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

export const ThinkingDrawer: React.FC<ThinkingDrawerProps> = ({
  isOpen,
  onClose,
  thoughtProcess,
  isSendingMessage = false,
  activePrompt = '',
  isDarkTheme = false,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [activeBrowserUrl, setActiveBrowserUrl] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const hasBrowserAction = !!(
    thoughtProcess?.browserUrl ||
    (thoughtProcess?.webResults && thoughtProcess.webResults.length > 0) ||
    thoughtProcess?.fetchedPage ||
    thoughtProcess?.searchQuery
  );

  // Sync browser URL and find first valid video ID when thoughtProcess updates
  useEffect(() => {
    if (thoughtProcess) {
      const targetUrl =
        thoughtProcess.browserUrl ||
        thoughtProcess.fetchedPage?.url ||
        (thoughtProcess.searchQuery
          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(thoughtProcess.searchQuery)}`
          : '');
      setActiveBrowserUrl(targetUrl);
      setCustomUrl(targetUrl);

      // Check for video ID in web search results or URL
      let vid: string | null = extractYouTubeVideoId(targetUrl);
      if (!vid && thoughtProcess.webResults) {
        for (const item of thoughtProcess.webResults) {
          const match = extractYouTubeVideoId(item.url);
          if (match) {
            vid = match;
            break;
          }
        }
      }
      setSelectedVideoId(vid);
    }
  }, [thoughtProcess]);

  if (!isOpen) return null;

  const hasTools = thoughtProcess?.toolsCalled && thoughtProcess.toolsCalled.length > 0;
  const hasWebResults = thoughtProcess?.webResults && thoughtProcess.webResults.length > 0;
  const hasFetchedPage = !!thoughtProcess?.fetchedPage;

  const isYouTube =
    activeBrowserUrl.includes('youtube.com') ||
    (thoughtProcess?.searchQuery && thoughtProcess.searchQuery.toLowerCase().includes('youtube')) ||
    (thoughtProcess?.reasoning && thoughtProcess.reasoning.toLowerCase().includes('youtube')) ||
    selectedVideoId !== null;

  // Extract query term for YouTube
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
    const vid = extractYouTubeVideoId(clean);
    if (vid) setSelectedVideoId(vid);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay for Thinking Drawer */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 md:relative md:z-auto w-full sm:w-96 md:w-[460px] h-full border-l flex flex-col shadow-2xl transition-all duration-200 ease-in-out select-none animate-in slide-in-from-right duration-200 ${
          isDarkTheme
            ? 'bg-black text-white border-neutral-800'
            : 'bg-white text-black border-neutral-200'
        }`}
      >
      {/* 1. Top Header Bar (ChatGPT & Meta AI Style) */}
      <div className="h-14 px-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-950/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-black dark:text-white flex items-center justify-center shadow-xs">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-tight text-black dark:text-white flex items-center gap-1.5">
              <span>Thinking Process</span>
              {isSendingMessage ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500">
                  {thoughtProcess?.durationMs ? `${(thoughtProcess.durationMs / 1000).toFixed(1)}s` : '1.8s'}
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-400">
              Vadivelu Director • Live Reasoning & Tools
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-neutral-200/60 dark:hover:bg-neutral-900 text-neutral-400 hover:text-black dark:hover:text-white transition active:scale-95"
          title="Collapse panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Unified Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs leading-relaxed">
        {/* Live generation indicator */}
        {isSendingMessage && (
          <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-black dark:text-white">
              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              <span>Thinking & processing request...</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Formulating response, executing tools, and verifying comedic timing.
            </p>
          </div>
        )}

        {/* ================= SECTION A: THOUGHT SUMMARY (ChatGPT style) ================= */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" />
            <span>Thought Summary</span>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[12.5px] leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line shadow-xs">
            {thoughtProcess?.reasoning ||
              (isSendingMessage
                ? 'Understanding user prompt and formulating response strategy...'
                : 'Delivered direct conversational response without requiring additional database searches.')}
          </div>
        </div>

        {/* ================= SECTION B: IN-APP BROWSER & PREVIEW (RIGHT UNDER THOUGHT SUMMARY) ================= */}
        {(hasBrowserAction || isYouTube) && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-black dark:text-white" />
                <span>In-App Browser & Preview</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                live
              </span>
            </div>

            {/* Browser Window Frame */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-xl text-white">
              {/* Address Bar */}
              <div className="p-2.5 border-b border-neutral-800/90 bg-neutral-900/90 flex flex-col gap-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleNavigate(customUrl);
                  }}
                  className="flex items-center gap-2 bg-black/80 border border-neutral-700/80 rounded-xl px-2.5 py-1.5 focus-within:border-white transition"
                >
                  <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="Search query or enter web address..."
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
                      title="Open in external browser"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </form>

                {/* Quick Navigation Shortcuts */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] pb-0.5">
                  <button
                    onClick={() =>
                      handleNavigate(
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery || 'whats AI')}`
                      )
                    }
                    className="px-2 py-0.8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>YouTube</span>
                  </button>
                  <button
                    onClick={() => handleNavigate('https://www.google.com/')}
                    className="px-2 py-0.8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                  >
                    <span>Google</span>
                  </button>
                  <button
                    onClick={() => handleNavigate('https://github.com/codebyramu')}
                    className="px-2 py-0.8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                  >
                    <span>GitHub</span>
                  </button>
                  <button
                    onClick={() => handleNavigate('https://en.wikipedia.org/')}
                    className="px-2 py-0.8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 flex items-center gap-1 transition shrink-0"
                  >
                    <span>Wikipedia</span>
                  </button>
                </div>
              </div>

              {/* Display Canvas */}
              <div className="p-3.5 space-y-3">
                {/* 1. YouTube Live Embed Player (If video ID is available) */}
                {selectedVideoId ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                        <Play className="w-3.5 h-3.5 text-red-500 fill-current" />
                        <span>Now Playing Preview</span>
                      </span>
                      <a
                        href={`https://www.youtube.com/watch?v=${selectedVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-red-400 hover:underline flex items-center gap-1"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Working YouTube Embed iframe using direct video ID */}
                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-neutral-800 bg-black shadow-lg">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${selectedVideoId}?autoplay=0&rel=0`}
                        title="YouTube Video Player"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : isYouTube ? (
                  /* YouTube Search / Channel Hub Banner */
                  <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/40 via-neutral-900 to-neutral-900 border border-red-900/40 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold shadow-md">
                        <Play className="w-4 h-4 fill-current" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">YouTube Search</div>
                        <div className="text-[10px] text-neutral-400">
                          {ytQuery ? `Results for "${ytQuery}"` : 'Live YouTube Search'}
                        </div>
                      </div>
                    </div>

                    <a
                      href={
                        activeBrowserUrl ||
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery || 'whats AI')}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-lg active:scale-95"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>Open Search on YouTube</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                ) : null}

                {/* 2. YouTube Search Matches / Video Cards */}
                {hasWebResults && isYouTube && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[10.5px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Videos & Channel Matches
                    </div>
                    {thoughtProcess!.webResults!.map((result, idx) => {
                      const cardVid = extractYouTubeVideoId(result.url);
                      const isCurrentlyActive = cardVid && cardVid === selectedVideoId;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (cardVid) {
                              setSelectedVideoId(cardVid);
                              setActiveBrowserUrl(result.url);
                              setCustomUrl(result.url);
                            } else {
                              window.open(result.url, '_blank');
                            }
                          }}
                          className={`p-3 rounded-xl border transition cursor-pointer space-y-1 ${
                            isCurrentlyActive
                              ? 'bg-neutral-800/90 border-red-500 shadow-md ring-1 ring-red-500/30'
                              : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                            <span className="truncate max-w-[200px]">{result.domain || 'youtube.com'}</span>
                            {cardVid && (
                              <span className="text-red-400 font-semibold flex items-center gap-1">
                                <Play className="w-2.5 h-2.5 fill-current" />
                                <span>{isCurrentlyActive ? 'Playing' : 'Click to Play'}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-white hover:text-red-400 leading-snug line-clamp-2">
                            {result.title}
                          </div>
                          {result.snippet && (
                            <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                              {result.snippet}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. In-App Web Reader for Articles / Links */}
                {hasFetchedPage && thoughtProcess?.fetchedPage && (
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
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

                    <div className="text-xs font-semibold text-white leading-snug">
                      {thoughtProcess.fetchedPage.title}
                    </div>

                    <div className="text-[11px] text-neutral-300 leading-relaxed whitespace-pre-line p-2.5 rounded-lg bg-black/60 border border-neutral-800/80 max-h-64 overflow-y-auto font-normal">
                      {thoughtProcess.fetchedPage.content || 'Content extracted and analyzed.'}
                    </div>
                  </div>
                )}

                {/* 4. Live Search Result Feed (Non-YouTube Web Search) */}
                {hasWebResults && !isYouTube && (
                  <div className="space-y-2">
                    <div className="text-[10.5px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Search Results ({thoughtProcess!.webResults!.length})
                    </div>
                    {thoughtProcess!.webResults!.map((result, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 transition space-y-1 group"
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
                          <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                            {result.snippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= SECTION C: ACTIONS TAKEN (Clean pills) ================= */}
        {hasTools && (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Actions Executed
            </div>
            <div className="space-y-1.5">
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= SECTION D: AUTHENTIC DIALOGUE (Only if selected) ================= */}
        {thoughtProcess?.selectedDialogueTitle && (
          <div className="space-y-1.5 pt-1">
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
    </>
  );
};

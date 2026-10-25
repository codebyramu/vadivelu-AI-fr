import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Search,
  Database,
  Brain,
  Film,
  Volume2,
  ChevronRight,
  CheckCircle2,
  Clock,
  Terminal,
  ArrowRight,
  Globe,
  ExternalLink,
  BookOpen,
  CloudSun,
  Calculator,
  Compass,
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
  const [activeTab, setActiveTab] = useState<'all' | 'browser' | 'reasoning'>('all');

  if (!isOpen) return null;

  const hasTools = thoughtProcess?.toolsCalled && thoughtProcess.toolsCalled.length > 0;
  const hasCandidates = thoughtProcess?.topRankedCandidates && thoughtProcess.topRankedCandidates.length > 0;
  const hasMemories = thoughtProcess?.memoriesConsidered && thoughtProcess.memoriesConsidered.length > 0;
  const hasWebResults = thoughtProcess?.webResults && thoughtProcess.webResults.length > 0;
  const hasFetchedPage = !!thoughtProcess?.fetchedPage;

  return (
    <aside
      className={`shrink-0 w-80 sm:w-96 md:w-[420px] h-full border-l flex flex-col shadow-2xl transition-all duration-200 ease-in-out select-none animate-in slide-in-from-right duration-200 z-20 ${
        isDarkTheme
          ? 'bg-black text-white border-neutral-800'
          : 'bg-white text-black border-neutral-200'
      }`}
    >
      {/* Header — ChatGPT / Meta AI Style */}
      <div className="h-14 px-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
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
                  {thoughtProcess?.durationMs ? `${(thoughtProcess.durationMs / 1000).toFixed(1)}s` : 'completed'}
                </span>
              )}
            </div>
            <div className="text-[10px] text-neutral-400">
              Vadivelu Director • Ultra Tools & Live Web
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-black dark:hover:text-white transition active:scale-95"
          title="Collapse thinking panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* Active Generation Status Bar (Meta AI style) */}
        {isSendingMessage && (
          <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-black dark:text-white">
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Executing Ultra Tools & Strategy...</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">live</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Evaluating user intent, searching live web data, checking memories, and orchestrating comedic dialogue reactions.
            </p>
          </div>
        )}

        {/* 1. Internal Reasoning Steps (ChatGPT Style Quote Block) */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reasoning & Strategy</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 border-l-2 border-l-black dark:border-l-white text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300">
            {thoughtProcess?.reasoning || (isSendingMessage ? 'Formulating response strategy with natural comedic timing...' : 'Generated a direct conversational response without unnecessary meme insertion.')}
          </div>
        </div>

        {/* 2. In-App Web Browser & Search Results (Inspired by vadivelu-browser-app) */}
        {(hasWebResults || hasFetchedPage || thoughtProcess?.searchQuery) && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-black dark:text-white" />
                <span>Web Search & Browsed Links</span>
              </span>
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-400">
                in-app browser
              </span>
            </div>

            {/* Browser Search Capsule (matching vadivelu-browser-app home.html style) */}
            <div className="p-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-white space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-neutral-300 bg-black/60 px-3 py-1.5 rounded-xl border border-neutral-800/80">
                <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="truncate font-mono text-[11px]">
                  {thoughtProcess?.searchQuery || thoughtProcess?.fetchedPage?.url || 'Live Web Inspection'}
                </span>
              </div>

              {/* Quick Link Shortcuts */}
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[9px]">Sources:</span>
                <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300">DuckDuckGo</span>
                <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300">Wikipedia</span>
                <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300">Live Web</span>
              </div>
            </div>

            {/* Fetched Webpage In-App Reader Card */}
            {hasFetchedPage && thoughtProcess?.fetchedPage && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-black dark:text-white">
                    <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
                    <span>In-App Link Reader</span>
                  </div>
                  <a
                    href={thoughtProcess.fetchedPage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-medium text-neutral-500 hover:text-black dark:hover:text-white transition"
                  >
                    <span>Open URL</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[12px] font-medium text-black dark:text-white leading-snug">
                  {thoughtProcess.fetchedPage.title}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-4 leading-relaxed font-normal bg-white/50 dark:bg-black/50 p-2.5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  {thoughtProcess.fetchedPage.content || 'Content extracted and analyzed.'}
                </div>
              </div>
            )}

            {/* Web Search Result Cards */}
            {hasWebResults && (
              <div className="space-y-2">
                {thoughtProcess!.webResults!.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white transition-all space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span className="font-mono text-neutral-500 uppercase">{result.domain || 'web'}</span>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-black dark:text-white font-medium transition"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[12px] font-semibold text-black dark:text-white hover:underline leading-snug line-clamp-1"
                    >
                      {result.title}
                    </a>
                    {result.snippet && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                        {result.snippet}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Tool Calls & Database Queries */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Ultra Tools & DB Actions</span>
            </span>
            <span className="text-[10px] font-mono lowercase">
              {thoughtProcess?.toolsCalled?.length || 0} executed
            </span>
          </div>

          <div className="space-y-2">
            {hasTools ? (
              thoughtProcess!.toolsCalled!.map((tool, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-semibold text-black dark:text-white flex items-center gap-1.5">
                      {tool.tool.includes('web_search') ? (
                        <Globe className="w-3 h-3 text-neutral-500" />
                      ) : tool.tool.includes('fetch_webpage') ? (
                        <BookOpen className="w-3 h-3 text-neutral-500" />
                      ) : tool.tool.includes('lookup_weather') ? (
                        <CloudSun className="w-3 h-3 text-neutral-500" />
                      ) : tool.tool.includes('calculate') ? (
                        <Calculator className="w-3 h-3 text-neutral-500" />
                      ) : tool.tool.includes('dialogue') ? (
                        <Search className="w-3 h-3 text-neutral-500" />
                      ) : tool.tool.includes('memory') ? (
                        <Brain className="w-3 h-3 text-neutral-500" />
                      ) : (
                        <Film className="w-3 h-3 text-neutral-500" />
                      )}
                      <span>{tool.tool}</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      success
                    </span>
                  </div>

                  {tool.query && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      input: <span className="text-black dark:text-white font-medium">"{tool.query}"</span>
                    </div>
                  )}

                  {tool.resultSummary && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-300">
                      {tool.resultSummary}
                    </div>
                  )}
                </div>
              ))
            ) : isSendingMessage ? (
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 space-y-1">
                <div>&gt; intent_evaluator: assessing conversational requirements...</div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                Direct conversational response — no database search was needed for this query.
              </div>
            )}
          </div>
        </div>

        {/* 4. Long-term Memories Recalled */}
        {hasMemories && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              <span>Memories Considered</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {thoughtProcess!.memoriesConsidered!.map((key, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full text-[10.5px] font-medium bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-200 dark:border-neutral-800"
                >
                  #{key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 5. Evaluated Dialogue Candidates (If DB search was performed) */}
        {hasCandidates && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" />
                <span>Supabase Dialogues Scored</span>
              </span>
              <span className="text-[10px] font-mono">
                {thoughtProcess!.topRankedCandidates!.length} evaluated
              </span>
            </div>

            <div className="space-y-2">
              {thoughtProcess!.topRankedCandidates!.map((candidate, idx) => {
                const isSelected = candidate.id === thoughtProcess?.selectedDialogueId;
                return (
                  <div
                    key={candidate.id}
                    className={`p-3 rounded-2xl border transition ${
                      isSelected
                        ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1 font-mono">
                      <span className="font-semibold text-neutral-400">
                        Rank #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-black text-white dark:bg-white dark:text-black font-semibold text-[9px] uppercase">
                            Selected
                          </span>
                        )}
                        {candidate.relevanceScore !== undefined && (
                          <span className="font-bold text-black dark:text-white">
                            +{candidate.relevanceScore} pts
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[12px] font-medium text-black dark:text-white line-clamp-2 leading-snug">
                      "{candidate.lineText}"
                    </div>
                    {candidate.lineTranslation && (
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                        {candidate.lineTranslation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 text-center">
        <button
          onClick={onClose}
          className="w-full py-1.5 px-3 rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white transition active:scale-95"
        >
          Collapse Thinking Preview
        </button>
      </div>
    </aside>
  );
};

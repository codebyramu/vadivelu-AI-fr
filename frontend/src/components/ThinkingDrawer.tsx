import React from 'react';
import { X, Sparkles, Search, Database, Brain, Film, Volume2, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
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
  if (!isOpen) return null;

  return (
    <aside
      className={`fixed top-10 bottom-0 left-0 z-40 w-84 sm:w-96 border-r flex flex-col shadow-2xl transition-all duration-300 ease-in-out select-none ${
        isDarkTheme
          ? 'bg-black/95 text-white border-neutral-800 backdrop-blur-xl'
          : 'bg-white/95 text-black border-neutral-200 backdrop-blur-xl'
      }`}
    >
      {/* Drawer Header */}
      <div className="h-14 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight text-black dark:text-white flex items-center gap-1.5">
              <span>Reasoning & Tool Execution</span>
              {isSendingMessage && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
              Vadivelu Reaction Director
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 hover:text-black dark:hover:text-white transition active:scale-95"
          title="Collapse thinking preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Live Thinking Status if actively generating */}
        {isSendingMessage && (
          <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-black dark:text-white">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Director is analyzing...</span>
              </span>
              <span className="text-[10px] text-neutral-400">Live</span>
            </div>
            <div className="space-y-2 text-[11px] text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />
                <span>Parsed user emotion & context</span>
              </div>
              <div className="flex items-center gap-2 text-black dark:text-white font-medium">
                <Search className="w-3.5 h-3.5 animate-pulse shrink-0" />
                <span>Scoring Supabase dialogues with fuzzy relevance...</span>
              </div>
              <div className="flex items-center gap-2 opacity-60">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Synthesizing Edge-TTS audio stream</span>
              </div>
            </div>
          </div>
        )}

        {/* 1. Internal Reasoning & Strategy */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Directing Rationale</span>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[12.5px] leading-relaxed font-normal text-neutral-800 dark:text-neutral-200">
            {thoughtProcess?.reasoning || (isSendingMessage ? 'Formulating response strategy and comedic dialogue timing...' : 'Natural conversation response with comedic timing.')}
          </div>
        </div>

        {/* 2. Tools Called & Searches */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Tools & Searches Called</span>
            </span>
            <span className="text-[10px] font-mono lowercase">
              {thoughtProcess?.toolsCalled?.length || (isSendingMessage ? 2 : 0)} called
            </span>
          </div>

          <div className="space-y-2">
            {thoughtProcess?.toolsCalled && thoughtProcess.toolsCalled.length > 0 ? (
              thoughtProcess.toolsCalled.map((tool, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-black dark:text-white font-semibold">
                    <span className="flex items-center gap-1.5">
                      {tool.tool.includes('dialogue') ? (
                        <Search className="w-3 h-3 text-neutral-500" />
                      ) : tool.tool.includes('memory') ? (
                        <Brain className="w-3 h-3 text-neutral-500" />
                      ) : (
                        <Film className="w-3 h-3 text-neutral-500" />
                      )}
                      <span>{tool.tool}()</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      success
                    </span>
                  </div>
                  {tool.query && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      query: <span className="text-black dark:text-white font-medium">"{tool.query}"</span>
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
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-500 space-y-1">
                <div>&gt; search_dialogues(query="{activePrompt.slice(0, 30)}...")</div>
                <div>&gt; retrieve_relevant_memories(prompt="{activePrompt.slice(0, 30)}...")</div>
              </div>
            ) : (
              <div className="text-neutral-400 text-xs italic">No tools called for this turn.</div>
            )}
          </div>
        </div>

        {/* 3. Memories Recalled */}
        {thoughtProcess?.memoriesConsidered && thoughtProcess.memoriesConsidered.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <Brain className="w-3.5 h-3.5" />
              <span>Long-Term Memories Recalled</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {thoughtProcess.memoriesConsidered.map((key, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-200 dark:border-neutral-800"
                >
                  #{key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 4. Ranked Dialogue Candidates from Supabase */}
        {thoughtProcess?.topRankedCandidates && thoughtProcess.topRankedCandidates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" />
                <span>Supabase Dialogues Evaluated</span>
              </span>
              <span className="text-[10px] font-mono">
                top {thoughtProcess.topRankedCandidates.length}
              </span>
            </div>

            <div className="space-y-2">
              {thoughtProcess.topRankedCandidates.map((candidate, idx) => {
                const isSelected = candidate.id === thoughtProcess.selectedDialogueId;
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
                      <span className="font-semibold text-neutral-500 dark:text-neutral-400">
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
                    {candidate.tags && candidate.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {candidate.tags.slice(0, 3).map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[9.5px] px-1.5 py-0.2 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
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

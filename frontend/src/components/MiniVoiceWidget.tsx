import React from 'react';
import {
  Mic,
  MicOff,
  Square,
  Maximize2,
  X,
  Volume2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { SonicWaveformVisualizer } from './SonicWaveformVisualizer';
import { ActiveMemeInfo, PlaybackStatus } from '../hooks/useAudioPerformance';

interface MiniVoiceWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onExpandFullscreen: () => void;
  isListening: boolean;
  onToggleListening: () => void;
  onInterrupt: () => void;
  playbackStatus: PlaybackStatus;
  activeMeme: ActiveMemeInfo | null;
  analyserNode?: AnalyserNode | null;
  transcript?: string;
  interimTranscript?: string;
  isDarkTheme: boolean;
  voiceGender?: 'male' | 'female';
}

export const MiniVoiceWidget: React.FC<MiniVoiceWidgetProps> = ({
  isOpen,
  onClose,
  onExpandFullscreen,
  isListening,
  onToggleListening,
  onInterrupt,
  playbackStatus,
  activeMeme,
  analyserNode,
  transcript = '',
  interimTranscript = '',
  isDarkTheme,
  voiceGender = 'female',
}) => {
  if (!isOpen) return null;

  // Determine visualizer state & status label
  let visualizerState: 'listening' | 'speaking' | 'processing' | 'idle' = 'idle';
  let statusText = 'Voice Ready';
  let statusColor = 'text-blue-500';

  if (playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme') {
    visualizerState = 'speaking';
    statusText = 'Speaking...';
    statusColor = 'text-cyan-400';
  } else if (playbackStatus === 'preparing') {
    visualizerState = 'processing';
    statusText = 'Thinking...';
    statusColor = 'text-amber-400';
  } else if (isListening) {
    visualizerState = 'listening';
    statusText = 'Listening actively...';
    statusColor = 'text-emerald-400';
  }

  const liveText = interimTranscript || transcript;

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 w-84 sm:w-92 rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden border backdrop-blur-2xl ${
        isDarkTheme
          ? 'bg-[#0a0d14]/92 border-slate-700/60 text-white shadow-cyan-950/30'
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/60'
      }`}
      style={{ minWidth: '320px', maxWidth: '380px' }}
    >
      {/* Top Header */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between border-b ${
          isDarkTheme ? 'border-slate-800/80 bg-slate-900/40' : 'border-slate-100 bg-slate-50/70'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isListening ? 'bg-emerald-400' : 'bg-blue-400'
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isListening ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
            ></span>
          </span>
          <span className="text-xs font-semibold tracking-wide">Live Voice Chat</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              isDarkTheme ? 'bg-slate-800 text-slate-300' : 'bg-slate-200/70 text-slate-600'
            }`}
          >
            {voiceGender === 'female' ? 'Female Voice' : 'Male Voice'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onExpandFullscreen}
            title="Expand to Fullscreen Voice Mode"
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkTheme
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200/60 text-slate-500 hover:text-slate-800'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="End Voice Chat"
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkTheme
                ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                : 'hover:bg-red-100 text-slate-500 hover:text-red-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Visualizer Canvas Area */}
      <div className="relative h-40 w-full flex items-center justify-center overflow-hidden">
        <SonicWaveformVisualizer
          analyserNode={analyserNode}
          isActive={isListening || playbackStatus !== 'idle'}
          state={visualizerState}
          className="w-full h-full"
        />

        {/* Dynamic Meme Reaction Badge */}
        {activeMeme && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-black/75 border border-cyan-500/40 text-cyan-200 text-xs shadow-lg animate-in fade-in zoom-in-95 duration-200">
            {activeMeme.thumbnailUrl ? (
              <img
                src={activeMeme.thumbnailUrl}
                alt="meme"
                className="w-4 h-4 rounded-full object-cover border border-cyan-400/50"
              />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="font-medium truncate max-w-[170px]">
              Playing {activeMeme.title || activeMeme.memeId} meme
            </span>
          </div>
        )}

        {/* Status text */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-medium border border-white/5">
          <span className={statusColor}>{statusText}</span>
        </div>
      </div>

      {/* Speech transcription preview */}
      {liveText && (
        <div
          className={`px-3 py-1.5 text-xs truncate text-center border-t border-b ${
            isDarkTheme
              ? 'bg-slate-900/50 border-slate-800 text-slate-300 italic'
              : 'bg-slate-50 border-slate-100 text-slate-600 italic'
          }`}
        >
          "{liveText}"
        </div>
      )}

      {/* Bottom Control Bar */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-t ${
          isDarkTheme ? 'border-slate-800/80 bg-slate-900/30' : 'border-slate-100 bg-slate-50/50'
        }`}
      >
        <button
          onClick={onToggleListening}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            isListening
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : isDarkTheme
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
          }`}
        >
          {isListening ? (
            <>
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              <span>Listening</span>
            </>
          ) : (
            <>
              <MicOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Muted</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {(playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme') && (
            <button
              onClick={onInterrupt}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Interrupt</span>
            </button>
          )}

          <button
            onClick={onClose}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isDarkTheme
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
            }`}
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      </div>
    </div>
  );
};

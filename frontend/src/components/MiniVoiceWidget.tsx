import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  X,
  VolumeX,
  Maximize2,
  Sparkles,
  Minus,
  ChevronUp,
} from 'lucide-react';
import { SonicWaveformVisualizer } from './SonicWaveformVisualizer';
import { ActiveMemeInfo, PlaybackStatus } from '../hooks/useAudioPerformance';

interface MiniVoiceWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onExpandFullscreen?: () => void;
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
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  // Determine visualizer state & status label
  let visualizerState: 'listening' | 'speaking' | 'processing' | 'idle' = 'idle';
  let statusText = 'Ready';
  let statusDotClass = 'bg-neutral-400';

  if (playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme') {
    visualizerState = 'speaking';
    statusText = 'Speaking…';
    statusDotClass = 'bg-black dark:bg-white animate-pulse';
  } else if (playbackStatus === 'preparing') {
    visualizerState = 'processing';
    statusText = 'Preparing audio…';
    statusDotClass = 'bg-neutral-500 animate-pulse';
  } else if (isListening) {
    visualizerState = 'listening';
    statusText = 'Listening…';
    statusDotClass = 'bg-emerald-500 animate-ping';
  } else {
    statusText = 'Microphone muted';
    statusDotClass = 'bg-neutral-400';
  }

  const liveText = interimTranscript || transcript;
  const isPlayingAudio = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';

  // Compact Minimized Pill (Never blocks chat messages)
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-6 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 dark:bg-neutral-900/95 border border-neutral-300 dark:border-neutral-800 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
        <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
        <span className="text-xs font-semibold text-black dark:text-white">
          {statusText}
        </span>

        {/* Quick unmute / mute from pill */}
        <button
          onClick={onToggleListening}
          className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition"
          title={isListening ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isListening ? <Mic className="w-3.5 h-3.5 text-black dark:text-white" /> : <MicOff className="w-3.5 h-3.5 text-neutral-400" />}
        </button>

        {/* Quick Stop audio from pill */}
        {isPlayingAudio && (
          <button
            onClick={onInterrupt}
            className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white transition"
            title="Interrupt speech"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="w-px h-3.5 bg-neutral-200 dark:bg-neutral-800 my-auto" />

        {/* Expand */}
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white transition"
          title="Expand voice widget"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-black dark:hover:text-white transition"
          title="Close voice mode"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Expanded Floating Card (Modern, grounded, glassmorphic)
  return (
    <div
      className="fixed bottom-24 right-6 z-40 w-72 bg-white/95 dark:bg-neutral-950/95 border border-neutral-200/90 dark:border-neutral-800 shadow-2xl rounded-2xl backdrop-blur-2xl p-4 flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header bar */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-900 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
          <span className="text-xs font-semibold tracking-tight text-black dark:text-white">
            Vadivelu Voice
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition active:scale-95"
            title="Minimize to pill"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {onExpandFullscreen && (
            <button
              onClick={onExpandFullscreen}
              className="p-1 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition active:scale-95"
              title="Expand to Fullscreen Voice Mode"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition active:scale-95"
            title="Close voice chat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dynamic Meme Reaction Badge (if active meme is playing) */}
      {activeMeme && (
        <div className="w-full mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-black dark:text-white animate-in fade-in zoom-in-95">
          {activeMeme.thumbnailUrl ? (
            <img
              src={activeMeme.thumbnailUrl}
              alt="meme"
              className="w-4 h-4 rounded-full object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
            />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />
          )}
          <span className="font-semibold text-[11px] truncate flex-1">
            {activeMeme.title || activeMeme.memeId}
          </span>
        </div>
      )}

      {/* Contained Sonic Waveform Canvas */}
      <div className="relative w-28 h-28 flex items-center justify-center my-1 rounded-2xl bg-neutral-50 dark:bg-black border border-neutral-200/60 dark:border-neutral-800/80 overflow-hidden shadow-inner">
        <SonicWaveformVisualizer
          analyserNode={analyserNode}
          isActive={isListening || playbackStatus !== 'idle'}
          state={visualizerState}
          isDarkTheme={isDarkTheme}
          className="w-full h-full"
        />
      </div>

      {/* Status indicator */}
      <div className="text-[11.5px] font-semibold tracking-tight mt-1.5 text-center text-black dark:text-white">
        {statusText}
      </div>

      {/* Speech transcription snippet (if speaking) */}
      {liveText && (
        <div className="text-[10px] italic max-w-[240px] truncate text-center text-neutral-600 dark:text-neutral-300 mt-1 bg-neutral-100 dark:bg-neutral-900 px-2.5 py-1 rounded-full border border-neutral-200/50 dark:border-neutral-800/60">
          "{liveText}"
        </div>
      )}

      {/* Action Controls Bar */}
      <div className="flex items-center gap-2 mt-3 w-full pt-2.5 border-t border-neutral-100 dark:border-neutral-900">
        <button
          onClick={onToggleListening}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold transition active:scale-95 ${
            isListening
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
              : 'bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-800'
          }`}
          title={isListening ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isListening ? (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Mute</span>
            </>
          ) : (
            <>
              <MicOff className="w-3.5 h-3.5 text-neutral-400" />
              <span>Unmute</span>
            </>
          )}
        </button>

        {isPlayingAudio && (
          <button
            onClick={onInterrupt}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-black dark:text-white transition active:scale-95 border border-neutral-300/80 dark:border-neutral-700"
            title="Interrupt speech"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Stop</span>
          </button>
        )}
      </div>
    </div>
  );
};

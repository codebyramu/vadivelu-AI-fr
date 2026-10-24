import React from 'react';
import {
  Mic,
  MicOff,
  X,
  VolumeX,
  Maximize2,
  Sparkles,
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
  if (!isOpen) return null;

  // Determine visualizer state & status label
  let visualizerState: 'listening' | 'speaking' | 'processing' | 'idle' = 'idle';
  let statusText = '• Ready';
  let statusColor = isDarkTheme ? 'text-zinc-300' : 'text-zinc-600';

  if (playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme') {
    visualizerState = 'speaking';
    statusText = '• Speaking...';
    statusColor = isDarkTheme ? 'text-zinc-100 font-semibold' : 'text-zinc-900 font-semibold';
  } else if (playbackStatus === 'preparing') {
    visualizerState = 'processing';
    statusText = '• Preparing audio…';
    statusColor = 'text-amber-500 font-medium';
  } else if (isListening) {
    visualizerState = 'listening';
    statusText = '• Listening actively...';
    statusColor = isDarkTheme ? 'text-emerald-400 font-medium' : 'text-emerald-600 font-medium';
  } else {
    statusText = '• Microphone muted';
    statusColor = isDarkTheme ? 'text-zinc-400' : 'text-zinc-500';
  }

  const liveText = interimTranscript || transcript;
  const isPlayingAudio = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';

  return (
    <div
      className="fixed bottom-24 right-8 z-40 flex flex-col items-center pointer-events-auto select-none bg-transparent animate-in fade-in zoom-in-95 duration-200"
      style={{ width: '220px' }}
    >
      {/* Dynamic Meme Reaction Badge (if active meme is playing) */}
      {activeMeme && (
        <div className="mb-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs backdrop-blur-md border shadow-sm transition animate-in fade-in zoom-in-90 duration-150 bg-white/80 dark:bg-zinc-900/80 border-black/10 dark:border-white/10 text-zinc-800 dark:text-zinc-100">
          {activeMeme.thumbnailUrl ? (
            <img
              src={activeMeme.thumbnailUrl}
              alt="meme"
              className="w-4 h-4 rounded-full object-cover border border-black/10 dark:border-white/20"
            />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span className="font-medium text-[11px] truncate max-w-[140px]">
            {activeMeme.title || activeMeme.memeId}
          </span>
        </div>
      )}

      {/* Floating Sonic Waveform (No rectangular box, 100% transparent background) */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        <SonicWaveformVisualizer
          analyserNode={analyserNode}
          isActive={isListening || playbackStatus !== 'idle'}
          state={visualizerState}
          isDarkTheme={isDarkTheme}
          className="w-full h-full"
        />
      </div>

      {/* Unobtrusive Status Label */}
      <div className={`text-[11px] tracking-wide mt-0.5 text-center transition-colors drop-shadow-xs ${statusColor}`}>
        {statusText}
      </div>

      {/* Speech transcription snippet (if speaking) */}
      {liveText && (
        <div className="text-[10px] italic max-w-[190px] truncate text-center text-zinc-500 dark:text-zinc-400 mt-0.5">
          "{liveText}"
        </div>
      )}

      {/* Minimal Floating Action Controls */}
      <div className="flex items-center gap-2 mt-2.5">
        {/* Mic Mute / Unmute */}
        <button
          onClick={onToggleListening}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-md shadow-xs active:scale-95 ${
            isListening
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/30'
              : 'bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-black/5 dark:border-white/10'
          }`}
          title={isListening ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isListening ? (
            <Mic className="w-3.5 h-3.5" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>

        {/* Interrupt button (if audio is currently playing) */}
        {isPlayingAudio && (
          <button
            onClick={onInterrupt}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-500/90 hover:bg-amber-600 text-white backdrop-blur-md shadow-xs active:scale-95 transition"
            title="Interrupt voice playback"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Fullscreen Expand (Optional) */}
        {onExpandFullscreen && (
          <button
            onClick={onExpandFullscreen}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 backdrop-blur-md border border-black/5 dark:border-white/10 active:scale-95 transition"
            title="Expand to Fullscreen Voice Mode"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Stop / Close Live Voice */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-red-500 hover:text-white text-zinc-600 dark:text-zinc-300 backdrop-blur-md border border-black/5 dark:border-white/10 active:scale-95 transition"
          title="Stop voice chat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

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
  let statusColor = isDarkTheme ? 'text-white' : 'text-black';

  if (playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme') {
    visualizerState = 'speaking';
    statusText = '• Speaking...';
    statusColor = isDarkTheme ? 'text-white font-semibold' : 'text-black font-semibold';
  } else if (playbackStatus === 'preparing') {
    visualizerState = 'processing';
    statusText = '• Preparing audio…';
    statusColor = isDarkTheme ? 'text-neutral-300 font-medium' : 'text-neutral-700 font-medium';
  } else if (isListening) {
    visualizerState = 'listening';
    statusText = '• Listening actively...';
    statusColor = isDarkTheme ? 'text-white font-medium' : 'text-black font-medium';
  } else {
    statusText = '• Microphone muted';
    statusColor = isDarkTheme ? 'text-neutral-400' : 'text-neutral-500';
  }

  const liveText = interimTranscript || transcript;
  const isPlayingAudio = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';

  return (
    <div
      className="fixed bottom-24 right-8 z-40 flex flex-col items-center pointer-events-auto select-none bg-transparent animate-in fade-in zoom-in-95 duration-150"
      style={{ width: '220px' }}
    >
      {/* Dynamic Meme Reaction Badge (if active meme is playing) */}
      {activeMeme && (
        <div className="mb-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs backdrop-blur-md border shadow-sm transition animate-in fade-in zoom-in-90 duration-150 bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 text-black dark:text-white">
          {activeMeme.thumbnailUrl ? (
            <img
              src={activeMeme.thumbnailUrl}
              alt="meme"
              className="w-4 h-4 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
            />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-black dark:text-white" />
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
        <div className="text-[10px] italic max-w-[190px] truncate text-center text-neutral-500 dark:text-neutral-400 mt-0.5">
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
              ? 'bg-black text-white dark:bg-white dark:text-black ring-2 ring-black/20 dark:ring-white/20'
              : 'bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-white border border-neutral-200 dark:border-neutral-800'
          }`}
          title={isListening ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isListening ? (
            <Mic className="w-3.5 h-3.5" />
          ) : (
            <MicOff className="w-3.5 h-3.5 text-neutral-400" />
          )}
        </button>

        {/* Interrupt button (if audio is currently playing) */}
        {isPlayingAudio && (
          <button
            onClick={onInterrupt}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black text-white dark:bg-white dark:text-black hover:opacity-90 backdrop-blur-md shadow-xs active:scale-95 transition"
            title="Interrupt voice playback"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Fullscreen Expand (Optional) */}
        {onExpandFullscreen && (
          <button
            onClick={onExpandFullscreen}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-white backdrop-blur-md border border-neutral-200 dark:border-neutral-800 active:scale-95 transition"
            title="Expand to Fullscreen Voice Mode"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Stop / Close Live Voice */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-white backdrop-blur-md border border-neutral-200 dark:border-neutral-800 active:scale-95 transition"
          title="Stop voice chat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

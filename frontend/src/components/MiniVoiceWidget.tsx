import React from 'react';
import {
  Mic,
  MicOff,
  X,
  VolumeX,
  Maximize2,
  Sparkles,
} from 'lucide-react';
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

/**
 * Modern Dynamic Island Voice Pill (Apple / ChatGPT style)
 * Replaces bulky gadget windows with a sleek 42px floating capsule.
 */
export const MiniVoiceWidget: React.FC<MiniVoiceWidgetProps> = ({
  isOpen,
  onClose,
  onExpandFullscreen,
  isListening,
  onToggleListening,
  onInterrupt,
  playbackStatus,
  activeMeme,
  transcript = '',
  interimTranscript = '',
}) => {
  if (!isOpen) return null;

  const isPlayingAudio = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';
  const liveText = interimTranscript || transcript;

  let labelText = 'Ready';
  if (activeMeme) {
    labelText = activeMeme.title || activeMeme.memeId;
  } else if (isPlayingAudio) {
    labelText = 'Speaking…';
  } else if (playbackStatus === 'preparing') {
    labelText = 'Preparing audio…';
  } else if (isListening) {
    labelText = liveText ? `"${liveText}"` : 'Listening…';
  } else {
    labelText = 'Muted';
  }

  return (
    <div
      className="fixed bottom-24 right-6 z-40 flex items-center gap-3 px-3.5 py-2 rounded-full bg-black/95 text-white border border-neutral-800 shadow-2xl backdrop-blur-2xl select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{ maxWidth: '380px' }}
    >
      {/* Dynamic Animated Soundwave Bars */}
      <div className="flex items-center gap-0.5 h-4 px-1 shrink-0 justify-center">
        <span
          className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
            isPlayingAudio ? 'animate-bounce h-3.5' : isListening ? 'h-3 animate-pulse' : 'h-1.5 opacity-40'
          }`}
          style={{ animationDuration: '600ms' }}
        />
        <span
          className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
            isPlayingAudio ? 'animate-bounce h-4.5' : isListening ? 'h-4 animate-pulse' : 'h-2 opacity-50'
          }`}
          style={{ animationDuration: '450ms', animationDelay: '100ms' }}
        />
        <span
          className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
            isPlayingAudio ? 'animate-bounce h-3' : isListening ? 'h-2.5 animate-pulse' : 'h-1.5 opacity-40'
          }`}
          style={{ animationDuration: '550ms', animationDelay: '200ms' }}
        />
        <span
          className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
            isPlayingAudio ? 'animate-bounce h-4' : isListening ? 'h-3.5 animate-pulse' : 'h-2 opacity-50'
          }`}
          style={{ animationDuration: '500ms', animationDelay: '75ms' }}
        />
      </div>

      {/* Status / Meme / Speech Snippet */}
      <div className="flex items-center gap-1.5 min-w-0 max-w-[190px]">
        {activeMeme ? (
          <Sparkles className="w-3.5 h-3.5 text-white shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
        ) : (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isPlayingAudio
                ? 'bg-white animate-pulse'
                : isListening
                ? 'bg-emerald-400 animate-ping'
                : 'bg-neutral-500'
            }`}
          />
        )}
        <span className="text-xs font-medium tracking-tight text-neutral-200 truncate">
          {labelText}
        </span>
      </div>

      {/* Subtle Divider */}
      <div className="w-px h-3.5 bg-neutral-800 my-auto shrink-0" />

      {/* Micro Control Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Mic Toggle */}
        <button
          onClick={onToggleListening}
          className={`p-1.5 rounded-full transition active:scale-90 ${
            isListening
              ? 'text-white hover:bg-neutral-800'
              : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
          }`}
          title={isListening ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>

        {/* Interrupt audio if playing */}
        {isPlayingAudio && (
          <button
            onClick={onInterrupt}
            className="p-1.5 rounded-full text-white hover:bg-neutral-800 transition active:scale-90"
            title="Interrupt speech"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Expand to Fullscreen Advanced Voice Mode */}
        {onExpandFullscreen && (
          <button
            onClick={onExpandFullscreen}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition active:scale-90"
            title="Open Fullscreen Voice Mode"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Close Voice Session */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition active:scale-90"
          title="Close voice mode"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

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
  isTranscribing?: boolean;
}

/**
 * Compact Circular Soundwave Widget (as in user Images 1 & 2)
 * Floats right above the composer input with 5 animated equalizer bars.
 * Clicking the orb expands to Fullscreen Voice Mode (Image 3).
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
  isTranscribing = false,
}) => {
  if (!isOpen) return null;

  const isPlayingAudio = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';
  const liveText = interimTranscript || transcript;

  let labelText = 'Ready';
  if (activeMeme) {
    labelText = activeMeme.title || 'Meme clip';
  } else if (isPlayingAudio) {
    labelText = 'Speaking...';
  } else if (isTranscribing) {
    labelText = 'Transcribing...';
  } else if (playbackStatus === 'preparing') {
    labelText = 'Preparing...';
  } else if (isListening) {
    labelText = liveText ? `"${liveText.slice(0, 24)}..."` : 'Listening...';
  } else {
    labelText = 'Muted';
  }

  return (
    <div className="absolute bottom-24 right-8 z-30 flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Status Label (Image 1 & 2: "Speaking..." or "Listening...") */}
      <div className="mb-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/85 dark:bg-black/95 backdrop-blur-md border border-neutral-800 text-[11px] font-medium text-white shadow-md">
        {activeMeme ? (
          <Sparkles className="w-3 h-3 text-white animate-spin" style={{ animationDuration: '4s' }} />
        ) : (
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isPlayingAudio
                ? 'bg-white animate-pulse'
                : isListening
                ? 'bg-emerald-400 animate-ping'
                : 'bg-neutral-500'
            }`}
          />
        )}
        <span className="truncate max-w-[130px]">{labelText}</span>
      </div>

      {/* Main Circular Soundwave Orb with Concentric Ripples */}
      <div className="relative flex items-center justify-center group">
        {/* Concentric Ambient Glow Rings (Images 1 & 2) */}
        <div className="absolute -inset-2.5 rounded-full border border-white/5 pointer-events-none" />
        <div
          className={`absolute -inset-1 rounded-full border pointer-events-none transition-all duration-300 ${
            isPlayingAudio
              ? 'border-white/20 animate-pulse'
              : isListening
              ? 'border-white/15'
              : 'border-white/5'
          }`}
        />

        {/* The Core Orb Button (Clicking expands to Fullscreen Voice Mode) */}
        <button
          onClick={onExpandFullscreen}
          className={`relative w-14 h-14 rounded-full bg-neutral-950 border transition-all duration-300 shadow-2xl flex items-center justify-center cursor-pointer group-hover:scale-105 active:scale-95 ${
            isPlayingAudio
              ? 'border-white/80 shadow-[0_0_25px_rgba(255,255,255,0.3)] ring-2 ring-white/10'
              : isListening
              ? 'border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
              : 'border-neutral-700/80 hover:border-white/40'
          }`}
          title="Click to expand to Fullscreen Voice Mode"
        >
          {/* 5 Vertical Animated Equalizer Bars */}
          <div className="flex items-center gap-0.5 h-5 justify-center">
            <span
              className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
                isPlayingAudio ? 'animate-bounce h-2.5' : isListening ? 'h-2.5 animate-pulse' : 'h-1.5 opacity-40'
              }`}
              style={{ animationDuration: '600ms' }}
            />
            <span
              className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
                isPlayingAudio ? 'animate-bounce h-4.5' : isListening ? 'h-4.5 animate-pulse' : 'h-2.5 opacity-60'
              }`}
              style={{ animationDuration: '450ms', animationDelay: '100ms' }}
            />
            <span
              className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
                isPlayingAudio ? 'animate-bounce h-3.5' : isListening ? 'h-3.5 animate-pulse' : 'h-3'
              }`}
              style={{ animationDuration: '520ms', animationDelay: '50ms' }}
            />
            <span
              className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
                isPlayingAudio ? 'animate-bounce h-4' : isListening ? 'h-4 animate-pulse' : 'h-2 opacity-60'
              }`}
              style={{ animationDuration: '480ms', animationDelay: '150ms' }}
            />
            <span
              className={`w-0.5 bg-white rounded-full transition-all duration-150 ${
                isPlayingAudio ? 'animate-bounce h-2' : isListening ? 'h-2 animate-pulse' : 'h-1.5 opacity-40'
              }`}
              style={{ animationDuration: '580ms', animationDelay: '200ms' }}
            />
          </div>

          {/* Hover Overlay: Expand Fullscreen Hint */}
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-150">
            <Maximize2 className="w-3.5 h-3.5 text-white" />
          </div>
        </button>

        {/* Micro Action Buttons underneath */}
        <div className="absolute -bottom-6 flex items-center gap-1 bg-neutral-950/90 border border-neutral-800 rounded-full px-2 py-0.5 shadow-lg opacity-85 hover:opacity-100 transition-opacity">
          <button
            onClick={onToggleListening}
            className="p-1 text-neutral-400 hover:text-white transition active:scale-90"
            title={isListening ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isListening ? <Mic className="w-3 h-3 text-white" /> : <MicOff className="w-3 h-3 text-neutral-500" />}
          </button>

          {isPlayingAudio && (
            <button
              onClick={onInterrupt}
              className="p-1 text-neutral-400 hover:text-white transition active:scale-90"
              title="Interrupt speech"
            >
              <VolumeX className="w-3 h-3 text-white" />
            </button>
          )}

          <button
            onClick={onExpandFullscreen}
            className="p-1 text-neutral-400 hover:text-white transition active:scale-90"
            title="Expand to Fullscreen"
          >
            <Maximize2 className="w-3 h-3" />
          </button>

          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white transition active:scale-90"
            title="Close voice mode"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

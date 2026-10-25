import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Settings as SettingsIcon,
  Subtitles,
  PhoneOff,
  ChevronDown,
  ArrowLeft,
  VolumeX,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { SonicWaveformVisualizer } from './SonicWaveformVisualizer';
import { ActiveMemeInfo, PlaybackStatus } from '../hooks/useAudioPerformance';
import { Message } from '../types';

interface VoiceModeViewProps {
  onClose: () => void;
  onMinimize?: () => void;
  onOpenSettings: () => void;
  isListening: boolean;
  onToggleListening: () => void;
  onInterrupt: () => void;
  playbackStatus: PlaybackStatus;
  activeMeme: ActiveMemeInfo | null;
  analyserNode?: AnalyserNode | null;
  messages: Message[];
  transcript?: string;
  interimTranscript?: string;
}

/**
 * Fullscreen Advanced Voice Mode (ChatGPT Advanced Voice style)
 * Immersive, deep black aesthetic with organic fluid voice sphere.
 */
export const VoiceModeView: React.FC<VoiceModeViewProps> = ({
  onClose,
  onMinimize,
  onOpenSettings,
  isListening,
  onToggleListening,
  onInterrupt,
  playbackStatus,
  activeMeme,
  analyserNode,
  messages,
  transcript = '',
  interimTranscript = '',
}) => {
  const [showTranscript, setShowTranscript] = useState(false);

  // Derive visualizer state & clean status label
  let visualizerState: 'listening' | 'speaking' | 'processing' | 'idle' = 'idle';
  let statusText = 'Ready';

  const isPlayingAudio = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';

  if (isPlayingAudio) {
    visualizerState = 'speaking';
    statusText = 'Vadivelu is speaking…';
  } else if (playbackStatus === 'preparing') {
    visualizerState = 'processing';
    statusText = 'Thinking…';
  } else if (isListening) {
    visualizerState = 'listening';
    statusText = 'Listening…';
  } else {
    statusText = 'Microphone muted';
  }

  const liveText = interimTranscript || transcript;

  return (
    <div className="relative w-full h-screen max-h-screen bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <div className="h-16 px-6 flex items-center justify-between z-20 shrink-0 border-b border-neutral-900 backdrop-blur-md bg-black/90">
        {/* Left: Back to Chat */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition"
            title="Return to Chat"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
        </div>

        {/* Center: Title with live status dot */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isPlayingAudio
                ? 'bg-white animate-pulse'
                : isListening
                ? 'bg-emerald-400 animate-ping'
                : 'bg-neutral-600'
            }`}
          />
          <span className="text-xs font-semibold tracking-wider uppercase text-neutral-200">
            Vadivelu AI Voice
          </span>
        </div>

        {/* Right: Interrupt & Minimize buttons */}
        <div className="flex items-center gap-2">
          {isPlayingAudio && (
            <button
              onClick={onInterrupt}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white border border-neutral-800 rounded-full text-xs font-semibold transition shadow-xs"
              title="Interrupt speech"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Interrupt</span>
            </button>
          )}

          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white border border-neutral-800 transition shadow-xs"
              title="Minimize to floating pill"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center: Fluid Organic Voice Sphere Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-6 bg-black">
        {/* Fluid Voice Orb Canvas */}
        <div className="relative w-80 h-80 flex items-center justify-center">
          <SonicWaveformVisualizer
            analyserNode={analyserNode}
            isActive={isListening || playbackStatus !== 'idle'}
            state={visualizerState}
            isDarkTheme={true}
            className="w-full h-full"
          />
        </div>

        {/* Dynamic Reaction Meme Banner (If authentic movie audio is playing) */}
        <div className="h-10 flex items-center justify-center mt-3">
          {activeMeme && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-neutral-900/90 border border-neutral-800 rounded-full shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              {activeMeme.thumbnailUrl ? (
                <img
                  src={activeMeme.thumbnailUrl}
                  alt={activeMeme.title || 'Meme'}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-neutral-700"
                />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: '4s' }} />
              )}
              <span className="text-xs font-semibold text-white truncate max-w-[260px]">
                {activeMeme.title || activeMeme.memeId}
              </span>
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <div className="text-sm font-semibold tracking-wide text-neutral-300 mt-2 text-center">
          {statusText}
        </div>

        {/* Live speech transcription subtitle preview */}
        {liveText ? (
          <div className="max-w-md px-4 py-1.5 mt-3 bg-neutral-900/80 border border-neutral-800 rounded-full text-xs text-neutral-300 text-center animate-in fade-in truncate">
            "{liveText}"
          </div>
        ) : (
          <div className="h-6" />
        )}
      </div>

      {/* Transcript Drawer Overlay */}
      {showTranscript && (
        <div className="absolute inset-x-0 bottom-24 top-16 z-30 bg-black/95 backdrop-blur-2xl border-t border-neutral-900 p-6 flex flex-col animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
            <h3 className="text-sm font-semibold text-white">Live Conversation Transcript</h3>
            <button
              onClick={() => setShowTranscript(false)}
              className="p-1 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-10">No messages yet. Speak to begin!</p>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-neutral-500 mb-1 capitalize font-mono">{msg.role}</span>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
                      msg.role === 'user'
                        ? 'bg-white text-black font-medium'
                        : 'bg-neutral-900 border border-neutral-800 text-white leading-relaxed'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Control Bar (ChatGPT Advanced Voice Mode style) */}
      <div className="h-24 bg-gradient-to-t from-black via-black/90 to-transparent px-8 flex items-center justify-center gap-6 z-20 shrink-0">
        {/* Subtitles / Transcript Toggle */}
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
            showTranscript
              ? 'bg-white text-black shadow-lg'
              : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
          }`}
          title="Toggle Subtitles / Transcript"
        >
          <Subtitles className="w-5 h-5" />
        </button>

        {/* Center Primary Mic Mute / Unmute Button */}
        <button
          onClick={onToggleListening}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 shadow-2xl ${
            isListening
              ? 'bg-white text-black ring-4 ring-white/20 shadow-[0_0_30px_rgba(255,255,255,0.25)] scale-105'
              : 'bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title={isListening ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isListening ? (
            <Mic className="w-7 h-7 text-black stroke-[2.2]" />
          ) : (
            <MicOff className="w-7 h-7 text-neutral-400" />
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white border border-neutral-800 transition"
          title="Voice Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>

        {/* End Voice Chat */}
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-neutral-900 hover:bg-red-500/20 active:scale-95 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-500/30 transition"
          title="End Voice Chat"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

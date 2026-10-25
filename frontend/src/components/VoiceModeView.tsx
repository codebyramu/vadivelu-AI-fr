import React, { useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { SonicWaveformVisualizer } from './SonicWaveformVisualizer';
import { ActiveMemeInfo, PlaybackStatus } from '../hooks/useAudioPerformance';
import { Message } from '../types';

interface VoiceModeViewProps {
  onClose: () => void;
  onMinimize?: () => void;
  onOpenSettings?: () => void;
  isListening: boolean;
  onToggleListening: () => void;
  onInterrupt: () => void;
  playbackStatus: PlaybackStatus;
  activeMeme: ActiveMemeInfo | null;
  analyserNode?: AnalyserNode | null;
  messages: Message[];
  transcript?: string;
  interimTranscript?: string;
  onPlayMessageAudio?: (msg: Message) => void;
}

/**
 * Fullscreen Voice Mode View (Strictly matching user Image 3)
 * Displays top status header, scrolling chat messages with voice badges,
 * centered fluid voice orb with 5 soundwave bars, 3 circular action buttons,
 * and bottom response hint capsule.
 */
export const VoiceModeView: React.FC<VoiceModeViewProps> = ({
  onClose,
  onMinimize,
  isListening,
  onToggleListening,
  onInterrupt,
  playbackStatus,
  activeMeme,
  analyserNode,
  messages,
  transcript = '',
  interimTranscript = '',
  onPlayMessageAudio,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isPlayingAudio = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';

  let statusText = 'Ready';
  if (activeMeme) {
    statusText = activeMeme.title || activeMeme.memeId;
  } else if (isPlayingAudio) {
    statusText = 'Vadivelu is speaking…';
  } else if (playbackStatus === 'preparing') {
    statusText = 'Preparing…';
  } else if (isListening) {
    statusText = 'Listening...';
  } else {
    statusText = 'Microphone muted';
  }

  // Scroll messages to bottom smoothly as new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="relative w-full h-screen max-h-screen bg-black text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Top Header Bar (Image 3: "• VADIVELU AI VOICE") */}
      <div className="h-14 px-6 flex items-center justify-between z-20 shrink-0 border-b border-neutral-900 bg-black">
        {/* Left: Spacer or Back */}
        <div className="w-20">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition p-1.5 rounded-lg hover:bg-neutral-900"
              title="Minimize to In-Chat mode"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Minimize</span>
            </button>
          )}
        </div>

        {/* Center: Live Status Indicator (Image 3) */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPlayingAudio
                ? 'bg-white animate-pulse'
                : isListening
                ? 'bg-emerald-500 animate-ping'
                : 'bg-neutral-600'
            }`}
          />
          <span className="text-xs font-semibold tracking-widest uppercase text-neutral-200">
            VADIVELU AI VOICE
          </span>
        </div>

        {/* Right: Close button */}
        <div className="w-20 flex justify-end">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition"
            title="Exit Fullscreen Voice"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Conversation Stream (Image 3) */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-neutral-600 text-xs">
            Speak naturally to start conversation with Vadivelu...
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end animate-in fade-in slide-in-from-bottom-1">
                  <div className="bg-neutral-900/90 border border-neutral-800 text-white rounded-2xl px-4 py-2.5 text-xs font-medium flex items-center gap-2 shadow-xs max-w-[80%]">
                    <Mic className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>{msg.content}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start animate-in fade-in slide-in-from-bottom-1">
                <div className="max-w-[85%] bg-neutral-900/80 border border-neutral-800/90 text-neutral-200 rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2 shadow-xs">
                  <div>{msg.content}</div>

                  {/* Action Icons underneath Assistant message (Image 3) */}
                  <div className="flex items-center gap-3 pt-1 text-neutral-500">
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="hover:text-white transition"
                      title="Copy message"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button className="hover:text-white transition" title="Thumbs up">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="hover:text-white transition" title="Thumbs down">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                    {onPlayMessageAudio && (
                      <button
                        onClick={() => onPlayMessageAudio(msg)}
                        className="hover:text-white transition"
                        title="Replay audio"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Live speech transcription bubble (while speaking) */}
        {(interimTranscript || transcript) && (
          <div className="flex justify-end animate-in fade-in">
            <div className="bg-neutral-900/60 border border-neutral-800 text-neutral-400 rounded-2xl px-4 py-2 text-xs flex items-center gap-2 italic">
              <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>"{interimTranscript || transcript}"</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Interaction & Controls Area (Image 3) */}
      <div className="shrink-0 flex flex-col items-center pb-8 pt-2 bg-gradient-to-t from-black via-black/95 to-transparent">
        {/* Dynamic Meme Banner (if authentic dialogue clip is playing) */}
        {activeMeme && (
          <div className="mb-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-white shadow-lg animate-in fade-in zoom-in-95">
            <Sparkles className="w-3.5 h-3.5 text-white animate-spin" style={{ animationDuration: '4s' }} />
            <span className="font-semibold text-[11px] truncate max-w-[240px]">
              {activeMeme.title || activeMeme.memeId}
            </span>
          </div>
        )}

        {/* Fluid Voice Orb with 5 Animated Equalizer Bars in the center (Image 3) */}
        <div className="relative w-44 h-44 flex items-center justify-center">
          <SonicWaveformVisualizer
            analyserNode={analyserNode}
            isActive={isListening || playbackStatus !== 'idle'}
            state={isPlayingAudio ? 'speaking' : isListening ? 'listening' : 'idle'}
            isDarkTheme={true}
            className="w-full h-full"
          />

          {/* 5 Vertical Animated Equalizer Bars in the center of the orb (Image 3) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1 h-7">
              <span
                className={`w-1 bg-white rounded-full transition-all duration-150 ${
                  isPlayingAudio ? 'animate-bounce h-3.5' : isListening ? 'h-3.5 animate-pulse' : 'h-1.5 opacity-40'
                }`}
                style={{ animationDuration: '600ms' }}
              />
              <span
                className={`w-1 bg-white rounded-full transition-all duration-150 ${
                  isPlayingAudio ? 'animate-bounce h-6.5' : isListening ? 'h-6.5 animate-pulse' : 'h-2.5 opacity-60'
                }`}
                style={{ animationDuration: '450ms', animationDelay: '100ms' }}
              />
              <span
                className={`w-1 bg-white rounded-full transition-all duration-150 ${
                  isPlayingAudio ? 'animate-bounce h-5' : isListening ? 'h-5 animate-pulse' : 'h-3.5'
                }`}
                style={{ animationDuration: '520ms', animationDelay: '50ms' }}
              />
              <span
                className={`w-1 bg-white rounded-full transition-all duration-150 ${
                  isPlayingAudio ? 'animate-bounce h-6' : isListening ? 'h-6 animate-pulse' : 'h-2 opacity-60'
                }`}
                style={{ animationDuration: '480ms', animationDelay: '150ms' }}
              />
              <span
                className={`w-1 bg-white rounded-full transition-all duration-150 ${
                  isPlayingAudio ? 'animate-bounce h-3' : isListening ? 'h-3 animate-pulse' : 'h-1.5 opacity-40'
                }`}
                style={{ animationDuration: '580ms', animationDelay: '200ms' }}
              />
            </div>
          </div>
        </div>

        {/* Status Text under Orb (Image 3: "Listening...") */}
        <div className="text-sm font-medium tracking-wide text-neutral-300 mt-1 text-center">
          {statusText}
        </div>

        {/* 3 Circular Action Controls (Image 3: MicOff, Large White Mic, Red PhoneOff) */}
        <div className="flex items-center gap-5 mt-4">
          {/* 1. Mic Mute Toggle (Left dark circular button) */}
          <button
            onClick={onToggleListening}
            className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition active:scale-95 shadow-md"
            title={isListening ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isListening ? (
              <MicOff className="w-5 h-5 text-neutral-400" />
            ) : (
              <Mic className="w-5 h-5 text-emerald-400" />
            )}
          </button>

          {/* 2. Primary Large White Mic Button (Center button) */}
          <button
            onClick={onToggleListening}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 shadow-2xl ${
              isListening
                ? 'bg-white text-black ring-4 ring-white/20 shadow-[0_0_25px_rgba(255,255,255,0.3)]'
                : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700'
            }`}
            title="Tap to talk"
          >
            <Mic className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* 3. Red End Call Button (Right red circular button) */}
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl flex items-center justify-center transition active:scale-95"
            title="End voice chat"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Capsule Hint (Image 3: "Keep talking... I'm listening and ready to respond.") */}
        <div className="mt-4">
          <span className="inline-block px-5 py-2 rounded-full bg-neutral-950/90 border border-neutral-800/90 text-neutral-400 text-xs shadow-inner">
            Keep talking... I'm listening and ready to respond.
          </span>
        </div>
      </div>
    </div>
  );
};

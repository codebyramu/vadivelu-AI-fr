import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Pause, Square, Settings as SettingsIcon, Subtitles, PhoneOff, ChevronDown, ArrowLeft } from 'lucide-react';
import { SonicWaveformVisualizer } from './SonicWaveformVisualizer';
import { ActiveMemeInfo, PlaybackStatus } from '../hooks/useAudioPerformance';
import { Message } from '../types';

interface VoiceModeViewProps {
  onClose: () => void;
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

export const VoiceModeView: React.FC<VoiceModeViewProps> = ({
  onClose,
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

  // Derive visualizer state
  let visualizerState: 'listening' | 'speaking' | 'processing' | 'idle' = 'idle';
  let statusText = '• Ready';

  if (playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme') {
    visualizerState = 'speaking';
    statusText = '• Speaking...';
  } else if (playbackStatus === 'preparing') {
    visualizerState = 'processing';
    statusText = '• Preparing audio…';
  } else if (isListening) {
    visualizerState = 'listening';
    statusText = '• Listening...';
  }

  // Active meme card info (only display when real meme is playing)
  const displayMeme = activeMeme;

  return (
    <div className="relative w-full h-screen max-h-screen bg-[#07090e] starry-bg text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Bar (Clean minimal desktop style, no colored dots) */}
      <div className="h-14 px-6 flex items-center justify-between z-20 shrink-0 border-b border-gray-800/40 backdrop-blur-sm">
        {/* Left: Back button & title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white border border-gray-700/50 text-xs font-medium transition shadow-sm"
            title="Return to Chat"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Chat</span>
          </button>
          <span className="text-xs font-semibold text-gray-300 tracking-wide">
            AI Voice Chat
          </span>
        </div>

        {/* Right Action Pills */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onInterrupt}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#18202e] hover:bg-[#202b3d] active:scale-95 text-gray-200 border border-gray-700/60 rounded-full text-xs font-medium transition shadow-sm"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Interrupt</span>
          </button>
          <button
            onClick={onToggleListening}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2a1518]/90 hover:bg-[#381c20] active:scale-95 text-[#f87171] border border-red-500/30 rounded-full text-xs font-medium transition shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{isListening ? 'Stop Listening' : 'Start Listening'}</span>
          </button>
        </div>
      </div>

      {/* Center Visualizer & Interaction Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        {/* Massive Glowing Sonic Waveform Canvas */}
        <div className="relative flex items-center justify-center -mt-6">
          <SonicWaveformVisualizer
            analyserNode={analyserNode}
            isActive={isListening || playbackStatus !== 'idle'}
            state={visualizerState}
            isDarkTheme={true}
          />
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-200 mt-1 tracking-wide animate-pulse-subtle">
          <span>{statusText}</span>
        </div>

        {/* Dynamic Reaction Meme Card */}
        <div className="h-12 flex items-center justify-center mt-3">
          {displayMeme ? (
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-[#121927]/90 border border-[#233247] rounded-full shadow-2xl backdrop-blur animate-in fade-in zoom-in-95 duration-200">
              {displayMeme.thumbnailUrl ? (
                <img
                  src={displayMeme.thumbnailUrl}
                  alt={displayMeme.title || 'Meme'}
                  className="w-6 h-6 rounded-md object-cover ring-1 ring-blue-500/50"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-[10px] font-bold">
                  🎭
                </div>
              )}
              <span className="text-xs font-medium text-gray-200">
                Playing {displayMeme.title || displayMeme.memeId} meme
              </span>
            </div>
          ) : (
            <div className="h-6" />
          )}
        </div>

        {/* Live speech transcription preview */}
        {(transcript || interimTranscript) && (
          <div className="max-w-md px-4 py-2 mt-2 bg-[#121824]/80 border border-gray-800 rounded-2xl text-xs text-blue-200 text-center animate-in fade-in">
            <span>"{transcript} {interimTranscript}"</span>
          </div>
        )}

        {/* Glowing Microphone Button */}
        <div className="flex flex-col items-center mt-4">
          <button
            onClick={onToggleListening}
            className={`relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-b from-[#1a73e8] to-[#0d47a1] ring-4 ring-blue-500/30 shadow-[0_0_40px_rgba(26,115,232,0.6)] scale-105'
                : 'bg-gradient-to-b from-gray-700 to-gray-850 ring-2 ring-gray-600 hover:ring-blue-500/50'
            }`}
          >
            {/* Concentric subtle pulsing ring */}
            {isListening && (
              <span className="absolute inset-0 rounded-full ring-2 ring-blue-400/40 animate-ping opacity-60 pointer-events-none" />
            )}
            {isListening ? (
              <Mic className="w-8 h-8 text-white" />
            ) : (
              <MicOff className="w-8 h-8 text-gray-400 group-hover:text-white transition" />
            )}
          </button>

          <span className="text-xs font-medium text-[#60a5fa] mt-3 tracking-wide">
            {isListening ? 'Microphone on • Listening actively' : 'Microphone muted • Tap to talk'}
          </span>
        </div>
      </div>

      {/* Transcript Drawer Overlay */}
      {showTranscript && (
        <div className="absolute inset-x-0 bottom-16 top-16 z-30 bg-[#0e131d]/95 backdrop-blur-xl border-t border-gray-800 p-6 flex flex-col animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-200">Live Voice Transcript</h3>
            <button
              onClick={() => setShowTranscript(false)}
              className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-10">No messages yet. Speak to begin!</p>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-gray-500 mb-1 capitalize">{msg.role}</span>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-200'
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

      {/* Bottom Dock */}
      <div className="h-16 border-t border-gray-800/80 bg-[#080b11]/90 backdrop-blur-md px-12 flex items-center justify-around text-gray-400 z-20 shrink-0">
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center gap-1 hover:text-gray-200 transition group"
        >
          <SettingsIcon className="w-4 h-4 group-hover:rotate-45 transition duration-300" />
          <span className="text-[11px] font-medium">Settings</span>
        </button>

        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className={`flex flex-col items-center gap-1 transition ${
            showTranscript ? 'text-blue-400' : 'hover:text-gray-200'
          }`}
        >
          <Subtitles className="w-4 h-4" />
          <span className="text-[11px] font-medium">Transcript</span>
        </button>

        <button
          onClick={onClose}
          className="flex flex-col items-center gap-1 hover:text-red-400 transition"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="text-[11px] font-medium">End Chat</span>
        </button>
      </div>
    </div>
  );
};

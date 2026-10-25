import React from 'react';
import { Volume2, VolumeX, Sparkles, Pause } from 'lucide-react';
import { PerformancePlan, PerformanceSegment } from '../types';
import { ActiveMemeInfo, PlaybackStatus } from '../hooks/useAudioPerformance';

interface PlaybackProgressBarProps {
  performance?: PerformancePlan | null;
  playbackStatus: PlaybackStatus;
  activeMeme: ActiveMemeInfo | null;
  onInterrupt: () => void;
  isDarkTheme: boolean;
  className?: string;
}

export const PlaybackProgressBar: React.FC<PlaybackProgressBarProps> = ({
  performance,
  playbackStatus,
  activeMeme,
  onInterrupt,
  isDarkTheme,
  className = '',
}) => {
  const isPlaying = playbackStatus === 'playing_speech' || playbackStatus === 'playing_meme';
  const isPreparing = playbackStatus === 'preparing';

  if (!isPlaying && !isPreparing) return null;

  const segments: PerformanceSegment[] = performance?.segments || [];

  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl border text-xs shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 select-none ${
        isDarkTheme
          ? 'bg-neutral-900/90 border-neutral-700/80 text-white'
          : 'bg-white/95 border-neutral-200 text-black'
      } ${className}`}
    >
      {/* Equalizer animation icon */}
      <div className="flex items-center gap-0.5 h-3.5 px-1 shrink-0">
        <span className="w-0.5 h-full bg-current rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
        <span className="w-0.5 h-2/3 bg-current rounded-full animate-[pulse_0.8s_ease-in-out_infinite_0.2s]" />
        <span className="w-0.5 h-4/5 bg-current rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.4s]" />
      </div>

      {/* Label and Segment Timeline */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className="truncate">
            {isPreparing
              ? 'Buffering speech & meme audio…'
              : playbackStatus === 'playing_meme'
                ? `Playing meme: ${activeMeme?.title || 'Vadivelu Reaction'}`
                : 'Speaking response…'}
          </span>
          <span className="text-[10px] opacity-60 ml-2 shrink-0">
            {segments.length > 0 ? `${segments.length} segments` : 'Audio live'}
          </span>
        </div>

        {/* Segmented Timeline Indicator */}
        {segments.length > 0 && (
          <div className="flex items-center gap-1.5 h-1.5 w-full">
            {segments.map((seg, idx) => {
              const isMeme = seg.type === 'meme';
              const isActive =
                (isMeme && playbackStatus === 'playing_meme') ||
                (!isMeme && playbackStatus === 'playing_speech');

              return (
                <div
                  key={idx}
                  className={`h-full rounded-full transition-all duration-300 ${
                    isMeme ? 'flex-[1.5]' : 'flex-1'
                  } ${
                    isActive
                      ? isDarkTheme
                        ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                        : 'bg-black shadow-[0_0_8px_rgba(0,0,0,0.4)]'
                      : isDarkTheme
                        ? 'bg-neutral-800'
                        : 'bg-neutral-200'
                  }`}
                  title={isMeme ? 'Vadivelu Meme Clip' : 'Spoken Speech Segment'}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Stop / Interrupt Button */}
      <button
        onClick={onInterrupt}
        className={`p-1.5 rounded-full transition active:scale-90 ${
          isDarkTheme
            ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white'
            : 'hover:bg-neutral-100 text-neutral-700 hover:text-black'
        }`}
        title="Stop voice playback"
        data-cursor-text="Stop"
      >
        <VolumeX className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

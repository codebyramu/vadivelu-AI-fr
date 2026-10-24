import { useState, useRef, useCallback, useEffect } from 'react';
import { PerformancePlan, PerformanceSegment, MemeSegment, VoiceGender } from '../types';
import { api } from '../services/api';

export interface ActiveMemeInfo {
  memeId: string;
  title?: string;
  thumbnailUrl?: string;
}

export type PlaybackStatus = 'idle' | 'preparing' | 'playing_speech' | 'playing_meme' | 'paused' | 'interrupted';

export function useAudioPerformance(options?: {
  defaultSpeechVolume?: number;
  defaultMemeVolume?: number;
  onFinished?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [activeMeme, setActiveMeme] = useState<ActiveMemeInfo | null>(null);
  const [currentSegment, setCurrentSegment] = useState<PerformanceSegment | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [totalSegments, setTotalSegments] = useState(0);
  const [speechVolume, setSpeechVolume] = useState(options?.defaultSpeechVolume ?? 0.9);
  const [memeVolume, setMemeVolume] = useState(options?.defaultMemeVolume ?? 1.0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const speechVolumeRef = useRef(speechVolume);
  const memeVolumeRef = useRef(memeVolume);

  useEffect(() => {
    speechVolumeRef.current = speechVolume;
    if (activeAudioRef.current && status === 'playing_speech') {
      activeAudioRef.current.volume = speechVolume;
    }
  }, [speechVolume, status]);

  useEffect(() => {
    memeVolumeRef.current = memeVolume;
    if (activeAudioRef.current && status === 'playing_meme') {
      activeAudioRef.current.volume = memeVolume;
    }
  }, [memeVolume, status]);

  // Initialize Web Audio Context and AnalyserNode
  const getAudioContextAndAnalyser = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyser.connect(ctx.destination);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return { ctx: audioContextRef.current, analyser: analyserRef.current };
  }, []);

  // Stop / Interruption
  const interrupt = useCallback(() => {
    isCancelledRef.current = true;
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      activeAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setStatus('interrupted');
    setActiveMeme(null);
    setCurrentSegment(null);
    setCurrentSegmentIndex(-1);
    setTimeout(() => {
      setStatus('idle');
    }, 200);
  }, []);

  // Helper to play an HTMLAudioElement with ended promise
  const playAudioUrl = useCallback((url: string, volume: number): Promise<void> => {
    return new Promise((resolve) => {
      if (isCancelledRef.current) {
        resolve();
        return;
      }

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = url;
      audio.volume = Math.max(0, Math.min(1, volume));
      activeAudioRef.current = audio;

      // Connect to Web Audio Analyser
      const { ctx, analyser } = getAudioContextAndAnalyser();
      if (ctx && analyser) {
        try {
          const source = ctx.createMediaElementSource(audio);
          source.connect(analyser);
        } catch {
          // MediaElementAudioSource already connected or CORS
        }
      }

      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
      };

      const onEnded = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        resolve();
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      audio.play().catch(() => {
        // Audio playback failed (e.g. autoplay restriction or missing file)
        cleanup();
        resolve();
      });
    });
  }, [getAudioContextAndAnalyser]);

  // Fallback TTS using browser Web Speech API
  const speakWithBrowserSpeech = useCallback((text: string, voiceGender: VoiceGender = 'female'): Promise<void> => {
    return new Promise((resolve) => {
      if (isCancelledRef.current || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = voiceGender === 'female' ? 1.15 : 0.95;
      utterance.volume = speechVolumeRef.current;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const preferredVoice = voices.find(v => 
          (voiceGender === 'female' ? /female|woman|Samantha|Victoria|Google UK English Female/i : /male|man|Daniel|Alex|Google UK English Male/i).test(v.name)
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // Main playback executor
  const playPerformance = useCallback(async (plan: PerformancePlan) => {
    // Stop any existing playback
    interrupt();
    isCancelledRef.current = false;

    if (!plan || !plan.segments || plan.segments.length === 0) {
      return;
    }

    setIsPlaying(true);
    setStatus('preparing');
    setTotalSegments(plan.segments.length);

    // Phase 1: Preload / Synthesize all speech segment audio URLs
    const preparedSegments = [...plan.segments];
    for (let i = 0; i < preparedSegments.length; i++) {
      if (isCancelledRef.current) return;
      const seg = preparedSegments[i];
      if (seg.type === 'speech' && !seg.audioUrl) {
        try {
          const synthesizedUrl = await api.synthesizeTTS(seg.text, plan.voice || 'female');
          if (synthesizedUrl) {
            preparedSegments[i] = { ...seg, audioUrl: synthesizedUrl };
          }
        } catch {
          // Will use browser speech synthesis fallback during playback
        }
      }
    }

    if (isCancelledRef.current) return;

    // Phase 2: Sequential execution
    for (let i = 0; i < preparedSegments.length; i++) {
      if (isCancelledRef.current) break;

      const segment = preparedSegments[i];
      setCurrentSegmentIndex(i);
      setCurrentSegment(segment);

      if (segment.type === 'speech') {
        setStatus('playing_speech');
        setActiveMeme(null);

        if (segment.audioUrl) {
          await playAudioUrl(segment.audioUrl, speechVolumeRef.current);
        } else {
          await speakWithBrowserSpeech(segment.text, plan.voice);
        }
      } else if (segment.type === 'meme') {
        const memeSeg = segment as MemeSegment;
        setStatus('playing_meme');
        setActiveMeme({
          memeId: memeSeg.memeId,
          title: memeSeg.title || memeSeg.memeId,
          thumbnailUrl: memeSeg.thumbnailUrl,
        });

        // Determine audio url for meme
        let memeAudioUrl = memeSeg.audioUrl;
        if (!memeAudioUrl) {
          // If no direct url, try catalog audio
          memeAudioUrl = `/audio/memes/${memeSeg.memeId}.mp3`;
        }

        if (memeAudioUrl) {
          await playAudioUrl(memeAudioUrl, memeVolumeRef.current);
        } else {
          // Fallback short pause if audio file not loaded
          await new Promise(r => setTimeout(r, memeSeg.durationMs || 1500));
        }
      } else if (segment.type === 'pause') {
        setStatus('paused');
        await new Promise(r => setTimeout(r, segment.durationMs || 300));
      }
    }

    if (!isCancelledRef.current) {
      setIsPlaying(false);
      setStatus('idle');
      setActiveMeme(null);
      setCurrentSegment(null);
      setCurrentSegmentIndex(-1);
      options?.onFinished?.();
    }
  }, [interrupt, playAudioUrl, speakWithBrowserSpeech, options]);

  return {
    isPlaying,
    status,
    activeMeme,
    currentSegment,
    currentSegmentIndex,
    totalSegments,
    speechVolume,
    memeVolume,
    setSpeechVolume,
    setMemeVolume,
    playPerformance,
    interrupt,
    analyserNode: analyserRef.current,
    audioContext: audioContextRef.current,
    getAudioContextAndAnalyser,
  };
}

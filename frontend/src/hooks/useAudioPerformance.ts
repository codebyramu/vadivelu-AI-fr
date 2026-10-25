import { useState, useRef, useCallback, useEffect } from 'react';
import { PerformancePlan, PerformanceSegment, SpeechSegment, MemeSegment, VoiceGender } from '../types';
import { api } from '../services/api';
import { getGlobalAudioContext, unlockAudio } from '../services/audioUnlocker';

export interface ActiveMemeInfo {
  memeId: string;
  title?: string;
  thumbnailUrl?: string;
}

export type PlaybackStatus = 'idle' | 'preparing' | 'playing_speech' | 'playing_meme' | 'paused' | 'interrupted';

interface PreloadedItem {
  segment: PerformanceSegment;
  audio: HTMLAudioElement | null;
  textToSpeakFallback?: string;
}

export function useAudioPerformance(options?: {
  defaultSpeechVolume?: number;
  defaultMemeVolume?: number;
  onFinished?: () => void;
  onAutoplayBlocked?: (plan: PerformancePlan) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [activeMeme, setActiveMeme] = useState<ActiveMemeInfo | null>(null);
  const [currentSegment, setCurrentSegment] = useState<PerformanceSegment | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [totalSegments, setTotalSegments] = useState(0);
  const [speechVolume, setSpeechVolume] = useState(options?.defaultSpeechVolume ?? 0.9);
  const [memeVolume, setMemeVolume] = useState(options?.defaultMemeVolume ?? 1.0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PerformancePlan | null>(null);

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

  // Retrieve global AudioContext and AnalyserNode
  const getAudioContextAndAnalyser = useCallback(() => {
    const ctx = getGlobalAudioContext();
    if (ctx && !analyserRef.current) {
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
      } catch (err) {
        console.debug('Web Audio Analyser init:', err);
      }
    }
    return { ctx, analyser: analyserRef.current };
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
    setAutoplayBlocked(false);
    setTimeout(() => {
      setStatus('idle');
    }, 150);
  }, []);

  // Preload a single audio element into browser memory buffer
  const preloadAudio = useCallback((url: string, volume: number): Promise<HTMLAudioElement | null> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const audio = new Audio();
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      (audio as any).playsInline = true;
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.volume = Math.max(0, Math.min(1, volume));

      let resolved = false;
      const done = (element: HTMLAudioElement | null) => {
        if (!resolved) {
          resolved = true;
          audio.removeEventListener('canplaythrough', onReady);
          audio.removeEventListener('loadeddata', onReady);
          audio.removeEventListener('error', onError);
          resolve(element);
        }
      };

      const onReady = () => done(audio);
      const onError = () => done(null); // Fallback gracefully if asset is missing

      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('loadeddata', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });

      // 4-second timeout fallback
      setTimeout(() => done(audio), 4000);

      audio.src = url;
      audio.load();
    });
  }, []);

  // Play an already preloaded HTMLAudioElement and await completion
  const playPreloadedAudio = useCallback((
    audio: HTMLAudioElement,
    volume: number,
    parentPlan?: PerformancePlan
  ): Promise<void> => {
    return new Promise((resolve) => {
      if (isCancelledRef.current) {
        resolve();
        return;
      }

      audio.volume = Math.max(0, Math.min(1, volume));
      activeAudioRef.current = audio;

      // Only route into Web Audio Analyser IF AudioContext is actually RUNNING.
      // If it's suspended or on mobile devices, do NOT hijack direct speaker output!
      const { ctx, analyser } = getAudioContextAndAnalyser();
      if (ctx && ctx.state === 'running' && analyser) {
        try {
          const source = ctx.createMediaElementSource(audio);
          source.connect(analyser);
        } catch {
          // Already connected or CORS policy
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

      audio.addEventListener('ended', onEnded, { once: true });
      audio.addEventListener('error', onError, { once: true });

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play was rejected by browser policy:', err);
          cleanup();
          // Detect if autoplay was blocked by mobile browser
          if (
            err?.name === 'NotAllowedError' ||
            err?.message?.toLowerCase().includes('interact') ||
            err?.message?.toLowerCase().includes('user gesture')
          ) {
            setAutoplayBlocked(true);
            if (parentPlan) {
              setPendingPlan(parentPlan);
              options?.onAutoplayBlocked?.(parentPlan);
            }
          }
          resolve();
        });
      }
    });
  }, [getAudioContextAndAnalyser, options]);

  // Fallback TTS using browser Web Speech API if audio synthesis was completely offline
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
        const preferredVoice =
          voices.find(v =>
            (voiceGender === 'female'
              ? /female|woman|Samantha|Victoria|Google UK English Female/i
              : /male|man|Daniel|Alex|Google UK English Male/i
            ).test(v.name)
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

  // Main playback executor: Preloads assets, unlocks audio, and plays smoothly
  const playPerformance = useCallback(async (plan: PerformancePlan) => {
    // 1. Interrupt any ongoing playback
    interrupt();
    isCancelledRef.current = false;
    setAutoplayBlocked(false);

    if (!plan || !plan.segments || plan.segments.length === 0) {
      return;
    }

    // Try unlocking Web Audio context
    await unlockAudio().catch(() => {});

    setIsPlaying(true);
    setStatus('preparing');
    setTotalSegments(plan.segments.length);

    // =========================================================================
    // PHASE 1: PRELOAD ALL AUDIO IN ADVANCE
    // =========================================================================
    try {
      const preloadPromises: Promise<PreloadedItem>[] = plan.segments.map(async (seg) => {
        if (isCancelledRef.current) {
          return { segment: seg, audio: null };
        }

        if (seg.type === 'speech') {
          let url = seg.audioUrl;
          const segmentVoice = (seg as SpeechSegment).voice || plan.voice || 'female';
          // If not pre-synthesized by server, synthesize now
          if (!url) {
            try {
              url = await api.synthesizeTTS(seg.text, segmentVoice);
            } catch (err) {
              loggerWarn('TTS synthesis error during preload:', err);
              url = undefined;
            }
          }

          if (url) {
            const preloadedAudio = await preloadAudio(url, speechVolumeRef.current);
            return { segment: seg, audio: preloadedAudio, textToSpeakFallback: seg.text };
          }
          return { segment: seg, audio: null, textToSpeakFallback: seg.text };
        }

        if (seg.type === 'meme') {
          const memeSeg = seg as MemeSegment;
          let memeUrl = memeSeg.audioUrl;
          if (!memeUrl) {
            memeUrl = `/memes/${memeSeg.memeId}.mp3`;
          }
          const preloadedAudio = await preloadAudio(memeUrl, memeVolumeRef.current);
          return { segment: seg, audio: preloadedAudio };
        }

        // Pause segment
        return { segment: seg, audio: null };
      });

      // Wait until audio assets are ready
      const preloadedItems = await Promise.all(preloadPromises);

      if (isCancelledRef.current) return;

      // =========================================================================
      // PHASE 2: SMOOTH SEQUENTIAL PLAYBACK
      // =========================================================================
      for (let i = 0; i < preloadedItems.length; i++) {
        if (isCancelledRef.current) break;

        const item = preloadedItems[i];
        const segment = item.segment;
        setCurrentSegmentIndex(i);
        setCurrentSegment(segment);

        if (segment.type === 'speech') {
          setStatus('playing_speech');
          setActiveMeme(null);

          if (item.audio) {
            await playPreloadedAudio(item.audio, speechVolumeRef.current, plan);
          } else if (item.textToSpeakFallback) {
            const segVoice = (segment as SpeechSegment).voice || plan.voice;
            await speakWithBrowserSpeech(item.textToSpeakFallback, segVoice);
          }
        } else if (segment.type === 'meme') {
          const memeSeg = segment as MemeSegment;
          setStatus('playing_meme');
          setActiveMeme({
            memeId: memeSeg.memeId,
            title: memeSeg.title || memeSeg.memeId,
            thumbnailUrl: memeSeg.thumbnailUrl,
          });

          if (item.audio) {
            await playPreloadedAudio(item.audio, memeVolumeRef.current, plan);
          } else {
            // Short delay if audio failed to load
            await new Promise((r) => setTimeout(r, memeSeg.durationMs || 1000));
          }
        } else if (segment.type === 'pause') {
          setStatus('paused');
          await new Promise((r) => setTimeout(r, segment.durationMs || 350));
        }
      }
    } catch (err) {
      console.error('Audio performance execution failed:', err);
    } finally {
      if (!isCancelledRef.current) {
        setIsPlaying(false);
        setStatus('idle');
        setActiveMeme(null);
        setCurrentSegment(null);
        setCurrentSegmentIndex(-1);
        options?.onFinished?.();
      }
    }
  }, [interrupt, preloadAudio, playPreloadedAudio, speakWithBrowserSpeech, options]);

  // Resume playback on user tap when browser autoplay blocked it
  const resumeBlockedPlayback = useCallback(async () => {
    if (pendingPlan) {
      setAutoplayBlocked(false);
      const plan = pendingPlan;
      setPendingPlan(null);
      await unlockAudio().catch(() => {});
      playPerformance(plan);
    }
  }, [pendingPlan, playPerformance]);

  return {
    isPlaying,
    status,
    activeMeme,
    currentSegment,
    currentSegmentIndex,
    totalSegments,
    speechVolume,
    memeVolume,
    autoplayBlocked,
    resumeBlockedPlayback,
    setSpeechVolume,
    setMemeVolume,
    playPerformance,
    interrupt,
    analyserNode: analyserRef.current,
    audioContext: getGlobalAudioContext(),
    getAudioContextAndAnalyser,
  };
}

function loggerWarn(...args: any[]) {
  if (typeof console !== 'undefined') console.warn(...args);
}

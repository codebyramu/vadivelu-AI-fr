import { useState, useRef, useEffect, useCallback } from 'react';

// Browser Web Speech API interfaces
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
  onerror: (event: SpeechRecognitionErrorEventLike) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

export interface UseSpeechRecognitionOptions {
  mode?: 'push_to_talk' | 'continuous';
  silenceTimeoutMs?: number;
  onSpeechResult?: (transcript: string, isFinal: boolean) => void;
  onFinalTranscript?: (transcript: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export function useSpeechRecognition({
  mode = 'push_to_talk',
  silenceTimeoutMs = 1800,
  onSpeechResult,
  onFinalTranscript,
  onSpeechStart,
  onSpeechEnd,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [micLevel, setMicLevel] = useState(0);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
    }
  }, []);

  // Cleanup timers and mic streams
  const cleanupMicStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    setMicLevel(0);
  }, []);

  // Initialize Microphone Web Audio Analyser for reactive visuals
  const initMicAudio = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = audioContextRef.current || new AudioCtx();
        audioContextRef.current = ctx;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        micAnalyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!micStreamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicLevel(avg / 128); // 0 to ~2
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }
    } catch (e) {
      console.warn('Microphone stream access not granted or unavailable:', e);
    }
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    cleanupMicStream();
    setIsListening(false);
    onSpeechEnd?.();
  }, [cleanupMicStream, onSpeechEnd]);

  const startListening = useCallback(async () => {
    setError(null);
    clearSilenceTimer();
    activeTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setIsSupported(false);
      return;
    }

    try {
      await initMicAudio();

      const rec = new SpeechRec();
      rec.continuous = mode === 'continuous';
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        onSpeechStart?.();
      };

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (currentFinal) {
          activeTranscriptRef.current += (activeTranscriptRef.current ? ' ' : '') + currentFinal.trim();
          setTranscript(activeTranscriptRef.current);
          onSpeechResult?.(activeTranscriptRef.current, true);
        }

        setInterimTranscript(currentInterim);
        if (currentInterim) {
          onSpeechResult?.(currentInterim, false);
        }

        // Handle silence in continuous mode
        if (mode === 'continuous') {
          clearSilenceTimer();
          silenceTimerRef.current = window.setTimeout(() => {
            const finalSpeech = activeTranscriptRef.current.trim() || currentInterim.trim();
            if (finalSpeech) {
              onFinalTranscript?.(finalSpeech);
              activeTranscriptRef.current = '';
              setTranscript('');
              setInterimTranscript('');
            }
          }, silenceTimeoutMs);
        }
      };

      rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
        if (e.error !== 'no-speech') {
          setError(`Speech error: ${e.error}`);
        }
      };

      rec.onend = () => {
        if (mode === 'continuous' && isListening) {
          // Restart recognition if continuous mode is still toggled on
          try {
            rec.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
          cleanupMicStream();
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start speech recognition');
      setIsListening(false);
      cleanupMicStream();
    }
  }, [mode, silenceTimeoutMs, onSpeechStart, onSpeechResult, onFinalTranscript, initMicAudio, cleanupMicStream, isListening]);

  // Push to talk release helper
  const handlePushToTalkEnd = useCallback(() => {
    stopListening();
    const finalSpeech = (activeTranscriptRef.current + ' ' + interimTranscript).trim();
    if (finalSpeech) {
      onFinalTranscript?.(finalSpeech);
    }
    activeTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, [stopListening, interimTranscript, onFinalTranscript]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      cleanupMicStream();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [cleanupMicStream]);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    micLevel,
    micAnalyser: micAnalyserRef.current,
    startListening,
    stopListening,
    handlePushToTalkEnd,
  };
}

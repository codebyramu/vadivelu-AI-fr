import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';

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
  const [isTranscribing, setIsTranscribing] = useState(false);

  const isListeningRef = useRef(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeTranscriptRef = useRef('');
  
  // MediaRecorder audio backup for 100% reliable backend Gemini transcription
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Check if either Web Speech API or getUserMedia is supported
    const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setIsSupported(hasWebSpeech || hasMediaDevices);
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

  // Process recorded audio fallback via Gemini STT backend
  const processAudioFallback = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];
    
    // Only transcribe if we don't already have text from Web Speech
    if (!activeTranscriptRef.current.trim() && audioBlob.size > 2000) {
      try {
        setIsTranscribing(true);
        const res = await api.transcribeAudio(audioBlob);
        if (res && res.transcript && res.transcript.trim()) {
          const text = res.transcript.trim();
          activeTranscriptRef.current = text;
          setTranscript(text);
          onFinalTranscript?.(text);
        }
      } catch (err) {
        console.warn('Backend audio transcription fallback failed:', err);
      } finally {
        setIsTranscribing(false);
      }
    }
  }, [onFinalTranscript]);

  // Initialize Microphone Web Audio Analyser and MediaRecorder
  const initMicAudio = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Initialize MediaRecorder for backend audio fallback
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        mediaRecorderRef.current = recorder;
      } catch (recErr) {
        console.warn('MediaRecorder init error:', recErr);
      }

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
      return stream;
    } catch (e) {
      console.warn('Microphone stream access not granted or unavailable:', e);
      return null;
    }
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    clearSilenceTimer();

    // Stop native recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Stop MediaRecorder and trigger fallback if needed
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    cleanupMicStream();
    setIsListening(false);
    onSpeechEnd?.();

    // If no text was recognized yet, attempt backend audio transcription
    setTimeout(() => {
      processAudioFallback();
    }, 200);
  }, [cleanupMicStream, onSpeechEnd, processAudioFallback]);

  const startListening = useCallback(async () => {
    setError(null);
    clearSilenceTimer();
    activeTranscriptRef.current = '';
    audioChunksRef.current = [];
    setTranscript('');
    setInterimTranscript('');
    isListeningRef.current = true;
    setIsListening(true);
    onSpeechStart?.();

    const stream = await initMicAudio();
    if (!stream) {
      setError('Microphone permission denied or no audio device found.');
      isListeningRef.current = false;
      setIsListening(false);
      return;
    }

    // Start audio backup recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      try {
        mediaRecorderRef.current.start(250);
      } catch (e) {
        console.warn('Could not start MediaRecorder:', e);
      }
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = mode === 'continuous';
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
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
          // If error occurs (e.g. Linux Chromium network error), fallback gracefully to MediaRecorder
          if (e.error !== 'no-speech') {
            console.warn(`Browser Speech Recognition error: ${e.error}. Will fallback to backend Gemini transcription.`);
          }
        };

        rec.onend = () => {
          if (mode === 'continuous' && isListeningRef.current) {
            // Restart recognition safely
            try {
              rec.start();
            } catch {
              // fallback remains active
            }
          } else if (!isListeningRef.current) {
            setIsListening(false);
            cleanupMicStream();
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (e: unknown) {
        console.warn('Native speech recognition failed to start, using MediaRecorder fallback:', e);
      }
    } else {
      console.info('Native SpeechRecognition unavailable, using MediaRecorder + Gemini STT.');
    }
  }, [mode, silenceTimeoutMs, onSpeechStart, onSpeechResult, onFinalTranscript, initMicAudio, cleanupMicStream]);

  // Push to talk release helper
  const handlePushToTalkEnd = useCallback(async () => {
    isListeningRef.current = false;
    clearSilenceTimer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    cleanupMicStream();
    setIsListening(false);
    onSpeechEnd?.();

    const finalSpeech = (activeTranscriptRef.current + ' ' + interimTranscript).trim();
    if (finalSpeech) {
      onFinalTranscript?.(finalSpeech);
      activeTranscriptRef.current = '';
      setTranscript('');
      setInterimTranscript('');
    } else {
      // Trigger Gemini audio fallback
      await processAudioFallback();
    }
  }, [cleanupMicStream, interimTranscript, onFinalTranscript, onSpeechEnd, processAudioFallback]);

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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
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
    isTranscribing,
    error,
    micLevel,
    micAnalyser: micAnalyserRef.current,
    startListening,
    stopListening,
    handlePushToTalkEnd,
  };
}

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
  silenceTimeoutMs = 1300,
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
  const [isSpeakingDetected, setIsSpeakingDetected] = useState(false);

  const isListeningRef = useRef(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const nativeFailedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeTranscriptRef = useRef('');

  // VAD tracking
  const hasSpokenInCurrentTurnRef = useRef(false);
  const lastSoundTimestampRef = useRef<number>(0);
  const isFinalizingTurnRef = useRef(false);
  const turnStartTimeRef = useRef<number>(0);

  // MediaRecorder audio capture
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setIsSupported(hasWebSpeech || hasMediaDevices);
  }, []);

  // Cleanup mic streams and Web Audio nodes
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
    setIsSpeakingDetected(false);
  }, []);

  // Helper to stop current MediaRecorder and get all accumulated audio bytes
  const stopRecorderAndGetBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: recorder?.mimeType || 'audio/webm' });
          audioChunksRef.current = [];
          resolve(blob);
        } else {
          resolve(null);
        }
        return;
      }

      recorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          audioChunksRef.current = [];
          resolve(blob);
        } else {
          resolve(null);
        }
      };

      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  // Helper to start a fresh MediaRecorder instance on the active stream
  const startNewRecorder = useCallback((stream: MediaStream) => {
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
      recorder.start(150);
      turnStartTimeRef.current = Date.now();
      return recorder;
    } catch (err) {
      console.warn('[Vadivelu Voice] Could not start MediaRecorder:', err);
      return null;
    }
  }, []);

  // Finalizes the current spoken utterance and dispatches it
  const finalizeSpeechTurn = useCallback(async () => {
    if (isFinalizingTurnRef.current) return;
    isFinalizingTurnRef.current = true;

    console.log('[Vadivelu Voice] Finalizing speech utterance...');

    // 1. If native WebSpeech provided text
    const nativeText = activeTranscriptRef.current.trim();
    if (nativeText) {
      console.log('[Vadivelu Voice] Dispatched native transcript:', nativeText);
      onFinalTranscript?.(nativeText);
      activeTranscriptRef.current = '';
      setTranscript(nativeText);
      setInterimTranscript('');
      hasSpokenInCurrentTurnRef.current = false;
      audioChunksRef.current = [];
      isFinalizingTurnRef.current = false;
      return;
    }

    // 2. Otherwise use MediaRecorder audio -> Gemini transcription backend
    const audioBlob = await stopRecorderAndGetBlob();
    hasSpokenInCurrentTurnRef.current = false;
    lastSoundTimestampRef.current = 0;

    if (audioBlob && audioBlob.size > 800) {
      console.log(`[Vadivelu Voice] Sending audio blob (${audioBlob.size} bytes, ${audioBlob.type}) to Gemini STT...`);
      try {
        setIsTranscribing(true);
        setInterimTranscript('Transcribing speech...');
        const res = await api.transcribeAudio(audioBlob);
        const recognizedText = res?.transcript?.trim();
        console.log('[Vadivelu Voice] Backend transcription result:', recognizedText);

        if (recognizedText && recognizedText.length > 0) {
          setTranscript(recognizedText);
          setInterimTranscript('');
          onFinalTranscript?.(recognizedText);
        } else {
          setInterimTranscript('');
        }
      } catch (err) {
        console.warn('[Vadivelu Voice] Backend audio transcription failed:', err);
        setInterimTranscript('');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      console.log('[Vadivelu Voice] Audio snippet too short, skipping empty audio.');
    }

    isFinalizingTurnRef.current = false;

    // In continuous mode, restart recorder for the next sentence if still listening
    if (mode === 'continuous' && isListeningRef.current && micStreamRef.current) {
      console.log('[Vadivelu Voice] Restarting recorder for continuous listening...');
      startNewRecorder(micStreamRef.current);
    }
  }, [mode, onFinalTranscript, stopRecorderAndGetBlob, startNewRecorder]);

  // Initialize Microphone Web Audio Analyser, VAD loop, and MediaRecorder
  const initMicAudio = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // Start MediaRecorder
      startNewRecorder(stream);

      // Web Audio Analyser
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

        const timeData = new Uint8Array(analyser.frequencyBinCount);
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        const updateLevelAndVAD = () => {
          if (!micStreamRef.current || !isListeningRef.current) return;

          // 1. Calculate RMS from time domain data
          analyser.getByteTimeDomainData(timeData);
          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sumSquares += v * v;
          }
          const rms = Math.sqrt(sumSquares / timeData.length);

          // 2. Calculate peak voice frequency
          analyser.getByteFrequencyData(freqData);
          let maxVoiceFreq = 0;
          for (let i = 1; i < 35 && i < freqData.length; i++) {
            if (freqData[i] > maxVoiceFreq) maxVoiceFreq = freqData[i];
          }

          const normalizedLevel = Math.min(rms * 4.5, 1.0);
          setMicLevel(normalizedLevel);

          const now = Date.now();
          // Voice Activity Detection threshold (whisper or speaking)
          const isSpeakingNow = rms > 0.015 || maxVoiceFreq > 18;

          if (isSpeakingNow) {
            hasSpokenInCurrentTurnRef.current = true;
            lastSoundTimestampRef.current = now;
            setIsSpeakingDetected(true);
          } else {
            setIsSpeakingDetected(false);
            if (hasSpokenInCurrentTurnRef.current && lastSoundTimestampRef.current > 0) {
              const silenceElapsed = now - lastSoundTimestampRef.current;
              // If user paused for silenceTimeoutMs after speaking
              if (silenceElapsed > silenceTimeoutMs && !isFinalizingTurnRef.current) {
                lastSoundTimestampRef.current = 0;
                finalizeSpeechTurn();
              }
            }
          }

          animationFrameRef.current = requestAnimationFrame(updateLevelAndVAD);
        };

        animationFrameRef.current = requestAnimationFrame(updateLevelAndVAD);
      }
      return stream;
    } catch (e) {
      console.warn('[Vadivelu Voice] Microphone access error:', e);
      return null;
    }
  }, [silenceTimeoutMs, finalizeSpeechTurn, startNewRecorder]);

  // Stop listening
  const stopListening = useCallback(async () => {
    console.log('[Vadivelu Voice] Stopping listening...');
    isListeningRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    setIsListening(false);
    onSpeechEnd?.();

    // If user spoke or we have audio chunks recorded, finalize and transcribe immediately
    if (hasSpokenInCurrentTurnRef.current || audioChunksRef.current.length > 0 || activeTranscriptRef.current) {
      await finalizeSpeechTurn();
    }

    cleanupMicStream();
  }, [cleanupMicStream, onSpeechEnd, finalizeSpeechTurn]);

  // Start listening
  const startListening = useCallback(async () => {
    console.log('[Vadivelu Voice] Starting listening...');
    setError(null);
    activeTranscriptRef.current = '';
    audioChunksRef.current = [];
    hasSpokenInCurrentTurnRef.current = false;
    lastSoundTimestampRef.current = 0;
    nativeFailedRef.current = false;
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

    // Attempt Native Speech Recognition if available
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec && !nativeFailedRef.current) {
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
            hasSpokenInCurrentTurnRef.current = true;
            lastSoundTimestampRef.current = Date.now();
          }

          setInterimTranscript(currentInterim);
          if (currentInterim) {
            onSpeechResult?.(currentInterim, false);
            hasSpokenInCurrentTurnRef.current = true;
            lastSoundTimestampRef.current = Date.now();
          }
        };

        rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
          if (e.error === 'network' || e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            console.warn(`[Vadivelu Voice] Native speech recognition unavailable (${e.error}). Falling back smoothly to VAD + Gemini Audio.`);
            nativeFailedRef.current = true;
            try { rec.abort(); } catch {}
            recognitionRef.current = null;
          }
        };

        rec.onend = () => {
          if (nativeFailedRef.current) return;
          if (mode === 'continuous' && isListeningRef.current) {
            try {
              rec.start();
            } catch {
              // fallback remains active
            }
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (e: unknown) {
        console.warn('[Vadivelu Voice] Native speech recognition failed to start, using VAD + Gemini:', e);
        nativeFailedRef.current = true;
      }
    }
  }, [mode, onSpeechStart, onSpeechResult, initMicAudio]);

  // Push to talk release helper
  const handlePushToTalkEnd = useCallback(async () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    setIsListening(false);
    onSpeechEnd?.();
    await finalizeSpeechTurn();
    cleanupMicStream();
  }, [cleanupMicStream, onSpeechEnd, finalizeSpeechTurn]);

  useEffect(() => {
    return () => {
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
    isSpeakingDetected,
    error,
    micLevel,
    micAnalyser: micAnalyserRef.current,
    startListening,
    stopListening,
    handlePushToTalkEnd,
  };
}

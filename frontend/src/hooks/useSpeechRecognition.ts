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
  silenceTimeoutMs = 1500,
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeTranscriptRef = useRef('');

  // VAD (Voice Activity Detection) tracking
  const hasSpokenInTurnRef = useRef(false);
  const lastSoundTimestampRef = useRef<number>(0);
  const isFinalizingTurnRef = useRef(false);

  // MediaRecorder audio backup for 100% reliable backend Gemini transcription
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
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

  // Finalizes the current spoken segment and sends either native text or audio to Gemini
  const finalizeSpeechTurn = useCallback(async () => {
    if (isFinalizingTurnRef.current) return;
    isFinalizingTurnRef.current = true;

    // 1. If native WebSpeech provided a transcript
    const nativeText = activeTranscriptRef.current.trim();
    if (nativeText) {
      onFinalTranscript?.(nativeText);
      activeTranscriptRef.current = '';
      setTranscript(nativeText);
      setInterimTranscript('');
      hasSpokenInTurnRef.current = false;
      audioChunksRef.current = [];
      isFinalizingTurnRef.current = false;
      return;
    }

    // 2. Otherwise use MediaRecorder audio -> Gemini transcription backend
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        // Stop current recorder to finalize current audio chunks
        recorder.stop();
      } catch {
        // ignore
      }
    }

    // Wait slightly for final ondataavailable event
    await new Promise(resolve => setTimeout(resolve, 80));

    const chunks = [...audioChunksRef.current];
    audioChunksRef.current = [];
    hasSpokenInTurnRef.current = false;

    if (chunks.length > 0) {
      const audioBlob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
      if (audioBlob.size > 1500) {
        try {
          setIsTranscribing(true);
          setInterimTranscript('Transcribing speech...');
          const res = await api.transcribeAudio(audioBlob);
          if (res && res.transcript && res.transcript.trim()) {
            const cleanText = res.transcript.trim();
            setTranscript(cleanText);
            setInterimTranscript('');
            onFinalTranscript?.(cleanText);
          } else {
            setInterimTranscript('');
          }
        } catch (err) {
          console.warn('Audio transcription error:', err);
          setInterimTranscript('');
        } finally {
          setIsTranscribing(false);
        }
      }
    }

    isFinalizingTurnRef.current = false;

    // In continuous mode, restart recording for next sentence if still listening
    if (mode === 'continuous' && isListeningRef.current && micStreamRef.current) {
      try {
        const stream = micStreamRef.current;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
        const newRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        newRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        mediaRecorderRef.current = newRecorder;
        newRecorder.start(200);
      } catch (err) {
        console.warn('Could not restart recorder in continuous mode:', err);
      }
    }
  }, [mode, onFinalTranscript]);

  // Initialize Microphone Web Audio Analyser, VAD, and MediaRecorder
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

      // Initialize MediaRecorder
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

      // Initialize Web Audio API Analyser for level visualization & VAD
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

        const updateLevelAndVAD = () => {
          if (!micStreamRef.current || !isListeningRef.current) return;
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalizedLevel = avg / 128;
          setMicLevel(normalizedLevel);

          const now = Date.now();
          // Speech energy threshold (voice activity detection)
          if (avg > 7.5) {
            hasSpokenInTurnRef.current = true;
            lastSoundTimestampRef.current = now;
          } else if (hasSpokenInTurnRef.current && lastSoundTimestampRef.current > 0) {
            // User had spoken, check silence duration
            const silenceElapsed = now - lastSoundTimestampRef.current;
            if (silenceElapsed > silenceTimeoutMs && !isFinalizingTurnRef.current) {
              lastSoundTimestampRef.current = 0;
              finalizeSpeechTurn();
            }
          }

          animationFrameRef.current = requestAnimationFrame(updateLevelAndVAD);
        };

        animationFrameRef.current = requestAnimationFrame(updateLevelAndVAD);
      }
      return stream;
    } catch (e) {
      console.warn('Microphone stream access not granted or unavailable:', e);
      return null;
    }
  }, [silenceTimeoutMs, finalizeSpeechTurn]);

  const stopListening = useCallback(async () => {
    isListeningRef.current = false;

    // Stop native recognition
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

    // Finalize speech if user was talking
    if (hasSpokenInTurnRef.current || audioChunksRef.current.length > 0 || activeTranscriptRef.current) {
      await finalizeSpeechTurn();
    }

    cleanupMicStream();
  }, [cleanupMicStream, onSpeechEnd, finalizeSpeechTurn]);

  const startListening = useCallback(async () => {
    setError(null);
    activeTranscriptRef.current = '';
    audioChunksRef.current = [];
    hasSpokenInTurnRef.current = false;
    lastSoundTimestampRef.current = 0;
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
        mediaRecorderRef.current.start(200);
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
            hasSpokenInTurnRef.current = true;
            lastSoundTimestampRef.current = Date.now();
          }

          setInterimTranscript(currentInterim);
          if (currentInterim) {
            onSpeechResult?.(currentInterim, false);
            hasSpokenInTurnRef.current = true;
            lastSoundTimestampRef.current = Date.now();
          }
        };

        rec.onerror = (e: SpeechRecognitionErrorEventLike) => {
          // Native Web Speech error on Linux Chromium / Brave: gracefully fallback to MediaRecorder + VAD
          if (e.error !== 'no-speech') {
            console.warn(`Native speech recognition error: ${e.error}. Using backend audio VAD transcription.`);
          }
        };

        rec.onend = () => {
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
        console.warn('Native speech recognition failed to start, using VAD + MediaRecorder:', e);
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
    error,
    micLevel,
    micAnalyser: micAnalyserRef.current,
    startListening,
    stopListening,
    handlePushToTalkEnd,
  };
}

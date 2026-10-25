/**
 * Global Audio Unlocker for Mobile Browsers (iOS Safari, Android Chrome).
 *
 * Browsers strictly restrict audio playback and AudioContext creation unless
 * initiated directly during a user touch/click gesture. This service:
 * 1. Synchronously initializes and unlocks a single global AudioContext on first gesture.
 * 2. Unlocks HTML5 <audio> element playback using a silent buffer.
 * 3. Keeps the shared AudioContext in 'running' state so subsequent async audio playback succeeds.
 */

let globalAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;
let unlockPromise: Promise<boolean> | null = null;

// Tiny 0.05s silent WAV audio data URI (valid PCM 8kHz mono)
const SILENT_WAV_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * Returns the single global AudioContext, creating it if needed.
 */
export function getGlobalAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!globalAudioCtx) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      try {
        globalAudioCtx = new AudioCtxClass();
      } catch (e) {
        console.warn('Failed to construct AudioContext:', e);
      }
    }
  }

  // If already created and suspended, try resuming
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }

  return globalAudioCtx;
}

/**
 * Unlocks audio playback for the browser session.
 * MUST be callable synchronously in touch/click event handlers.
 */
export function unlockAudio(): Promise<boolean> {
  if (isAudioUnlocked && globalAudioCtx && globalAudioCtx.state === 'running') {
    return Promise.resolve(true);
  }

  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      // 1. Resume / create Web Audio context
      const ctx = getGlobalAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // 2. Play a brief silent HTML5 audio element
      const silentAudio = new Audio(SILENT_WAV_URI);
      silentAudio.setAttribute('playsinline', 'true');
      (silentAudio as any).playsInline = true;
      silentAudio.volume = 0.01;

      await silentAudio.play().then(() => {
        silentAudio.pause();
        silentAudio.src = '';
      }).catch((err) => {
        // Autoplay may still be waiting for direct gesture
        console.debug('Silent audio unlock attempt:', err?.message || err);
      });

      isAudioUnlocked = true;
      return true;
    } catch (err) {
      console.warn('Audio unlock encountered error:', err);
      return false;
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

/**
 * Synchronous audio unlock trigger for touch/click listeners.
 */
export function unlockAudioSync() {
  if (typeof window === 'undefined') return;

  const ctx = getGlobalAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // Pre-instantiate a dummy audio to activate iOS media pipeline
  try {
    const dummy = new Audio(SILENT_WAV_URI);
    dummy.setAttribute('playsinline', 'true');
    (dummy as any).playsInline = true;
    const p = dummy.play();
    if (p) {
      p.then(() => {
        dummy.pause();
        isAudioUnlocked = true;
      }).catch(() => {});
    }
  } catch {
    // Ignore
  }
}

// Auto-register touch/click listeners on client startup to unlock immediately
if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    unlockAudioSync();
    unlockAudio();
  };

  const opts = { capture: true, passive: true };
  window.addEventListener('touchstart', handleInteraction, opts);
  window.addEventListener('touchend', handleInteraction, opts);
  window.addEventListener('click', handleInteraction, opts);
  window.addEventListener('pointerdown', handleInteraction, opts);
  window.addEventListener('keydown', handleInteraction, opts);
}

export function isAudioGloballyUnlocked(): boolean {
  return isAudioUnlocked && (!globalAudioCtx || globalAudioCtx.state === 'running');
}

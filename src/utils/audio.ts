// src/utils/audio.ts

let audioCtx: AudioContext | null = null;
let trumpetBuffer: AudioBuffer | null = null;
let beepBuffer: AudioBuffer | null = null;
let isUnlocked = false;
let isFetching = false;

export function initAudio() {
  if (typeof window === 'undefined') return;

  // 1. Inizializza il contesto AudioContext
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  // 2. Pre-carica i file audio in ArrayBuffer e decodifica in AudioBuffer (Web Audio API pura)
  if (audioCtx && !isFetching && (!trumpetBuffer || !beepBuffer)) {
    isFetching = true;
    Promise.all([
      fetch('/timer-end.mp3')
        .then((res) => res.arrayBuffer())
        .then((buf) => audioCtx!.decodeAudioData(buf))
        .then((decoded) => { trumpetBuffer = decoded; }),
      fetch('/beep.mp3')
        .then((res) => res.arrayBuffer())
        .then((buf) => audioCtx!.decodeAudioData(buf))
        .then((decoded) => { beepBuffer = decoded; })
    ])
      .catch((err) => console.warn('Audio prefetch failed', err))
      .finally(() => {
        isFetching = false;
      });
  }
}

// Funzione da collegare al primo tocco sullo schermo (sblocco AudioContext iOS)
export function unlockAudio() {
  initAudio();
  if (isUnlocked) return;

  // Trucco 1: Suona una traccia muta nell'AudioContext
  if (audioCtx) {
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const node = audioCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(audioCtx.destination);
    node.start(0);
  }

  isUnlocked = true;
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('touchstart', unlockAudio);
}

// Inizializzazione automatica al primo click/touch
if (typeof document !== 'undefined') {
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
}

function triggerBeep() {
  if (!audioCtx) return;
  if (beepBuffer) {
    try {
      const source = audioCtx.createBufferSource();
      source.buffer = beepBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (e) {
      console.warn('triggerBeep buffer error', e);
    }
  } else {
    // Beep sintetico di emergenza (880Hz, 'sine', gain 0.3 -> 0.01)
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn('triggerBeep synth error', e);
    }
  }
}

function triggerTrumpet() {
  if (!audioCtx) return;
  if (trumpetBuffer) {
    try {
      const source = audioCtx.createBufferSource();
      source.buffer = trumpetBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (e) {
      console.warn('triggerTrumpet error', e);
    }
  }
}

export function playTrumpet() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([500, 200, 500]); } catch {}
  }

  initAudio();
  if (!audioCtx) return;

  if (audioCtx.state === 'running') {
    triggerTrumpet();
  } else {
    audioCtx.resume().then(() => {
      triggerTrumpet();
    }).catch(() => {});
  }
}

export function playShortBeep() {
  initAudio();
  if (!audioCtx) return;

  if (audioCtx.state === 'running') {
    triggerBeep();
  } else {
    audioCtx.resume().then(() => {
      triggerBeep();
    }).catch(() => {});
  }
}

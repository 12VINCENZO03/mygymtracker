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

export async function playTrumpet() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([500, 200, 500]); } catch {}
  }

  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  if (audioCtx && trumpetBuffer) {
    try {
      const source = audioCtx.createBufferSource();
      source.buffer = trumpetBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (e) {
      console.warn('playTrumpet error', e);
    }
  }
}

export async function playShortBeep() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  if (audioCtx && beepBuffer) {
    try {
      const source = audioCtx.createBufferSource();
      source.buffer = beepBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (e) {
      console.warn('playShortBeep error', e);
    }
  }
}

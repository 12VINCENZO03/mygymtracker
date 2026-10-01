// src/utils/audio.ts

let timerSound: HTMLAudioElement | null = null;
let beepSound: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let isUnlocked = false;

export function initAudio() {
  if (typeof window === 'undefined') return;
  
  if (!timerSound) {
    timerSound = new Audio('/timer-end.mp3');
    timerSound.load();
  }
  if (!beepSound) {
    beepSound = new Audio('/beep.mp3');
    beepSound.load();
  }

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// Funzione da collegare al primo tocco sullo schermo
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

  // Trucco 2: Play e Pause istantaneo degli HTMLAudioElement
  if (timerSound) {
    timerSound.muted = true;
    timerSound.play().then(() => {
      timerSound!.pause();
      timerSound!.currentTime = 0;
      timerSound!.muted = false;
    }).catch(() => {
      timerSound!.muted = false;
    });
  }
  if (beepSound) {
    beepSound.muted = true;
    beepSound.play().then(() => {
      beepSound!.pause();
      beepSound!.currentTime = 0;
      beepSound!.muted = false;
    }).catch(() => {
      beepSound!.muted = false;
    });
  }

  isUnlocked = true;
  document.removeEventListener('click', unlockAudio);
  document.removeEventListener('touchstart', unlockAudio);
}

// Inizializzazione automatica
if (typeof document !== 'undefined') {
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
}

export async function playTrumpet() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([500, 200, 500]); } catch {}
  }
  
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  
  if (timerSound) {
    timerSound.currentTime = 0;
    await timerSound.play().catch(console.warn);
  }
}

export async function playShortBeep() {
  initAudio();
  if (beepSound) {
    beepSound.currentTime = 0;
    await beepSound.play().catch(() => {});
  }
}

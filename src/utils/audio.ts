let audioCtx: AudioContext | null = null;

export function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      try {
        const buf = audioCtx.createBuffer(1, 1, 22050);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx.destination);
        src.start(0);
      } catch {
        // ignore
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// Attach listener once
if (typeof window !== 'undefined') {
  const handler = () => {
    initAudio();
  };
  window.addEventListener('click', handler, { once: false });
  window.addEventListener('touchstart', handler, { once: false });
}

export async function playTrumpet() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([500, 200, 500]);
    } catch {
      // ignore
    }
  }

  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      // ignore
    }
  }
  if (audioCtx.state !== 'running') return;

  const now = audioCtx.currentTime;
  const playNote = (freq: number, start: number, duration: number) => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.8, now + start + 0.05);
    gain.gain.setValueAtTime(0.8, now + start + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + start + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration);
  };

  playNote(392.00, 0, 0.2);     // G4
  playNote(523.25, 0.2, 0.2);   // C5
  playNote(659.25, 0.4, 0.2);   // E5
  playNote(783.99, 0.6, 0.6);   // G5
}

export function playShortBeep() {
  initAudio();
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

let timerSound: HTMLAudioElement | null = null;
let beepSound: HTMLAudioElement | null = null;
let audioUnlocked = false;

// Inizializza gli elementi audio puntando alla cartella public/
export function initAudio() {
  if (typeof window === 'undefined') return;
  
  if (!timerSound) {
    // Se il tuo file è .m4a, cambia l'estensione qui sotto!
    timerSound = new Audio('/timer-end.mp3');
    timerSound.load();
  }
  
  if (!beepSound) {
    beepSound = new Audio('/beep.mp3');
    beepSound.load();
  }
}

// Meccanismo di sblocco per iOS: al primo tocco dell'utente
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    initAudio();
    if (!audioUnlocked && timerSound && beepSound) {
      // Trucco iOS: riproduciamo e mettiamo in pausa istantaneamente
      // Questo dice a Safari: "L'utente ha autorizzato questo suono"
      timerSound.play().then(() => {
        timerSound!.pause();
        timerSound!.currentTime = 0;
      }).catch(() => {});
      
      beepSound.play().then(() => {
        beepSound!.pause();
        beepSound!.currentTime = 0;
      }).catch(() => {});
      
      audioUnlocked = true;
      
      // Rimuoviamo gli "ascoltatori" perché lo sblocco serve solo una volta
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    }
  };
  
  window.addEventListener('click', unlockAudio, { once: false });
  window.addEventListener('touchstart', unlockAudio, { once: false });
}

// Il suono del fischietto di fine recupero
export async function playTrumpet() {
  // Manteniamo la vibrazione per Android
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([500, 200, 500]); } catch {}
  }
  
  initAudio();
  if (!timerSound) return;
  
  try {
    timerSound.currentTime = 0;
    await timerSound.play();
  } catch (e) {
    // Fallisce silenziosamente (es. file mancante o iOS che blocca ancora)
    console.warn("Impossibile riprodurre l'audio di fine timer", e);
  }
}

// Il suono di spunta della serie
export async function playShortBeep() {
  initAudio();
  if (!beepSound) return;
  
  try {
    beepSound.currentTime = 0;
    await beepSound.play();
  } catch (e) {
    // Fail silently se manca beep.mp3
  }
}

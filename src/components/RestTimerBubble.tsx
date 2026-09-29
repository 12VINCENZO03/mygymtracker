import React, { useEffect, useState } from 'react';
import { formatTime } from '../utils/storage';

interface RestTimerBubbleProps {
  remainingSeconds: number;
  isActive: boolean;
  onSkip: () => void;
}

export const RestTimerBubble: React.FC<RestTimerBubbleProps> = ({
  remainingSeconds,
  isActive,
  onSkip
}) => {
  // Ci serve salvare il tempo totale iniziale per calcolare la percentuale dell'anello
  const [totalSeconds, setTotalSeconds] = useState(0);

  useEffect(() => {
    if (isActive) {
      // Imposta il totale se è la prima volta, o se il timer è stato sovrascritto con un tempo maggiore
      if (totalSeconds === 0 || remainingSeconds > totalSeconds) {
        setTotalSeconds(remainingSeconds);
      }
    } else {
      // Quando la bolla si nasconde, resetta il totale per la prossima volta
      setTotalSeconds(0);
    }
  }, [isActive, remainingSeconds, totalSeconds]);

  if (!isActive) return null;

  // Matematica per calcolare il riempimento dell'anello SVG
  const size = 96; // w-24 equivale a 96px in Tailwind
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Percentuale di riempimento (da 1.0 a 0.0)
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  // Offset per "svuotare" il cerchio (strokeDashoffset)
  const strokeDashoffset = circumference - progress * circumference;

  // Attiviamo il "Flash" visivo negli ultimi 3 secondi per avvisare l'utente
  const isFinishing = remainingSeconds <= 3;

  return (
    <div
      onClick={onSkip}
      role="button"
      tabIndex={0}
      title="Tocca per saltare il recupero"
      // Posizione in basso al centro con Glassmorphism
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full z-[150] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 bg-zinc-900/80 backdrop-blur-md shadow-2xl ${
        isFinishing 
          ? 'ring-4 ring-emerald-400 animate-pulse scale-110' // 🔴 FLASH VISIVO (Si ingrandisce e lampeggia)
          : 'ring-1 ring-zinc-800 hover:scale-105 active:scale-95'
      }`}
    >
      {/* Contenitore SVG posizionato in modo assoluto dietro al testo */}
      <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
        {/* Cerchio di Sfondo (Traccia) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          className="text-zinc-800/60"
        />
        {/* Cerchio di Progresso (Verde che si svuota fluidamente) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          // Usiamo duration-1000 linear per far svuotare la barra senza scatti visivi
          className={`transition-all duration-1000 ease-linear ${
            isFinishing ? 'text-white' : 'text-emerald-500'
          }`}
        />
      </svg>

      {/* Testo al centro */}
      <div className="relative flex flex-col items-center justify-center">
        <span className={`text-2xl font-black font-mono tracking-tight text-center mt-1 ${
          isFinishing ? 'text-emerald-400' : 'text-white'
        }`}>
          {formatTime(remainingSeconds)}
        </span>
        <span className="text-[9px] font-extrabold uppercase tracking-widest mt-0.5 text-zinc-400 flex items-center gap-1">
          Salta <i className="fa-solid fa-forward-step text-[8px]" />
        </span>
      </div>
    </div>
  );
};

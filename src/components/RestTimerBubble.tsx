import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { formatTime } from '../utils/storage';

interface RestTimerBubbleProps {
  remainingSeconds: number;
  isActive: boolean;
  onSkip: () => void;
  nextExerciseName?: string;
  nextExerciseLoad?: string;
}

export const RestTimerBubble: React.FC<RestTimerBubbleProps> = ({
  remainingSeconds,
  isActive,
  onSkip,
  nextExerciseName,
  nextExerciseLoad
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);

  useEffect(() => {
    if (isActive) {
      if (totalSeconds === 0 || remainingSeconds > totalSeconds) {
        setTotalSeconds(remainingSeconds);
      }
    } else {
      setTotalSeconds(0);
      setIsExpanded(false); // Chiude l'isola quando il timer finisce
    }
  }, [isActive, remainingSeconds, totalSeconds]);

  if (!isActive) return null;

  const size = 96;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const strokeDashoffset = circumference - progress * circumference;
  const isFinishing = remainingSeconds <= 3;

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      tabIndex={0}
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 cursor-pointer shadow-2xl backdrop-blur-xl bg-zinc-900/90 border border-zinc-800/80 ${
        isExpanded
          ? 'px-5 py-4 rounded-[2.5rem] w-[88vw] max-w-sm flex flex-col gap-3 ring-2 ring-emerald-500/40'
          : `w-24 h-24 rounded-full flex flex-col items-center justify-center ${
              isFinishing ? 'ring-4 ring-emerald-400 animate-pulse scale-110' : 'ring-1 ring-zinc-700 hover:scale-105 active:scale-95'
            }`
      }`}
    >
      {!isExpanded ? (
        <>
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" className="text-zinc-800/60" />
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
              className={`transition-all duration-1000 linear ${isFinishing ? 'text-white' : 'text-emerald-500'}`}
            />
          </svg>
          <div className="relative flex flex-col items-center justify-center">
            <span className={`text-2xl font-black font-mono tracking-tight text-center mt-1 ${isFinishing ? 'text-emerald-400' : 'text-white'}`}>
              {formatTime(remainingSeconds)}
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest mt-0.5 text-zinc-400 flex items-center gap-1">
              Salta <i className="fa-solid fa-forward-step text-[8px]" />
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col w-full">
          {/* Header della Dynamic Island Espansa */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Recupero Attivo</span>
            </div>
            <span className="text-xl font-black font-mono text-white">{formatTime(remainingSeconds)}</span>
          </div>

          {/* Dettaglio Prossimo Esercizio */}
          {nextExerciseName && (
            <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/60 mt-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Prossimo in scaletta</span>
              <div className="text-xs font-extrabold text-zinc-200 mt-0.5 truncate">{nextExerciseName}</div>
              {nextExerciseLoad && (
                <div className="text-[11px] font-bold text-emerald-400 mt-0.5">
                  Carico previsto: <span className="text-white">{nextExerciseLoad} kg</span>
                </div>
              )}
            </div>
          )}

          {/* Pulsante rapido Salta */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-3 rounded-xl font-bold text-xs transition active:scale-[0.98] mt-1 flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-forward-step text-emerald-400" /> Salta Recupero
          </button>
        </div>
      )}
    </motion.div>
  );
};

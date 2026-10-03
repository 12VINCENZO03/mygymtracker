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
      setIsExpanded(false);
    }
  }, [isActive, remainingSeconds, totalSeconds]);

  if (!isActive) return null;

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const isFinishing = remainingSeconds <= 3;

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      tabIndex={0}
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 cursor-pointer shadow-2xl backdrop-blur-2xl bg-black/90 border border-zinc-800/80 text-white select-none ${
        isExpanded
          ? 'px-5 py-4 rounded-[2rem] w-[90vw] max-w-sm flex flex-col gap-3.5 ring-2 ring-emerald-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.8)]'
          : 'px-4 py-2 rounded-full flex items-center gap-3 ring-1 ring-zinc-700/60 hover:scale-105 active:scale-95 shadow-lg'
      }`}
    >
      {!isExpanded ? (
        /* Stato Compatto: Capsula orizzontale stile Dynamic Island */
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="14" cy="14" r="11" strokeWidth="2.5" stroke="currentColor" fill="transparent" className="text-zinc-800" />
              <circle
                cx="14"
                cy="14"
                r="11"
                strokeWidth="2.5"
                stroke="currentColor"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 11}
                strokeDashoffset={2 * Math.PI * 11 * (1 - progress)}
                strokeLinecap="round"
                className={`transition-all duration-1000 linear ${isFinishing ? 'text-white animate-pulse' : 'text-emerald-400'}`}
              />
            </svg>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-mono font-black tracking-tight ${isFinishing ? 'text-emerald-400' : 'text-white'}`}>
              {formatTime(remainingSeconds)}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 border-l border-zinc-800 pl-2">
              Salta
            </span>
          </div>
        </div>
      ) : (
        /* Stato Espanso: Card Capsula Ricca */
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">Recupero Attivo</span>
            </div>
            <span className="text-xl font-black font-mono tracking-tight text-white">{formatTime(remainingSeconds)}</span>
          </div>

          {nextExerciseName && (
            <div className="bg-zinc-900/90 p-3.5 rounded-2xl border border-zinc-800/80 mt-1 shadow-inner">
              <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block mb-0.5">Prossimo in scaletta</span>
              <div className="text-xs font-black text-zinc-100 truncate">{nextExerciseName}</div>
              {nextExerciseLoad && (
                <div className="text-[11px] font-bold text-emerald-400 mt-1">
                  Carico previsto: <span className="text-white font-mono">{nextExerciseLoad} kg</span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-3 rounded-xl font-black text-xs transition active:scale-[0.98] mt-1 flex items-center justify-center gap-2 border border-zinc-700/50 shadow-sm"
          >
            <i className="fa-solid fa-forward-step text-emerald-400" /> Salta Recupero
          </button>
        </div>
      )}
    </motion.div>
  );
};

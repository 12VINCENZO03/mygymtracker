import React from 'react';
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
  if (!isActive) return null;

  return (
    <div
      onClick={onSkip}
      role="button"
      tabIndex={0}
      title="Tocca per saltare il recupero"
      className="fixed top-24 right-5 bg-emerald-500 text-zinc-950 w-24 h-24 rounded-full shadow-2xl z-50 flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 border-4 border-emerald-300/80 backdrop-blur-md"
    >
      <span className="text-2xl font-black font-mono tracking-tight text-center mt-1">
        {formatTime(remainingSeconds)}
      </span>
      <span className="text-[10px] font-extrabold uppercase tracking-widest mt-0.5 opacity-80 flex items-center gap-1">
        Salta <i className="fa-solid fa-forward-step text-[9px]" />
      </span>
    </div>
  );
};

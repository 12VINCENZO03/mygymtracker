// src/components/RepsModal.tsx
import React, { useState, useEffect } from 'react';

interface RepsModalProps {
  isOpen: boolean;
  exerciseName?: string;
  setIndex: number;
  initialReps: number;
  onConfirm: (reps: number) => void;
  onClose: () => void;
}

export const RepsModal: React.FC<RepsModalProps> = ({
  isOpen,
  exerciseName,
  setIndex,
  initialReps,
  onConfirm,
  onClose
}) => {
  const [reps, setReps] = useState<number>(initialReps || 10);

  useEffect(() => {
    if (isOpen) {
      setReps(initialReps || 10);
    }
  }, [isOpen, initialReps]);

  if (!isOpen) return null;

  const handleAdjust = (delta: number) => {
    setReps((prev) => Math.max(0, prev + delta));
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setReps(isNaN(val) ? 0 : Math.max(0, val));
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] transition-opacity animate-in fade-in"
      />
      <div className="fixed bottom-0 left-0 w-full max-w-xl mx-auto right-0 bg-zinc-900 rounded-t-3xl z-[100] px-5 py-4 shadow-2xl border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mb-3" />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
              {exerciseName || 'Esercizio'} • Serie {setIndex + 1}
            </span>
            <h3 className="text-white font-black text-base">Ripetizioni Effettive</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Numeric Display & Stepper */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between mb-4 shadow-inner">
          <button
            type="button"
            onClick={() => handleAdjust(-1)}
            disabled={reps <= 0}
            className="w-12 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xl flex items-center justify-center border border-zinc-700/60 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
          >
            <i className="fa-solid fa-minus text-sm" />
          </button>

          <div className="flex flex-col items-center">
            <input
              type="number"
              min={0}
              max={999}
              value={reps === 0 ? '' : reps}
              onChange={handleManualChange}
              placeholder="0"
              autoFocus
              className="w-24 text-center bg-transparent text-white font-black text-4xl outline-none focus:text-emerald-400 transition-colors"
            />
            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider mt-0.5">
              reps eseguite
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleAdjust(1)}
            className="w-12 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xl flex items-center justify-center border border-zinc-700/60 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-plus text-sm" />
          </button>
        </div>

        {/* Quick adjustment buttons */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            type="button"
            onClick={() => handleAdjust(-2)}
            className="py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-black text-xs hover:border-zinc-700 hover:bg-zinc-900 active:scale-95 transition-all"
          >
            -2
          </button>
          <button
            type="button"
            onClick={() => handleAdjust(-1)}
            className="py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-black text-xs hover:border-zinc-700 hover:bg-zinc-900 active:scale-95 transition-all"
          >
            -1
          </button>
          <button
            type="button"
            onClick={() => handleAdjust(1)}
            className="py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-black text-xs hover:border-emerald-600/40 hover:bg-emerald-950/20 active:scale-95 transition-all"
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => handleAdjust(2)}
            className="py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-black text-xs hover:border-emerald-600/40 hover:bg-emerald-950/20 active:scale-95 transition-all"
          >
            +2
          </button>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={() => onConfirm(reps)}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3.5 rounded-2xl font-black text-sm transition flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
        >
          <i className="fa-solid fa-check" /> Conferma Ripetizioni
        </button>
      </div>
    </>
  );
};

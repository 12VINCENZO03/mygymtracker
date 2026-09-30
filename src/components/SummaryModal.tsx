// src/components/SummaryModal.tsx
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { WorkoutSessionV2 } from '../types/v2';

interface SummaryModalProps {
  isOpen: boolean;
  newSnapshot: WorkoutSessionV2 | null;
  previousSnapshot: WorkoutSessionV2 | null;
  onClose: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  newSnapshot,
  previousSnapshot,
  onClose
}) => {
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  if (!isOpen || !newSnapshot) return null;

  // Calcolo totale serie per la sessione V2
  let totalSetsCount = 0;
  newSnapshot.blocks.forEach(b => {
    if ('rounds' in b) {
      b.rounds.forEach(r => r.exercises.forEach(sub => totalSetsCount += sub.sets.length));
    } else {
      totalSetsCount += b.sets.length;
    }
  });

  const comparisonItems: Array<{
    title: string;
    description: string;
    type: 'pr' | 'better' | 'worse' | 'neutral';
  }> = [];

  if (!previousSnapshot) {
    comparisonItems.push({
      title: 'Punto di partenza stabilito',
      description: 'Prima volta che completi questo workout! I risultati di oggi serviranno da riferimento per la prossima volta.',
      type: 'better'
    });
  } else {
    // Confronto blocchi V2 (esercizi singoli)
    newSnapshot.blocks.forEach((nBlock) => {
      if (!('rounds' in nBlock)) {
        // Blocco singolo
        const oBlock = previousSnapshot.blocks.find(
          (b) => !('rounds' in b) && (b.exerciseId === nBlock.exerciseId || b.nameSnapshot === nBlock.nameSnapshot)
        );

        if (oBlock && !('rounds' in oBlock)) {
          const nMaxW = Math.max(...nBlock.sets.map((s) => s.weight || 0));
          const oMaxW = Math.max(...oBlock.sets.map((s) => s.weight || 0));
          const nTotReps = nBlock.sets.reduce((sum, s) => sum + (s.reps || 0), 0);
          const oTotReps = oBlock.sets.reduce((sum, s) => sum + (s.reps || 0), 0);

          if (nMaxW > oMaxW && nMaxW > 0) {
            comparisonItems.push({
              title: `${nBlock.nameSnapshot} — Nuovo Record!`,
              description: `Carico massimo aumentato di +${(nMaxW - oMaxW).toFixed(1)}kg (ora ${nMaxW}kg)`,
              type: 'pr'
            });
          } else if (nMaxW === oMaxW && nTotReps > oTotReps) {
            comparisonItems.push({
              title: `${nBlock.nameSnapshot} — Più Volume!`,
              description: `Completate +${nTotReps - oTotReps} ripetizioni complessive a parità di carico`,
              type: 'better'
            });
          } else if (nMaxW < oMaxW && nMaxW > 0) {
            comparisonItems.push({
              title: `${nBlock.nameSnapshot} — Carico Inferiore`,
              description: `Carico massimo ridotto di -${(oMaxW - nMaxW).toFixed(1)}kg rispetto alla scorsa sessione`,
              type: 'worse'
            });
          }
        }
      }
    });

    if (comparisonItems.length === 0) {
      comparisonItems.push({
        title: 'Performance Costante',
        description: 'Hai consolidato i carichi e il volume della volta precedente. Ottimo lavoro di stabilizzazione!',
        type: 'neutral'
      });
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] transition-opacity animate-in fade-in"
      />
      <div className="fixed bottom-0 left-0 w-full max-w-xl mx-auto right-0 bg-zinc-900 rounded-t-3xl z-[120] p-6 shadow-2xl border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mb-4" />
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-2 border border-emerald-500/30">
            <i className="fa-solid fa-ranking-star text-xl" />
          </div>
          <h3 className="text-white font-black text-xl">Allenamento Completato!</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {newSnapshot.tabNameSnapshot} • Durata: {newSnapshot.durationStr} • Serie: {totalSetsCount}
          </p>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 max-h-[45vh] overflow-y-auto hide-scrollbar space-y-3">
          {comparisonItems.map((item, idx) => {
            const isPr = item.type === 'pr';
            const isBetter = item.type === 'better';
            const isWorse = item.type === 'worse';

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex items-start gap-3 ${
                  isPr
                    ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                    : isBetter
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : isWorse
                    ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="mt-0.5 shrink-0 text-base">
                  {isPr ? (
                    <i className="fa-solid fa-trophy text-amber-400" />
                  ) : isBetter ? (
                    <i className="fa-solid fa-arrow-trend-up text-emerald-400" />
                  ) : isWorse ? (
                    <i className="fa-solid fa-arrow-trend-down text-rose-400" />
                  ) : (
                    <i className="fa-solid fa-check text-zinc-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">{item.title}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 outline-none shadow-sm mt-5 text-sm active:scale-[0.98]"
        >
          <i className="fa-solid fa-check" /> Chiudi e Riposa
        </button>
      </div>
    </>
  );
};

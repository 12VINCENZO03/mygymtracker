import React, { useState } from 'react';
import { WorkoutSessionV2, ExerciseSnapshotV2, CircuitSnapshotV2 } from '../types/v2';

interface HistoryModalProps {
  isOpen: boolean;
  historyV2: WorkoutSessionV2[]; // 🔴 L'interfaccia accetta solo il formato robusto V2
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  historyV2,
  onClose
}) => {
  const [selectedSession, setSelectedSession] = useState<WorkoutSessionV2 | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);

  if (!isOpen) return null;

  // Helper intelligente per ricalcolare il numero di serie al volo (Single Source of Truth ad alte prestazioni)
  const getTotalSets = (session: WorkoutSessionV2): number => {
    let count = 0;
    if (!session || !session.blocks) return count;
    for (const b of session.blocks) {
      if ('rounds' in b) {
        for (const r of b.rounds) {
          for (const sub of r.exercises) {
            if (sub.sets) count += sub.sets.length;
          }
        }
      } else {
        if (b.sets) count += b.sets.length;
      }
    }
    return count;
  };

  const displayedHistory = React.useMemo(() => {
    return (historyV2 || []).slice(0, visibleCount);
  }, [historyV2, visibleCount]);

  return (
    <div className="fixed inset-0 bg-zinc-950 z-[100] flex flex-col animate-in fade-in">
      {/* Header */}
      <div className="header-safe-top p-4 px-5 flex justify-between items-center bg-zinc-950 border-b border-zinc-800/60 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {selectedSession && (
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-300 hover:text-white"
            >
              <i className="fa-solid fa-arrow-left text-xs" />
            </button>
          )}
          <h2 className="text-white font-extrabold text-base flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-emerald-500" />
            {selectedSession ? selectedSession.tabNameSnapshot : 'Cronologia Allenamenti'}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedSession(null);
            onClose();
          }}
          className="w-9 h-9 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 hover:text-white outline-none"
        >
          <i className="fa-solid fa-xmark text-sm" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar max-w-xl mx-auto w-full">
        {!selectedSession ? (
          historyV2.length === 0 ? (
            <div className="text-zinc-500 text-center py-16 text-xs">
              Nessun allenamento completato ancora.
            </div>
          ) : (
            <>
              {displayedHistory.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  role="button"
                  tabIndex={0}
                  className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-zinc-800/80 transition"
                >
                  <div className="truncate pr-3">
                    <h4 className="text-white font-extrabold text-sm truncate">{s.tabNameSnapshot}</h4>
                    <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3">
                      <span>
                        <i className="fa-regular fa-calendar mr-1 opacity-70" /> {s.date}
                      </span>
                      <span>
                        <i className="fa-regular fa-clock mr-1 opacity-70" /> {s.durationStr}
                      </span>
                      <span>
                        <i className="fa-solid fa-layer-group mr-1 opacity-70" /> {getTotalSets(s)} serie
                      </span>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-zinc-600 text-xs" />
                </div>
              ))}
              {historyV2.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 30)}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-bold py-3.5 rounded-2xl transition active:scale-[0.99] shadow-sm"
                >
                  Carica altri ({Math.min(30, historyV2.length - visibleCount)} di {historyV2.length - visibleCount} rimanenti)
                </button>
              )}
            </>
          )
        ) : (
          <div className="space-y-4">
            {/* Header di dettaglio sessione */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-around">
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Durata</div>
                <div className="text-base font-extrabold text-white mt-0.5">{selectedSession.durationStr}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Serie Totali</div>
                <div className="text-base font-extrabold text-white mt-0.5">{getTotalSets(selectedSession)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Data</div>
                <div className="text-base font-extrabold text-emerald-400 mt-0.5">{selectedSession.date}</div>
              </div>
            </div>
            
            {/* 🔴 Motore V2: Rendering dinamico dei Blocchi Immutabili */}
            {selectedSession.blocks.map((block, bIdx) => {
              if (!('rounds' in block)) {
                // Rendering Esercizio Singolo
                const ex = block as ExerciseSnapshotV2;
                return (
                  <div key={bIdx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
                    <h5 className="text-sm font-extrabold text-emerald-400 mb-2">{ex.nameSnapshot}</h5>
                    <div className="bg-zinc-950 rounded-xl border border-zinc-800/70 divide-y divide-zinc-800/70">
                      {ex.sets.map((set, sIdx) => (
                        <div key={sIdx} className="p-3 flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-500">Serie {set.index}</span>
                          <div className="flex items-center gap-2">
                            {set.reps !== undefined && (
                              <span className="text-white font-semibold">
                                {set.reps} <span className="text-zinc-500 text-[10px]">reps</span>
                              </span>
                            )}
                            {set.durationSec !== undefined && (
                              <span className="text-white font-semibold">
                                {set.durationSec} <span className="text-zinc-500 text-[10px]">sec</span>
                              </span>
                            )}
                            {set.weight !== undefined && (
                              <>
                                <span className="text-zinc-700">|</span>
                                <span className="text-white font-semibold">
                                  {set.weight} <span className="text-zinc-500 text-[10px]">kg</span>
                                </span>
                              </>
                            )}
                            {set.isCed ? (
                              <span className="bg-rose-900/80 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold">CED</span>
                            ) : set.rir !== undefined ? (
                              <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                RIR {set.rir}
                              </span>
                            ) : null}
                            {set.rpe !== undefined && (
                              <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                RPE {set.rpe}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } else {
                // Rendering Circuito
                const circ = block as CircuitSnapshotV2;
                return (
                  <div key={bIdx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h5 className="text-sm font-extrabold text-emerald-400">{circ.nameSnapshot}</h5>
                      <span className="text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                        {circ.structureType}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {circ.rounds.map((round) => (
                        <div key={round.roundIndex} className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                          <div className="bg-zinc-900/80 px-3 py-1.5 text-xs font-bold text-zinc-400 border-b border-zinc-800">
                            Giro {round.roundIndex}
                          </div>
                          <div className="divide-y divide-zinc-800">
                            {round.exercises.map((sub, subIdx) => (
                              <div key={subIdx} className="p-3 flex justify-between items-center text-xs">
                                <span className="text-zinc-200 font-semibold">{sub.nameSnapshot}</span>
                                <div className="flex items-center gap-2">
                                  {sub.sets[0]?.reps !== undefined && (
                                    <span className="text-white">
                                      {sub.sets[0].reps} <span className="text-zinc-500 text-[10px]">reps</span>
                                    </span>
                                  )}
                                  {sub.sets[0]?.weight !== undefined && (
                                    <span className="text-white">
                                      {sub.sets[0].weight} <span className="text-zinc-500 text-[10px]">kg</span>
                                    </span>
                                  )}
                                  {sub.sets[0]?.isCed ? (
                                    <span className="bg-rose-900/80 text-rose-300 px-1.5 py-0.5 rounded text-[10px]">CED</span>
                                  ) : sub.sets[0]?.rir !== undefined ? (
                                    <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">
                                      RIR {sub.sets[0].rir}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
};

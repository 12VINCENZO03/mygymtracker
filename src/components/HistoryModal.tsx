import React, { useState, useMemo } from 'react';
import { WorkoutSessionV2, ExerciseSnapshotV2, CircuitSnapshotV2 } from '../types/v2';

interface HistoryModalProps {
  isOpen: boolean;
  historyV2: WorkoutSessionV2[];
  onClose: () => void;
  onDeleteSession: (id: string) => void;
}

const SwipeableSessionCard: React.FC<{
  session: WorkoutSessionV2;
  onClick: () => void;
  onDelete: (id: string) => void;
  getTotalSets: (s: WorkoutSessionV2) => number;
}> = ({ session, onClick, onDelete, getTotalSets }) => {
  const [offsetX, setOffsetX] = React.useState(0);
  const startX = React.useRef(0);
  const currentX = React.useRef(0);
  const isDragging = React.useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientX - startX.current;
    if (delta < 0) {
      currentX.current = Math.max(delta, -90); // Limite di scorrimento
      setOffsetX(currentX.current);
    } else {
      currentX.current = 0;
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (currentX.current < -45) {
      setOffsetX(-80); // Scatta aperto
    } else {
      setOffsetX(0); // Scatta chiuso
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl mb-3">
      {/* Cestino in background */}
      <div className="absolute inset-0 bg-rose-600 flex items-center justify-end px-5 rounded-2xl">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(session.id);
          }}
          className="w-10 h-10 flex items-center justify-center text-white outline-none active:scale-95 transition-transform"
        >
          <i className="fa-solid fa-trash text-lg" />
        </button>
      </div>

      {/* Scheda in foreground con supporto Touch */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (offsetX < 0) {
            e.stopPropagation();
            setOffsetX(0); // Chiude il cestino se si tocca la scheda
          } else {
            onClick(); // Apre il dettaglio
          }
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)'
        }}
        className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 flex justify-between items-center cursor-pointer relative z-10 w-full"
      >
        <div className="truncate pr-3">
          <h4 className="text-white font-extrabold text-sm truncate max-w-[220px]">
            {String(session.tabNameSnapshot || (session as any).tabName || 'Allenamento')}
          </h4>
          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3">
            <span>
              <i className="fa-regular fa-calendar mr-1 opacity-70" /> {String(session.date || '-')}
            </span>
            <span>
              <i className="fa-regular fa-clock mr-1 opacity-70" /> {String(session.durationStr || '00:00')}
            </span>
            <span>
              <i className="fa-solid fa-layer-group mr-1 opacity-70" /> {getTotalSets(session)} serie
            </span>
          </div>
        </div>
        <i className="fa-solid fa-chevron-right text-zinc-600 text-xs" />
      </div>
    </div>
  );
};

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  historyV2,
  onClose,
  onDeleteSession
}) => {
  const [selectedSession, setSelectedSession] = useState<WorkoutSessionV2 | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);

  // Filtra la cronologia eliminando i valori nulli che potrebbero mandare in crash React
  const safeHistory = useMemo(() => {
    if (!Array.isArray(historyV2)) return [];
    return historyV2.filter((s) => s && typeof s === 'object');
  }, [historyV2]);

  if (!isOpen) return null;

  // Helper corazzato: non salta in aria se mancano dati (es. vecchie sessioni o DB corrotto)
  const getTotalSets = (session: WorkoutSessionV2): number => {
    let count = 0;
    if (!session || !Array.isArray(session.blocks)) return count;
    for (const b of session.blocks) {
      // AGGIUNTO: Controllo typeof per evitare TypeError fatali su primitive
      if (!b || typeof b !== 'object') continue;
      
      if ('rounds' in b && Array.isArray((b as CircuitSnapshotV2).rounds)) {
        for (const r of (b as CircuitSnapshotV2).rounds) {
          if (!r || !Array.isArray(r.exercises)) continue;
          for (const sub of r.exercises) {
            if (sub && Array.isArray(sub.sets)) {
              count += sub.sets.length;
            }
          }
        }
      } else {
        if (Array.isArray((b as ExerciseSnapshotV2).sets)) {
          count += (b as ExerciseSnapshotV2).sets.length;
        }
      }
    }
    return count;
  };

  const displayedHistory = safeHistory.slice(0, visibleCount);

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
            {selectedSession ? String(selectedSession.tabNameSnapshot || 'Dettaglio') : 'Cronologia Allenamenti'}
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
          safeHistory.length === 0 ? (
            <div className="text-zinc-500 text-center py-16 text-xs">
              Nessun allenamento completato ancora.
            </div>
          ) : (
            <>
              {displayedHistory.map((s) => (
                <SwipeableSessionCard
                  key={String(s.id || Math.random())}
                  session={s}
                  onClick={() => setSelectedSession(s)}
                  onDelete={(id) => {
                    if (confirm('Eliminare definitivamente questo allenamento dalla cronologia?')) {
                      onDeleteSession(id);
                    }
                  }}
                  getTotalSets={getTotalSets}
                />
              ))}
              {safeHistory.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 30)}
                  className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-bold py-3.5 rounded-2xl transition active:scale-[0.99] shadow-sm"
                >
                  Carica altri ({Math.min(30, safeHistory.length - visibleCount)} di {safeHistory.length - visibleCount} rimanenti)
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
                <div className="text-base font-extrabold text-white mt-0.5">{String(selectedSession.durationStr || '-')}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Serie Totali</div>
                <div className="text-base font-extrabold text-white mt-0.5">{getTotalSets(selectedSession)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Data</div>
                <div className="text-base font-extrabold text-emerald-400 mt-0.5">{String(selectedSession.date || '-')}</div>
              </div>
            </div>

            {/* Motore V2: Rendering dinamico dei Blocchi Immutabili Corazzato */}
            {Array.isArray(selectedSession.blocks) && selectedSession.blocks.map((block, bIdx) => {
              // Controllo difensivo stringente
              if (!block || typeof block !== 'object') return null;

              if (!('rounds' in block)) {
                // Rendering Esercizio Singolo
                const ex = block as ExerciseSnapshotV2;
                const exName = typeof ex.nameSnapshot === 'object' ? 'Esercizio' : String(ex.nameSnapshot || 'Esercizio');
                return (
                  <div key={bIdx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
                    <h5 className="text-sm font-extrabold text-emerald-400 mb-2">{exName}</h5>
                    <div className="bg-zinc-950 rounded-xl border border-zinc-800/70 divide-y divide-zinc-800/70">
                      {Array.isArray(ex.sets) && ex.sets.map((set, sIdx) => {
                        if (!set || typeof set !== 'object') return null;
                        const idxLabel = typeof set.index === 'object' ? sIdx + 1 : (set.index ?? sIdx + 1);
                        const repsVal = typeof set.reps === 'object' ? (set.reps as any)?.value : set.reps;
                        const durVal = typeof set.durationSec === 'object' ? (set.durationSec as any)?.value : set.durationSec;
                        const weightVal = typeof set.weight === 'object' ? (set.weight as any)?.value : set.weight;
                        const rirVal = typeof set.rir === 'object' ? (set.rir as any)?.value : set.rir;
                        const rpeVal = typeof set.rpe === 'object' ? (set.rpe as any)?.value : set.rpe;

                        return (
                          <div key={sIdx} className="p-3 flex justify-between items-center text-xs">
                            <span className="font-bold text-zinc-500">Serie {String(idxLabel)}</span>
                            <div className="flex items-center gap-2">
                              {repsVal !== undefined && repsVal !== null && repsVal !== '' && (
                                <span className="text-white font-semibold">
                                  {String(repsVal)} <span className="text-zinc-500 text-[10px]">reps</span>
                                </span>
                              )}
                              {durVal !== undefined && durVal !== null && durVal !== '' && (
                                <span className="text-white font-semibold">
                                  {String(durVal)} <span className="text-zinc-500 text-[10px]">sec</span>
                                </span>
                              )}
                              {weightVal !== undefined && weightVal !== null && weightVal !== '' && (
                                <>
                                  <span className="text-zinc-700">|</span>
                                  <span className="text-white font-semibold">
                                    {String(weightVal)} <span className="text-zinc-500 text-[10px]">kg</span>
                                  </span>
                                </>
                              )}
                              {set.isCed ? (
                                <span className="bg-rose-900/80 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold">CED</span>
                              ) : rirVal !== undefined && rirVal !== null && rirVal !== '' ? (
                                <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                  RIR {String(rirVal)}
                                </span>
                              ) : null}
                              {rpeVal !== undefined && rpeVal !== null && rpeVal !== '' && (
                                <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                                  RPE {String(rpeVal)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              } else {
                // Rendering Circuito
                const circ = block as CircuitSnapshotV2;
                const circName = typeof circ.nameSnapshot === 'object' ? 'Circuito' : String(circ.nameSnapshot || 'Circuito');
                const circStructure = typeof circ.structureType === 'object' ? 'classic' : String(circ.structureType || 'classic');
                return (
                  <div key={bIdx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h5 className="text-sm font-extrabold text-emerald-400">{circName}</h5>
                      <span className="text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                        {circStructure}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {Array.isArray(circ.rounds) && circ.rounds.map((round, rIdx) => {
                        if (!round || typeof round !== 'object') return null;
                        const roundIdxLabel = typeof round.roundIndex === 'object' ? rIdx + 1 : (round.roundIndex ?? rIdx + 1);

                        return (
                          <div key={roundIdxLabel || rIdx} className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                            <div className="bg-zinc-900/80 px-3 py-1.5 text-xs font-bold text-zinc-400 border-b border-zinc-800">
                              Giro {String(roundIdxLabel)}
                            </div>
                            <div className="divide-y divide-zinc-800">
                              {Array.isArray(round.exercises) && round.exercises.map((sub, subIdx) => {
                                if (!sub || typeof sub !== 'object') return null;
                                const subName = typeof sub.nameSnapshot === 'object' ? 'Esercizio' : String(sub.nameSnapshot || 'Esercizio');
                                const firstSet = Array.isArray(sub.sets) && sub.sets[0] && typeof sub.sets[0] === 'object' ? sub.sets[0] : null;
                                const repsVal = firstSet ? (typeof firstSet.reps === 'object' ? (firstSet.reps as any)?.value : firstSet.reps) : undefined;
                                const weightVal = firstSet ? (typeof firstSet.weight === 'object' ? (firstSet.weight as any)?.value : firstSet.weight) : undefined;
                                const rirVal = firstSet ? (typeof firstSet.rir === 'object' ? (firstSet.rir as any)?.value : firstSet.rir) : undefined;

                                return (
                                  <div key={subIdx} className="p-3 flex justify-between items-center text-xs">
                                    <span className="text-zinc-200 font-semibold truncate max-w-[150px]">{subName}</span>
                                    <div className="flex items-center gap-2">
                                      {repsVal !== undefined && repsVal !== null && repsVal !== '' && (
                                        <span className="text-white">
                                          {String(repsVal)} <span className="text-zinc-500 text-[10px]">reps</span>
                                        </span>
                                      )}
                                      {weightVal !== undefined && weightVal !== null && weightVal !== '' && (
                                        <span className="text-white">
                                          {String(weightVal)} <span className="text-zinc-500 text-[10px]">kg</span>
                                        </span>
                                      )}
                                      {firstSet?.isCed ? (
                                        <span className="bg-rose-900/80 text-rose-300 px-1.5 py-0.5 rounded text-[10px]">CED</span>
                                      ) : rirVal !== undefined && rirVal !== null && rirVal !== '' ? (
                                        <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">
                                          RIR {String(rirVal)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
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

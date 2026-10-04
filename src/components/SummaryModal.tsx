// src/components/SummaryModal.tsx
import React, { useEffect, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { WorkoutSessionV2, CircuitSnapshotV2, ExerciseSnapshotV2 } from '../types/v2';
import { AppState } from '../types/gym';
import { getExerciseCoachAdvice, getCircuitCoachAdvice } from '../utils/coach';

interface SummaryModalProps {
  isOpen: boolean;
  newSnapshot: WorkoutSessionV2 | null;
  previousSnapshot: WorkoutSessionV2 | null;
  state?: AppState | null;
  onClose: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  newSnapshot,
  previousSnapshot,
  state,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'diagnostics'>('records');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('records');
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

  // Calcolo totale serie per la sessione V2
  const totalSetsCount = useMemo(() => {
    if (!newSnapshot) return 0;
    let count = 0;
    newSnapshot.blocks.forEach(b => {
      if ('rounds' in b) {
        b.rounds.forEach(r => r.exercises.forEach(sub => count += sub.sets.length));
      } else {
        count += b.sets.length;
      }
    });
    return count;
  }, [newSnapshot]);

  // Confronto e generazione highlights multi-variabile
  const comparisonItems = useMemo(() => {
    if (!newSnapshot) return [];

    const items: Array<{
      title: string;
      description: string;
      type: 'pr' | 'neural' | 'reps' | 'emom' | 'tut' | 'better' | 'worse' | 'neutral';
    }> = [];

    if (!previousSnapshot) {
      items.push({
        title: 'Punto di partenza stabilito',
        description: 'Prima volta che completi questo workout! I risultati di oggi serviranno da riferimento per il Coach e per la prossima sessione.',
        type: 'better'
      });
      return items;
    }

    // 1. Confronto Esercizi Singoli
    newSnapshot.blocks.forEach((nBlock) => {
      if (!('rounds' in nBlock)) {
        const oBlock = previousSnapshot.blocks.find(
          (b): b is ExerciseSnapshotV2 => !('rounds' in b) && (b.exerciseId === nBlock.exerciseId || b.nameSnapshot.trim().toLowerCase() === nBlock.nameSnapshot.trim().toLowerCase())
        );

        if (oBlock) {
          const nSets = nBlock.sets || [];
          const oSets = oBlock.sets || [];
          const nMaxW = Math.max(0, ...nSets.map((s) => s.weight || 0));
          const oMaxW = Math.max(0, ...oSets.map((s) => s.weight || 0));
          const nTotReps = nSets.reduce((sum, s) => sum + (s.reps || 0), 0);
          const oTotReps = oSets.reduce((sum, s) => sum + (s.reps || 0), 0);

          // A) Record di Carico (PR)
          if (nMaxW > oMaxW && nMaxW > 0) {
            items.push({
              title: `${nBlock.nameSnapshot} — Nuovo Record di Carico!`,
              description: `Carico massimo aumentato di +${(nMaxW - oMaxW).toFixed(1)}kg (ora ${nMaxW}kg)`,
              type: 'pr'
            });
          }

          // B) Miglioramento RIR a parità di carico (Efficienza Neurale)
          if (nMaxW === oMaxW && nMaxW > 0) {
            const nRirs = nSets
              .filter(s => (s.weight || 0) === nMaxW && s.rir != null && !isNaN(s.rir) && s.rir >= 0)
              .map(s => s.rir as number);
            const oRirs = oSets
              .filter(s => (s.weight || 0) === oMaxW && s.rir != null && !isNaN(s.rir) && s.rir >= 0)
              .map(s => s.rir as number);

            if (nRirs.length > 0 && oRirs.length > 0) {
              const nAvgRir = nRirs.reduce((a, b) => a + b, 0) / nRirs.length;
              const oAvgRir = oRirs.reduce((a, b) => a + b, 0) / oRirs.length;
              if (nAvgRir - oAvgRir >= 0.5) {
                items.push({
                  title: `${nBlock.nameSnapshot} — Miglioramento Margine RIR!`,
                  description: `A parità di carico (${nMaxW}kg), il margine RIR è salito da ${oAvgRir.toFixed(1)} a ${nAvgRir.toFixed(1)} (+${(nAvgRir - oAvgRir).toFixed(1)}). Minore sforzo percepito allo stesso peso!`,
                  type: 'neural'
                });
              }
            }
          }

          // C) Maggior numero di ripetizioni sul Top Set o Volume
          if (nMaxW === oMaxW) {
            const nTopSetReps = Math.max(0, ...nSets.filter(s => (s.weight || 0) === nMaxW).map(s => s.reps || 0));
            const oTopSetReps = Math.max(0, ...oSets.filter(s => (s.weight || 0) === oMaxW).map(s => s.reps || 0));

            if (nTopSetReps > oTopSetReps && oTopSetReps > 0) {
              items.push({
                title: `${nBlock.nameSnapshot} — Più Reps sul Top Set!`,
                description: `Top set portato da ${oTopSetReps} a ${nTopSetReps} ripetizioni a ${nMaxW > 0 ? nMaxW + 'kg' : 'BW'} (+${nTopSetReps - oTopSetReps} reps)!`,
                type: 'reps'
              });
            } else if (nTotReps > oTotReps && oTotReps > 0) {
              items.push({
                title: `${nBlock.nameSnapshot} — Più Volume Totale!`,
                description: `Completate +${nTotReps - oTotReps} ripetizioni complessive a parità di carico (${nTotReps} vs ${oTotReps} reps).`,
                type: 'reps'
              });
            }
          }

          // D) Isometria / Time under tension (TUT)
          if (nBlock.type === 'time') {
            const nDur = nSets.reduce((sum, s) => sum + (s.durationSec || 0), 0);
            const oDur = oSets.reduce((sum, s) => sum + (s.durationSec || 0), 0);
            if (nDur > oDur && oDur > 0) {
              items.push({
                title: `${nBlock.nameSnapshot} — Più Tempo Sotto Tensione!`,
                description: `Tenuta complessiva aumentata di +${Math.round(nDur - oDur)}s (${Math.round(nDur)}s vs ${Math.round(oDur)}s). Time Under Tension incrementato!`,
                type: 'tut'
              });
            }
          }

          // E) Carico inferiore
          if (nMaxW < oMaxW && nMaxW > 0) {
            items.push({
              title: `${nBlock.nameSnapshot} — Carico Inferiore`,
              description: `Carico massimo ridotto di -${(oMaxW - nMaxW).toFixed(1)}kg rispetto alla scorsa sessione`,
              type: 'worse'
            });
          }
        }
      } else {
        // 2. Confronto Circuiti (EMOM / AMRAP)
        const nCirc = nBlock as CircuitSnapshotV2;
        const oCirc = previousSnapshot.blocks.find(
          (b): b is CircuitSnapshotV2 => 'rounds' in b && (b.id === nCirc.id || b.nameSnapshot.trim().toLowerCase() === nCirc.nameSnapshot.trim().toLowerCase())
        );

        if (oCirc && nCirc.structureType === 'emom') {
          // Estrai tempi residui per EMOM
          const extractEmomRemSecs = (c: CircuitSnapshotV2): number[] => {
            const res: number[] = [];
            if (!c.rounds) return res;
            c.rounds.forEach((r) => {
              if (r.exercises) {
                for (const ex of r.exercises) {
                  if (ex.sets) {
                    for (const s of ex.sets) {
                      const val = s.customFields?.['masterTimerRemainingSec'];
                      if (val !== undefined && val !== null && !isNaN(Number(val))) {
                        res.push(Number(val));
                        return;
                      }
                    }
                  }
                }
              }
            });
            return res;
          };

          const nRems = extractEmomRemSecs(nCirc);
          const oRems = extractEmomRemSecs(oCirc);

          if (nRems.length > 0 && oRems.length > 0) {
            const nAvg = nRems.reduce((a, b) => a + b, 0) / nRems.length;
            const oAvg = oRems.reduce((a, b) => a + b, 0) / oRems.length;
            const nMin = Math.min(...nRems);
            const oMin = Math.min(...oRems);

            if (nAvg - oAvg >= 2) {
              items.push({
                title: `${nCirc.nameSnapshot || 'EMOM'} — Miglior Gestione Tempo Residuo!`,
                description: `Buffer di recupero medio salito a ${Math.round(nAvg)}s a round (+${Math.round(nAvg - oAvg)}s rispetto ai ${Math.round(oAvg)}s precedenti). Velocità e densità metabolica ottimizzate!`,
                type: 'emom'
              });
            } else if (nMin - oMin >= 3) {
              items.push({
                title: `${nCirc.nameSnapshot || 'EMOM'} — Buffer di Sicurezza Migliorato!`,
                description: `Il tempo residuo minimo nel round più duro è salito da ${Math.round(oMin)}s a ${Math.round(nMin)}s. Meno affanno nel finale!`,
                type: 'emom'
              });
            }
          }
        } else if (oCirc && nCirc.structureType === 'amrap') {
          const countReps = (c: CircuitSnapshotV2) => {
            let total = 0;
            c.rounds?.forEach(r => r.exercises?.forEach(sub => sub.sets?.forEach(s => total += (Number(s.reps) || 0))));
            return total;
          };
          const nReps = countReps(nCirc);
          const oReps = countReps(oCirc);
          if (nReps > oReps) {
            items.push({
              title: `${nCirc.nameSnapshot || 'AMRAP'} — Più Ripetizioni Totali!`,
              description: `Completate ${nReps} reps (${nCirc.rounds.length} giri) contro le ${oReps} reps (${oCirc.rounds.length} giri) precedenti (+${nReps - oReps} reps)!`,
              type: 'reps'
            });
          }
        }
      }
    });

    if (items.length === 0) {
      items.push({
        title: 'Performance Costante',
        description: 'Hai consolidato i carichi e il volume della volta precedente. Ottimo lavoro di stabilizzazione!',
        type: 'neutral'
      });
    }

    return items;
  }, [newSnapshot, previousSnapshot]);

  // Diagnosi Fisiologiche & Analisi Multi-Variabile per la sessione
  const detailedDiagnostics = useMemo(() => {
    if (!newSnapshot) return [];

    const list: Array<{
      name: string;
      title: string;
      badge: string;
      diagnosis: string;
      action: string;
      fatigueAlert?: string;
    }> = [];

    newSnapshot.blocks.forEach((block) => {
      if (!('rounds' in block)) {
        if (state) {
          const advice = getExerciseCoachAdvice(
            state,
            block.exerciseId,
            '8-12',
            block.type,
            false,
            block.nameSnapshot,
            block.exerciseId
          );
          if (advice && advice.message) {
            const parts = advice.message.split('AZIONE:');
            const diagnosis = parts[0]?.replace('DIAGNOSI:', '').trim() || advice.message;
            const action = parts[1]?.trim() || '';
            list.push({
              name: block.nameSnapshot,
              title: advice.title,
              badge: advice.badge,
              diagnosis,
              action,
              fatigueAlert: advice.fatigueAlert
            });
            return;
          }
        }

        // Fallback autonomo dallo snapshot
        const sets = block.sets || [];
        const maxW = Math.max(0, ...sets.map(s => s.weight || 0));
        const avgReps = sets.length ? Math.round(sets.reduce((a, b) => a + (b.reps || 0), 0) / sets.length) : 0;
        const validRirs = sets.map(s => s.rir).filter(r => r != null && !isNaN(r)) as number[];
        const avgRir = validRirs.length ? (validRirs.reduce((a, b) => a + b, 0) / validRirs.length).toFixed(1) : null;

        list.push({
          name: block.nameSnapshot,
          title: 'Analisi Esecuzione',
          badge: 'maintain',
          diagnosis: `Completate ${sets.length} serie. Top carico: ${maxW > 0 ? maxW + 'kg' : 'BW'}, media reps: ${avgReps}${avgRir !== null ? `, RIR medio: ${avgRir}` : ''}.`,
          action: 'Consolida la pulizia tecnica e mantieni una progressione costante del volume.'
        });
      } else {
        const circ = block as CircuitSnapshotV2;
        if (state) {
          const fakeSuperset: any = {
            id: circ.id,
            name: circ.nameSnapshot,
            structureType: circ.structureType,
            exercises: circ.rounds?.[0]?.exercises?.map(e => ({ id: e.exerciseId, name: e.nameSnapshot, exerciseId: e.exerciseId })) || []
          };
          const circAdvice = getCircuitCoachAdvice(state, fakeSuperset);
          if (circAdvice && circAdvice.message) {
            const parts = circAdvice.message.split('AZIONE:');
            list.push({
              name: circ.nameSnapshot || (circ.structureType === 'emom' ? 'Circuito EMOM' : 'Circuito AMRAP'),
              title: circAdvice.title,
              badge: circAdvice.badge,
              diagnosis: parts[0]?.replace('DIAGNOSI:', '').trim() || circAdvice.message,
              action: parts[1]?.trim() || ''
            });
            return;
          }
        }

        list.push({
          name: circ.nameSnapshot || (circ.structureType === 'emom' ? 'Circuito EMOM' : 'Circuito AMRAP'),
          title: 'Densità & Pacing',
          badge: 'maintain',
          diagnosis: `Completati ${circ.rounds?.length || 0} round totali della struttura ${circ.structureType.toUpperCase()}.`,
          action: 'Monitora il recupero tra i round per stabilizzare la frequenza cardiaca.'
        });
      }
    });

    return list;
  }, [newSnapshot, state]);

  if (!isOpen || !newSnapshot) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] transition-opacity animate-in fade-in"
      />
      <div className="fixed bottom-0 left-0 w-full max-w-xl mx-auto right-0 bg-zinc-900 rounded-t-3xl z-[120] p-6 shadow-2xl border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mb-4" />
        
        {/* Intestazione */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-2 border border-emerald-500/30">
            <i className="fa-solid fa-ranking-star text-xl" />
          </div>
          <h3 className="text-white font-black text-xl">Allenamento Completato!</h3>
          <p className="text-xs text-zinc-400 mt-1">
            {newSnapshot.tabNameSnapshot} • Durata: {newSnapshot.durationStr} • Serie: {totalSetsCount}
          </p>
        </div>

        {/* Segmented Control: Record vs Diagnosi Coach */}
        <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-800 mb-3.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'records'
                ? 'bg-emerald-500 text-zinc-950 font-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-trophy text-[11px]" /> Record & Progressi ({comparisonItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-emerald-500 text-zinc-950 font-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-brain text-[11px]" /> Diagnosi Fisiologica ({detailedDiagnostics.length})
          </button>
        </div>

        {/* Contenuto Scrollabile */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 max-h-[44vh] overflow-y-auto hide-scrollbar space-y-3">
          {activeTab === 'records' ? (
            comparisonItems.map((item, idx) => {
              const isPr = item.type === 'pr';
              const isNeural = item.type === 'neural';
              const isReps = item.type === 'reps';
              const isEmom = item.type === 'emom';
              const isTut = item.type === 'tut';
              const isWorse = item.type === 'worse';
              const isBetter = item.type === 'better';

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all ${
                    isPr
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                      : isNeural
                      ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                      : isEmom
                      ? 'bg-amber-950/25 border-amber-500/40 text-amber-200'
                      : isReps || isTut || isBetter
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : isWorse
                      ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 text-base">
                    {isPr ? (
                      <i className="fa-solid fa-trophy text-amber-400" />
                    ) : isNeural ? (
                      <i className="fa-solid fa-brain text-amber-400" />
                    ) : isEmom ? (
                      <i className="fa-solid fa-stopwatch text-amber-400" />
                    ) : isReps ? (
                      <i className="fa-solid fa-repeat text-emerald-400" />
                    ) : isTut ? (
                      <i className="fa-solid fa-hourglass-half text-emerald-400" />
                    ) : isWorse ? (
                      <i className="fa-solid fa-arrow-trend-down text-rose-400" />
                    ) : (
                      <i className="fa-solid fa-check text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-extrabold text-xs text-white tracking-wide">{item.title}</div>
                    <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      {item.description}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            detailedDiagnostics.map((diag, idx) => (
              <div
                key={idx}
                className="bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800/80 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-xs text-white truncate">{diag.name}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    diag.badge === 'increase'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : diag.badge === 'stall'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : diag.badge === 'decrease'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {diag.title}
                  </span>
                </div>

                <div className="text-[11px] text-zinc-300 leading-relaxed bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-900">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">Diagnosi Fisiologica</span>
                  {diag.diagnosis}
                </div>

                {diag.action && (
                  <div className="text-[11px] text-emerald-300 font-medium leading-relaxed bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-900/30 flex items-start gap-2">
                    <i className="fa-solid fa-bullseye text-emerald-400 text-xs mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Azione Prescritta</span>
                      {diag.action}
                    </div>
                  </div>
                )}

                {diag.fatigueAlert && (
                  <div className="text-[10px] text-amber-300 bg-amber-950/30 p-2 rounded-xl border border-amber-900/40">
                    <b className="text-amber-400">Allerta Fatica:</b> {diag.fatigueAlert}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3.5 rounded-2xl font-black transition flex items-center justify-center gap-2 outline-none shadow-sm mt-4 text-sm active:scale-[0.98]"
        >
          <i className="fa-solid fa-check" /> Chiudi e Riposa
        </button>
      </div>
    </>
  );
};

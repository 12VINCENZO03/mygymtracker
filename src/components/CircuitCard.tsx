import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AppState, SupersetExercise } from '../types/gym';
import { formatTime } from '../utils/storage';
import { getExerciseCoachAdvice, getCircuitCoachAdvice } from '../utils/coach';
import { getLastExercisePerformance, getHistoricalSetDataV2 } from '../utils/domain';

interface CircuitCardProps {
  circuit: SupersetExercise;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isWorkoutActive: boolean;
  isEditMode: boolean;
  state: AppState;
  onUpdateCircuit: (field: string, value: unknown) => void;
  onDeleteCircuit: () => void;
  onMoveCircuit: (dir: number) => void;
  onAddSubEx: () => void;
  onAddRestBlock: () => void;
  onUpdateSubEx: (subId: string, field: string, value: unknown) => void;
  onDeleteSubEx: (subId: string) => void;
  onMoveSubEx: (subId: string, dir: number) => void;
  onSaveWeight: (subId: string, val: string) => void;
  onSaveSetWeight: (setId: string, val: string) => void;
  onSaveCustomField?: (setId: string, fieldId: string, val: string) => void;
  onToggleSubSet: (subId: string, roundIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, string> }) => void;
  onLongPressSubSet: (subId: string, roundIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, string> }) => void;
  onOpenEffortModal: (setId: string, isRpe: boolean) => void;
  onOpenVideo: (url: string) => void;
  onAddAmrapRound: (roundSets?: Array<{ subId: string; reps: string; weight: string; rir?: string; rpe?: string }>) => void;
  onStartAmrapTimer: (totalMin: number, pacingSec?: number) => void;
  onStartEmomTimer: (totalMin: number, intervalSec: number) => void;
  onStartRoundRest: (seconds: number, roundIndex: number) => void;
  onRunInlineTimer: (setId: string, durationSec: number, pauseSec: number, prefill: { weight: string; rir?: string; rpe?: string }) => void;
  activeInlineTimerSec: Record<string, number>;
  isMasterTimerRunning: boolean;
  masterTimerRemainingSec: number;
  activeEmomRound: number;
  onEmomCriticalRest?: (remainingSec: number) => void;
}

export const CircuitCard: React.FC<CircuitCardProps> = ({
  circuit,
  index,
  isFirst,
  isLast,
  isWorkoutActive,
  isEditMode,
  state,
  onUpdateCircuit,
  onDeleteCircuit,
  onMoveCircuit,
  onAddSubEx,
  onAddRestBlock,
  onUpdateSubEx,
  onDeleteSubEx,
  onMoveSubEx,
  onSaveWeight,
  onSaveSetWeight,
  onSaveCustomField,
  onToggleSubSet,
  onLongPressSubSet,
  onOpenEffortModal,
  onOpenVideo,
  onAddAmrapRound,
  onStartAmrapTimer,
  onStartEmomTimer,
  onStartRoundRest,
  onRunInlineTimer,
  activeInlineTimerSec,
  isMasterTimerRunning,
  masterTimerRemainingSec,
  activeEmomRound,
  onEmomCriticalRest
}) => {
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const isEmom = circuit.structureType === 'emom';
  const isAmrap = circuit.structureType === 'amrap';
  let totalRounds = circuit.rounds || 3;

  if (isEmom) {
    totalRounds = Math.ceil(((circuit.emomTotalMin || 10) * 60) / (circuit.emomIntervalSec || 60));
  } else if (isAmrap) {
    totalRounds = 1;
  }

  const amrapInfo = state.amrapState?.[circuit.id] || { currentRound: 0, completedRounds: 0 };
  const amrapRoundsCount = amrapInfo.completedRounds;
  const roundsArray = isAmrap
    ? Array.from({ length: Math.max(1, amrapInfo.currentRound + 1) }).map((_, i) => i)
    : Array.from({ length: totalRounds }).map((_, i) => i);

  const subCoachAdvices = React.useMemo(() => {
    const map: Record<string, ReturnType<typeof getExerciseCoachAdvice>> = {};
    circuit.exercises.forEach((sub) => {
      if (sub.metricType !== 'rest') {
        map[sub.id] = getExerciseCoachAdvice(state, sub.id, sub.reps || '10', sub.metricType, true, sub.name, sub.exerciseId);
      }
    });
    return map;
  }, [state.sessionsV2, state.bodyGoal, state.deloadActive, circuit.exercises]);

  const circuitCoachAdvice = React.useMemo(() => {
    return getCircuitCoachAdvice(state, circuit);
  }, [state.sessionsV2, circuit]);

  if (isEditMode) {
    return (
      <div className="bg-zinc-900/60 rounded-3xl p-5 pt-7 mb-5 shadow-sm border border-zinc-800/40 backdrop-blur-sm relative animate-in fade-in">
        {/* Reorder Circuit */}
        <div className="absolute -top-4 right-2 flex items-center gap-2 z-10">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveCircuit(-1)}
            aria-label={`Sposta circuito ${circuit.name || ''} su`}
            className="w-11 h-11 min-w-11 min-h-11 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-md border-2 border-zinc-950 hover:bg-emerald-400 disabled:opacity-40 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-up text-xs" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveCircuit(1)}
            aria-label={`Sposta circuito ${circuit.name || ''} giù`}
            className="w-11 h-11 min-w-11 min-h-11 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-md border-2 border-zinc-950 hover:bg-emerald-400 disabled:opacity-40 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-down text-xs" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex justify-between items-center gap-2">
            <select
              value={circuit.structureType}
              onChange={(e) => onUpdateCircuit('structureType', e.target.value)}
              aria-label="Tipo di struttura circuito"
              className="flex-1 min-h-11 bg-emerald-950/20 text-emerald-400 text-base font-black uppercase tracking-wider px-3 py-2.5 rounded-2xl outline-none border border-emerald-900/50 shadow-inner"
            >
              <option value="classic">⚙️ Circuito Classico</option>
              <option value="emom">⏱️ EMOM</option>
              <option value="amrap">🔥 AMRAP</option>
            </select>
            <button
              type="button"
              onClick={onDeleteCircuit}
              aria-label={`Elimina circuito ${circuit.name || ''}`}
              className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center text-rose-400 bg-rose-950/30 border border-rose-900/30 rounded-2xl outline-none hover:bg-rose-900/50 active:scale-95 transition-all shadow-sm shrink-0"
            >
              <i className="fa-solid fa-trash text-sm" aria-hidden="true" />
            </button>
          </div>
          <input
            type="text"
            value={circuit.name}
            onChange={(e) => onUpdateCircuit('name', e.target.value)}
            placeholder="Nome Circuito"
            aria-label="Nome circuito"
            className="bg-zinc-950 text-white font-extrabold px-3.5 py-2.5 min-h-11 rounded-2xl w-full outline-none text-base border border-zinc-800/80 shadow-inner focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Structure Parameters */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {!isEmom && !isAmrap && (
            <>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2.5 shadow-inner text-center">
                <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">Giri</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={circuit.rounds !== undefined ? circuit.rounds : 3}
                  onChange={(e) => onUpdateCircuit('rounds', parseInt(e.target.value) || 0)}
                  aria-label="Numero di giri"
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
                />
              </div>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2.5 shadow-inner flex flex-col justify-between">
                <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block text-center">Recupero</span>
                <div className="flex items-center w-full gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (circuit.pause !== 0) {
                        onUpdateCircuit('previousPause', circuit.pause !== undefined ? circuit.pause : 90);
                        onUpdateCircuit('pause', 0);
                      } else {
                        onUpdateCircuit('pause', circuit.previousPause !== undefined ? circuit.previousPause : 90);
                      }
                    }}
                    aria-pressed={circuit.pause !== 0}
                    aria-label="Attiva o disattiva recupero tra i giri"
                    className={`min-h-11 min-w-11 px-3 py-2 rounded-xl text-xs font-black uppercase transition-colors ${circuit.pause !== 0 ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}
                  >
                    {circuit.pause !== 0 ? 'Sì' : 'No'}
                  </button>
                  {circuit.pause !== 0 && (
                    <input
                      type="number"
                      step={5}
                      min={0}
                      value={circuit.pause !== undefined ? circuit.pause : 90}
                      onChange={(e) => onUpdateCircuit('pause', Math.max(0, parseInt(e.target.value) || 0))}
                      aria-label="Secondi recupero tra i giri"
                      className="bg-zinc-900 border border-zinc-700/60 rounded-xl text-white font-bold w-16 min-h-11 text-center outline-none text-base"
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {isEmom && (
            <>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2.5 shadow-inner text-center">
                <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">Min. Totali</span>
                <input
                  type="number"
                  min={1}
                  value={circuit.emomTotalMin !== undefined ? circuit.emomTotalMin : 10}
                  onChange={(e) => onUpdateCircuit('emomTotalMin', parseInt(e.target.value, 10) || 0)}
                  aria-label="Minuti totali EMOM"
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
                />
              </div>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2.5 shadow-inner text-center">
                <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">Sec/Giro</span>
                <input
                  type="number"
                  min={5}
                  value={circuit.emomIntervalSec !== undefined ? circuit.emomIntervalSec : 60}
                  onChange={(e) => onUpdateCircuit('emomIntervalSec', parseInt(e.target.value, 10) || 0)}
                  aria-label="Secondi per giro EMOM"
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
                />
              </div>
            </>
          )}

          {isAmrap && (
            <>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2.5 shadow-inner text-center">
                <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">Min. Totali</span>
                <input
                  type="number"
                  min={1}
                  value={circuit.amrapTotalMin !== undefined ? circuit.amrapTotalMin : 10}
                  onChange={(e) => onUpdateCircuit('amrapTotalMin', parseInt(e.target.value, 10) || 0)}
                  aria-label="Minuti totali AMRAP"
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
                />
              </div>
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2.5 shadow-inner text-center">
                <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">Target Giri</span>
                <input
                  type="number"
                  min={0}
                  value={circuit.rounds !== undefined ? circuit.rounds : 0}
                  onChange={(e) => onUpdateCircuit('rounds', parseInt(e.target.value, 10) || 0)}
                  placeholder="Opzionale"
                  aria-label="Target giri AMRAP"
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
                />
              </div>
            </>
          )}
        </div>

        {/* Sub-exercises edit list */}
        <div className="space-y-4">
          {circuit.exercises.map((sub, sIdx) => {
            const isFirstSub = sIdx === 0;
            const isLastSub = sIdx === circuit.exercises.length - 1;

            if (sub.metricType === 'rest') {
              return (
                <div key={sub.id} className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/80 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <i className="fa-regular fa-clock text-zinc-400 text-sm" aria-hidden="true" />
                      <span className="text-xs font-bold text-zinc-200">Pausa:</span>
                      <input
                        type="number"
                        min={0}
                        value={sub.restSeconds || 30}
                        onChange={(e) => onUpdateSubEx(sub.id, 'restSeconds', Math.max(0, parseInt(e.target.value) || 0))}
                        aria-label="Secondi di pausa intermedia"
                        className="bg-zinc-900 text-white font-bold w-20 px-2 py-2 min-h-11 rounded-xl text-center border border-zinc-700/50 text-base shadow-inner focus:border-emerald-500 outline-none transition-colors"
                      />
                      <span className="text-xs text-zinc-400 font-medium">sec</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isFirstSub}
                      onClick={() => onMoveSubEx(sub.id, -1)}
                      aria-label="Sposta pausa su"
                      className="w-11 h-11 min-w-11 min-h-11 rounded-xl bg-zinc-900 text-zinc-300 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-up text-xs" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={isLastSub}
                      onClick={() => onMoveSubEx(sub.id, 1)}
                      aria-label="Sposta pausa giù"
                      className="w-11 h-11 min-w-11 min-h-11 rounded-xl bg-zinc-900 text-zinc-300 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-down text-xs" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubEx(sub.id)}
                      aria-label="Elimina pausa intermedia"
                      className="w-11 h-11 min-w-11 min-h-11 rounded-xl bg-rose-950/40 text-rose-400 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={sub.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-3 shadow-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    {String.fromCharCode(65 + sIdx)}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isFirstSub}
                      onClick={() => onMoveSubEx(sub.id, -1)}
                      aria-label={`Sposta esercizio ${sub.name || String.fromCharCode(65 + sIdx)} su`}
                      className="w-11 h-11 min-w-11 min-h-11 rounded-xl bg-zinc-900 text-zinc-300 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-up text-xs" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={isLastSub}
                      onClick={() => onMoveSubEx(sub.id, 1)}
                      aria-label={`Sposta esercizio ${sub.name || String.fromCharCode(65 + sIdx)} giù`}
                      className="w-11 h-11 min-w-11 min-h-11 rounded-xl bg-zinc-900 text-zinc-300 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-down text-xs" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubEx(sub.id)}
                      aria-label={`Elimina esercizio ${sub.name || String.fromCharCode(65 + sIdx)}`}
                      className="w-11 h-11 min-w-11 min-h-11 rounded-xl bg-rose-950/40 text-rose-400 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-trash text-xs" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={sub.name}
                  onChange={(e) => onUpdateSubEx(sub.id, 'name', e.target.value)}
                  placeholder="Nome Esercizio"
                  aria-label="Nome sotto-esercizio"
                  className="bg-zinc-900 text-white font-bold px-3.5 py-2.5 min-h-11 rounded-2xl text-base w-full border border-zinc-700/50 outline-none shadow-inner focus:border-emerald-500 transition-colors"
                />
                
                <div className="space-y-2">
                  <select
                    value={sub.metricType}
                    onChange={(e) => onUpdateSubEx(sub.id, 'metricType', e.target.value)}
                    aria-label="Tipo metrica sotto-esercizio"
                    className="w-full min-h-11 bg-zinc-900 text-zinc-200 text-base font-bold px-3 py-2.5 rounded-2xl border border-zinc-700/50 shadow-inner outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="weight">Pesi</option>
                    <option value="bodyweight">C. Libero</option>
                    <option value="time">A Tempo</option>
                    <option value="cardio">Cardio</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {sub.metricType === 'cardio' ? (
                      <div className="bg-zinc-900 text-zinc-400 text-xs font-bold p-2.5 min-h-11 rounded-2xl border border-zinc-800 text-center flex items-center justify-center">
                        Cardio
                      </div>
                    ) : (
                      <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-2 shadow-inner text-center">
                        <span className="text-[11px] text-zinc-400 font-extrabold uppercase block">
                          {sub.metricType === 'time' ? 'Sec' : 'Reps'}
                        </span>
                        <input
                          type="text"
                          value={sub.metricType === 'time' ? (sub.workSec || 30) : (sub.reps || '10')}
                          onChange={(e) =>
                            onUpdateSubEx(
                              sub.id,
                              sub.metricType === 'time' ? 'workSec' : 'reps',
                              e.target.value
                            )
                          }
                          placeholder={sub.metricType === 'time' ? 'Sec' : 'Reps'}
                          aria-label={sub.metricType === 'time' ? 'Secondi target' : 'Ripetizioni target'}
                          className="bg-transparent text-white text-base font-bold w-full text-center outline-none min-h-11"
                        />
                      </div>
                    )}
                    <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-2 shadow-inner text-center">
                      <span className="text-[11px] text-zinc-400 font-extrabold uppercase block">Pausa (s)</span>
                      <input
                        type="number"
                        min={0}
                        value={sub.pause || 0}
                        onChange={(e) => onUpdateSubEx(sub.id, 'pause', Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="Pausa s"
                        aria-label="Secondi di pausa sotto-esercizio"
                        className="bg-transparent text-white text-base font-bold w-full text-center outline-none min-h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* 🔴 Selezionatore Macchina Cardio per Sub-Esercizio */}
                {sub.metricType === 'cardio' && (
                  <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80 shadow-inner">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                      Tipo di Macchina (Parametri di default)
                    </label>
                    <select
                      value={sub.cardioMachine || ''}
                      onChange={(e) => {
                        const machine = e.target.value;
                        onUpdateSubEx(sub.id, 'cardioMachine', machine);
                        let defaultFields: any[] = [];
                        if (machine === 'corsa') {
                          defaultFields = [
                            { id: 'inclinazione', label: 'Inclinazione', unit: '%' },
                            { id: 'velocita', label: 'Velocità', unit: 'km/h' },
                            { id: 'distanza', label: 'Distanza', unit: 'km' }
                          ];
                        } else if (machine === 'vogatore') {
                          defaultFields = [
                            { id: 'distanza', label: 'Distanza', unit: 'm' },
                            { id: 'passo', label: 'Passo', unit: '/500m' },
                            { id: 'spm', label: 'Colpi', unit: 's/m' }
                          ];
                        } else if (machine === 'bike') {
                          defaultFields = [
                            { id: 'resistenza', label: 'Resistenza', unit: 'lvl' },
                            { id: 'rpm', label: 'Cadenza', unit: 'RPM' },
                            { id: 'distanza', label: 'Distanza', unit: 'km' }
                          ];
                        }
                        onUpdateSubEx(sub.id, 'cardioFields', defaultFields);
                      }}
                      aria-label="Seleziona tipo di macchina cardio"
                      className="bg-zinc-950 text-emerald-400 text-base font-bold px-3 py-2.5 min-h-11 rounded-xl outline-none border border-zinc-700/50 w-full"
                    >
                      <option value="">Seleziona macchina...</option>
                      <option value="corsa">Corsa / Tapis Roulant</option>
                      <option value="vogatore">Vogatore</option>
                      <option value="bike">Bike / Assault</option>
                    </select>
                  </div>
                )}

                {(sub.metricType as string) !== 'rest' && (
                  <input
                    type="text"
                    value={sub.link || ''}
                    onChange={(e) => onUpdateSubEx(sub.id, 'link', e.target.value)}
                    placeholder="Link video esecuzione (YouTube / Google Drive)"
                    aria-label="Link video esecuzione sotto-esercizio"
                    className="w-full min-h-11 bg-zinc-900 text-zinc-200 placeholder:text-zinc-400 text-base font-medium px-3.5 py-2.5 rounded-2xl border border-zinc-700/50 outline-none shadow-inner focus:border-emerald-500 transition-colors"
                  />
                )}
              </div>
            );
          })}

          <div className="flex gap-3 pt-2 flex-col sm:flex-row">
            <button
              type="button"
              onClick={onAddSubEx}
              className="flex-1 min-h-11 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-2xl font-bold border border-zinc-700 text-xs transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Aggiungi Esercizio
            </button>
            <button
              type="button"
              onClick={onAddRestBlock}
              className="flex-1 min-h-11 py-3.5 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 rounded-2xl font-bold border border-zinc-700/50 text-xs transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5"
            >
              <i className="fa-regular fa-clock" aria-hidden="true" /> + Pausa Intermedia
            </button>
          </div>
        </div>
      </div>
    );
  }

  const checkIsClosingEmomRound = (subId: string, roundIdx: number) => {
    if (!isEmom) return false;
    const setId = `${subId}-${roundIdx}`;
    const isCurrentlyChecked = Boolean(state.checkedSets[setId]);
    if (isCurrentlyChecked) return false;

    const activeSubs = circuit.exercises.filter((s) => s.metricType !== 'rest');
    return activeSubs.every((s) => s.id === subId || Boolean(state.checkedSets[`${s.id}-${roundIdx}`]));
  };

  const handleAddAmrapRound = () => {
    const curRound = amrapInfo.currentRound;
    const roundSetsData = circuit.exercises
      .filter((sub) => sub.metricType !== 'rest')
      .map((sub) => {
        const setId = `${sub.id}-${curRound}`;
        const histSet = getHistoricalSetDataV2(state.sessionsV2, curRound + 1, sub.exerciseId, sub.name);
        const isTimeType = sub.metricType === 'time';
        const defaultTargetReps = histSet?.reps !== undefined 
          ? String(histSet.reps) 
          : (isTimeType ? String(sub.workSec || 60) : (sub.reps || '10'));
        const actualReps = state.setReps[setId] ?? defaultTargetReps;

        let displayWeight = state.setWeights?.[setId];
        if (displayWeight === undefined) {
          for (let j = curRound - 1; j >= 0; j--) {
            const prevId = `${sub.id}-${j}`;
            if (state.setWeights?.[prevId] !== undefined) {
              displayWeight = state.setWeights[prevId];
              break;
            }
          }
          if (displayWeight === undefined && histSet?.weight !== undefined && histSet.weight !== '') {
            displayWeight = String(histSet.weight);
          }
          if (displayWeight === undefined) {
            displayWeight = state.weights[sub.id] || '';
          }
        }

        const isCardio = sub.metricType === 'cardio';
        const currentEffort = isCardio ? state.setRpe[setId] : state.setRir[setId];
        const histEffort = isCardio ? histSet?.rpe : histSet?.rir;
        const displayEffort = currentEffort !== undefined && currentEffort !== '' ? currentEffort : histEffort;

        return {
          subId: sub.id,
          reps: actualReps,
          weight: displayWeight || '0',
          rir: !isCardio && displayEffort ? String(displayEffort) : undefined,
          rpe: isCardio && displayEffort ? String(displayEffort) : undefined
        };
      });

    onAddAmrapRound(roundSetsData);
  };

  // Pointer down/up handler for press / long press
  const handlePointerDown = (subId: string, roundIdx: number, pauseSec: number, prefillData: any) => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      
      // Controllo PT: Siamo sotto i 10 secondi nel giro corrente?
      const setId = `${subId}-${roundIdx}`;
      const isCurrentlyChecked = Boolean(state.checkedSets[setId]);
      if (!isCurrentlyChecked && isEmom && isMasterTimerRunning && roundIdx === activeEmomRound) {
        if (masterTimerRemainingSec > 0 && masterTimerRemainingSec <= 10) {
          onEmomCriticalRest?.(masterTimerRemainingSec);
        }
      }

      const isClosingRound = checkIsClosingEmomRound(subId, roundIdx);
      let effectivePrefill = prefillData;
      if (isClosingRound) {
        const remSecVal = String(masterTimerRemainingSec);
        effectivePrefill = {
          ...prefillData,
          customFields: {
            ...(prefillData.customFields || {}),
            masterTimerRemainingSec: remSecVal,
            emomRemainingSec: remSecVal
          }
        };
        onSaveCustomField?.(setId, 'masterTimerRemainingSec', remSecVal);
        onSaveCustomField?.(setId, 'emomRemainingSec', remSecVal);
        circuit.exercises.forEach((s) => {
          if (s.metricType !== 'rest') {
            const sId = `${s.id}-${roundIdx}`;
            onSaveCustomField?.(sId, 'masterTimerRemainingSec', remSecVal);
            onSaveCustomField?.(sId, 'emomRemainingSec', remSecVal);
          }
        });
      }

      onLongPressSubSet(subId, roundIdx, pauseSec, effectivePrefill);
    }, 450);
  };

  const handlePointerUp = (subId: string, roundIdx: number, pauseSec: number, prefillData: any, actualReps: string) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      // Controllo PT: Siamo sotto i 10 secondi nel giro corrente?
      const setId = `${subId}-${roundIdx}`;
      const isCurrentlyChecked = Boolean(state.checkedSets[setId]);
      if (!isCurrentlyChecked && isEmom && isMasterTimerRunning && roundIdx === activeEmomRound) {
        if (masterTimerRemainingSec > 0 && masterTimerRemainingSec <= 10) {
          onEmomCriticalRest?.(masterTimerRemainingSec);
        }
      }

      const isClosingRound = checkIsClosingEmomRound(subId, roundIdx);
      let effectivePrefill = prefillData;
      if (isClosingRound) {
        const remSecVal = String(masterTimerRemainingSec);
        effectivePrefill = {
          ...prefillData,
          customFields: {
            ...(prefillData.customFields || {}),
            masterTimerRemainingSec: remSecVal,
            emomRemainingSec: remSecVal
          }
        };
        onSaveCustomField?.(setId, 'masterTimerRemainingSec', remSecVal);
        onSaveCustomField?.(setId, 'emomRemainingSec', remSecVal);
        circuit.exercises.forEach((s) => {
          if (s.metricType !== 'rest') {
            const sId = `${s.id}-${roundIdx}`;
            onSaveCustomField?.(sId, 'masterTimerRemainingSec', remSecVal);
            onSaveCustomField?.(sId, 'emomRemainingSec', remSecVal);
          }
        });
      }

      if (isNaN(Number(actualReps))) {
        onLongPressSubSet(subId, roundIdx, pauseSec, effectivePrefill);
      } else {
        onToggleSubSet(subId, roundIdx, pauseSec, effectivePrefill);
      }
    }
  };

  const handlePointerCancel = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      id={`circuit-${circuit.id}`}
      className={`bg-zinc-900/60 rounded-3xl p-5 sm:p-6 mb-5 relative shadow-sm border border-zinc-800/40 backdrop-blur-md transition-all ${
        !isWorkoutActive ? 'opacity-75 grayscale-[20%]' : ''
      }`}
    >
      <div className="absolute left-0 top-0 w-1.5 h-full bg-zinc-700/50 rounded-l-3xl" />
      
      {/* Circuit Header */}
      <div className="flex justify-between items-start mb-4 pl-2">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] uppercase font-black px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tracking-wider">
              {isEmom
                ? `EMOM ${circuit.emomTotalMin || 10}' (Ogni ${circuit.emomIntervalSec || 60}s)`
                : isAmrap
                ? `AMRAP ${circuit.amrapTotalMin || 10}'`
                : `Circuito (${circuit.rounds || 3} Giri)`}
            </span>
          </div>
          <h3 className="text-lg font-black text-white leading-tight flex items-baseline gap-1.5">
            <span className="text-emerald-400 font-black opacity-90">{index}.</span>
            {circuit.name}
            {!isEmom && !isAmrap && circuit.pause === 0 && (
              <span className="ml-2 text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider font-black translate-y-[-1px] shrink-0">
                NO REC
              </span>
            )}
          </h3>
        </div>
      </div>

      {/* Circuit Ecosystem Coach Advice - Vista Analitica (Solo fuori dal Workout) */}
      {!isWorkoutActive && circuitCoachAdvice && circuitCoachAdvice.message && !isEditMode && (
        <div className="mx-2 mb-4 bg-indigo-950/40 border border-indigo-700/60 text-indigo-200 text-xs p-3.5 rounded-2xl flex items-start gap-3 shadow-inner">
          <i className="fa-solid fa-bolt text-indigo-400 mt-0.5 text-sm shrink-0 opacity-90" aria-hidden="true" />
          <div className="leading-relaxed">
            <span className="font-extrabold uppercase text-[11px] tracking-wider text-indigo-300 block mb-0.5">
              {circuitCoachAdvice.title}
            </span>
            {circuitCoachAdvice.message}
          </div>
        </div>
      )}

      {/* AMRAP or EMOM Timers */}
      {isAmrap && (
        <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800/80 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner ml-2">
          <div>
            <div className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Timer AMRAP</div>
            <div className="text-3xl font-black text-amber-400 font-mono tracking-wider tabular-nums mt-0.5 drop-shadow-[0_0_12px_rgba(251,191,36,0.25)]">
              {isMasterTimerRunning ? formatTime(masterTimerRemainingSec) : `${circuit.amrapTotalMin || 10}:00`}
            </div>
            {Boolean(circuit.rounds && circuit.rounds > 0) && (
              <div className="text-[11px] text-zinc-300 mt-1 font-bold tracking-wide">
                Target: {circuit.rounds} giri (Pace: {formatTime(Math.floor(((circuit.amrapTotalMin || 10) * 60) / (circuit.rounds || 1)))} / giro)
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!isWorkoutActive}
              onClick={() => {
                const totalMins = circuit.amrapTotalMin || 10;
                const targetRounds = circuit.rounds || 0;
                // Calcola i secondi per ogni giro. Es: 12 min / 8 giri = 90 secondi a giro
                const pacingSec = targetRounds > 0 ? Math.floor((totalMins * 60) / targetRounds) : undefined;
                onStartAmrapTimer(totalMins, pacingSec);
              }}
              aria-pressed={isMasterTimerRunning}
              className={`min-h-11 px-4 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-sm flex-1 sm:flex-none ${
                isMasterTimerRunning
                  ? 'bg-rose-500 text-white shadow-rose-500/20'
                  : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-emerald-500/20'
              }`}
            >
              {isMasterTimerRunning ? 'Ferma' : 'Avvia AMRAP'}
            </button>
            <button
              type="button"
              disabled={!isWorkoutActive}
              onClick={() => {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try { navigator.vibrate(40); } catch { /* ignore */ }
                }
                handleAddAmrapRound();
              }}
              className="min-h-11 bg-zinc-800 hover:bg-zinc-700 active:bg-emerald-500 active:text-zinc-950 text-emerald-400 px-4 py-3 rounded-2xl font-black text-xs border border-zinc-700 active:scale-90 transition-all duration-150 shadow-sm flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            >
              <i className="fa-solid fa-plus text-[11px]" aria-hidden="true" />
              1 Giro ({amrapRoundsCount})
            </button>
          </div>
        </div>
      )}

      {isEmom && (
        <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800/80 mb-5 flex items-center justify-between gap-3 shadow-inner ml-2">
          <div>
            <div className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">
              Giro {activeEmomRound >= 0 ? activeEmomRound + 1 : 1} / {totalRounds}
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight mt-0.5">
              {isMasterTimerRunning ? formatTime(masterTimerRemainingSec) : `${circuit.emomIntervalSec || 60}s`}
            </div>
          </div>
          <button
            type="button"
            disabled={!isWorkoutActive}
            onClick={() => onStartEmomTimer(circuit.emomTotalMin || 10, circuit.emomIntervalSec || 60)}
            aria-pressed={isMasterTimerRunning}
            className={`min-h-11 px-5 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-sm ${
              isMasterTimerRunning
                ? 'bg-rose-500 text-white shadow-rose-500/20'
                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-emerald-500/20'
            }`}
          >
            {isMasterTimerRunning ? 'Stop EMOM' : 'Avvia EMOM'}
          </button>
        </div>
      )}

      {/* Sub-exercises list */}
      <div className="space-y-4 pl-2">
        {isWorkoutActive ? (
          roundsArray.map((rIdx) => {
            let emomRoundClass = '';
            if (isEmom) {
              if (activeEmomRound === -1 || rIdx > activeEmomRound) {
                emomRoundClass = 'emom-locked opacity-40 grayscale';
              } else if (rIdx === activeEmomRound) {
                emomRoundClass = 'emom-active ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950 rounded-3xl p-1 bg-emerald-950/30 transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.35)]';
              } else {
                emomRoundClass = 'opacity-60 transition-opacity duration-300';
              }
            }

            return (
              <div
                key={rIdx}
                id={`circuit-${circuit.id}-round-${rIdx}`}
                className={`bg-zinc-950/60 p-4 rounded-3xl border border-zinc-800/80 shadow-sm space-y-3.5 ${emomRoundClass}`}
              >
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-arrows-spin" aria-hidden="true" />
                    Giro {rIdx + 1} {isAmrap ? (rIdx < amrapInfo.completedRounds ? '(Completato)' : '(In corso)') : `/ ${totalRounds}`}
                  </span>
                </div>

                <div className="space-y-3">
                  {circuit.exercises.map((sub, sIdx) => {
                    if (!isEditMode && sub.metricType === 'rest') {
                      return null;
                    }

                    const lastSubPerf = getLastExercisePerformance(state.sessionsV2, sub.exerciseId, sub.name);
                    const letter = String.fromCharCode(65 + sIdx);

                    const setId = `${sub.id}-${rIdx}`;
                    const isChecked = Boolean(state.checkedSets[setId]);
                    const histSet = getHistoricalSetDataV2(state.sessionsV2, rIdx + 1, sub.exerciseId, sub.name);
                    const isTimeType = sub.metricType === 'time';
                    const defaultTargetReps = histSet?.reps !== undefined 
                      ? String(histSet.reps) 
                      : (isTimeType ? String(sub.workSec || 60) : (sub.reps || '10'));
                    const actualReps = state.setReps[setId] ?? defaultTargetReps;

                    let displayWeight = state.setWeights?.[setId];
                    if (displayWeight === undefined) {
                      for (let j = rIdx - 1; j >= 0; j--) {
                        const prevId = `${sub.id}-${j}`;
                        if (state.setWeights?.[prevId] !== undefined) {
                          displayWeight = state.setWeights[prevId];
                          break;
                        }
                      }
                      if (displayWeight === undefined && histSet?.weight !== undefined && histSet.weight !== '') {
                        displayWeight = String(histSet.weight);
                      }
                      if (displayWeight === undefined) {
                        displayWeight = state.weights[sub.id] || '';
                      }
                    }

                    const isCardio = sub.metricType === 'cardio';
                    const currentEffort = isCardio ? state.setRpe[setId] : state.setRir[setId];
                    const histEffort = isCardio ? histSet?.rpe : histSet?.rir;
                    const displayEffort = currentEffort !== undefined && currentEffort !== '' ? currentEffort : histEffort;

                    const prefillData = {
                      reps: actualReps,
                      weight: displayWeight,
                      rir: !isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
                      rpe: isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
                      customFields: histSet?.customFields
                        ? Object.fromEntries(Object.entries(histSet.customFields).map(([k, v]) => [k, String(v)]))
                        : {}
                    };

                    const timerRemaining = activeInlineTimerSec?.[setId];
                    const isTimerRunning = activeInlineTimerSec?.[setId] !== undefined || Boolean(state.activeInlineTimers?.[setId]);

                    return (
                      <div key={sub.id} className="bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-800/60 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 flex items-center justify-center bg-emerald-950/60 border border-emerald-900/50 rounded text-emerald-400 font-bold text-[11px] shrink-0">
                              {letter}
                            </div>
                            <span className="font-extrabold text-xs text-white truncate">{sub.name}</span>
                          </div>
                          {(sub.videoUrl || sub.link) && (
                            <a
                              href={sub.videoUrl || sub.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                if (onOpenVideo) {
                                  e.preventDefault();
                                  onOpenVideo((sub.videoUrl || sub.link)!);
                                }
                              }}
                              aria-label={`Apri video esecuzione ${sub.name}`}
                              className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-zinc-900 text-emerald-400 hover:bg-zinc-800 transition-colors border border-zinc-700/60 shadow-sm shrink-0"
                            >
                              <i className="fa-solid fa-video text-sm" aria-hidden="true" />
                            </a>
                          )}
                        </div>

                        {sub.metricType !== 'cardio' && (
                          <div className="flex items-center bg-zinc-950/80 rounded-xl px-2 border border-zinc-800/60 min-h-11">
                            <div className="px-2 text-zinc-400 text-xs">
                              <i className="fa-solid fa-weight-hanging" aria-hidden="true" />
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={!isWorkoutActive}
                              value={displayWeight}
                              onChange={(e) => onSaveSetWeight(setId, e.target.value)}
                              placeholder={histSet?.weight ? String(histSet.weight) : "Carico (kg)"}
                              aria-label={`Carico ${sub.name} giro ${rIdx + 1}`}
                              className="bg-transparent text-white w-full py-2 min-h-11 outline-none font-bold text-base placeholder:text-zinc-400 disabled:opacity-50"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {isTimeType ? (
                            <button
                              type="button"
                              disabled={!isWorkoutActive}
                              onPointerDown={() => {
                                isLongPressRef.current = false;
                                handlePointerDown(sub.id, rIdx, sub.pause || 0, prefillData);
                              }}
                              onPointerUp={handlePointerCancel}
                              onPointerLeave={handlePointerCancel}
                              onClick={(e) => {
                                e.preventDefault();
                                if (isLongPressRef.current) {
                                  isLongPressRef.current = false;
                                  return;
                                }
                                if (isChecked) {
                                  onToggleSubSet(sub.id, rIdx, sub.pause || 0, prefillData);
                                } else {
                                  const dur = Math.max(1, parseInt(String(actualReps)) || sub.workSec || 60);
                                  onRunInlineTimer(setId, dur, sub.pause || 0, prefillData);
                                }
                              }}
                              aria-label={isChecked ? `${sub.name} giro ${rIdx + 1} completato` : `Avvia timer ${sub.name} giro ${rIdx + 1} (${actualReps}s)`}
                              aria-pressed={isChecked}
                              className={`flex-1 min-h-11 py-3 px-3 rounded-xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
                                isChecked
                                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                                  : isTimerRunning
                                  ? 'bg-emerald-600 text-zinc-950 border-emerald-400 animate-pulse'
                                  : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                              }`}
                            >
                              {isTimerRunning ? `${timerRemaining !== undefined ? timerRemaining : actualReps}s` : isChecked ? <i className="fa-solid fa-check text-lg" aria-hidden="true" /> : `${actualReps}s`}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!isWorkoutActive}
                              onPointerDown={() => handlePointerDown(sub.id, rIdx, sub.pause || 0, prefillData)}
                              onPointerUp={() => handlePointerUp(sub.id, rIdx, sub.pause || 0, prefillData, actualReps)}
                              onPointerLeave={handlePointerCancel}
                              aria-label={isChecked ? `${sub.name} giro ${rIdx + 1} completato` : `Completa ${sub.name} giro ${rIdx + 1}`}
                              aria-pressed={isChecked}
                              className={`flex-1 min-h-11 py-3 px-3 rounded-xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
                                isChecked
                                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                                  : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                              }`}
                            >
                              {isChecked ? (
                                (isCardio || actualReps === defaultTargetReps) ? (
                                  <i className="fa-solid fa-check text-lg" aria-hidden="true" />
                                ) : (
                                  `${actualReps} reps`
                                )
                              ) : (
                                isCardio ? 'Fatto' : `${actualReps} reps`
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!isWorkoutActive}
                            onClick={() => onOpenEffortModal(setId, isCardio)}
                            aria-label={`${isCardio ? 'Imposta RPE' : 'Imposta RIR'} ${sub.name} giro ${rIdx + 1}`}
                            className={`border text-xs font-extrabold min-w-[88px] min-h-11 px-3 py-3 rounded-xl outline-none uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] shrink-0 ${
                              currentEffort !== undefined && currentEffort !== ''
                                ? 'text-zinc-100 border-zinc-500 bg-zinc-700'
                                : displayEffort !== undefined && displayEffort !== ''
                                ? 'text-emerald-400 border-dashed border-emerald-700/60 bg-emerald-950/20'
                                : 'text-zinc-300 border-zinc-700/60 bg-zinc-900/50 hover:bg-zinc-800/80'
                            }`}
                          >
                            {displayEffort !== undefined && displayEffort !== ''
                              ? displayEffort === '-1'
                                ? 'CED'
                                : `${isCardio ? 'RPE' : 'RIR'} ${displayEffort}`
                              : isCardio ? 'RPE' : 'RIR'}
                          </button>
                        </div>

                        {isCardio && sub.cardioFields && sub.cardioFields.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {sub.cardioFields.map(cf => (
                              <div key={cf.id} className="bg-zinc-950/80 rounded-xl border border-zinc-800/60 p-2.5 shadow-inner">
                                <span className="text-[11px] text-zinc-400 uppercase font-bold block mb-0.5 truncate">{cf.label}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  disabled={!isWorkoutActive}
                                  value={state.setCustomFields?.[setId]?.[cf.id] || ''}
                                  onChange={(e) => onSaveCustomField?.(setId, cf.id, e.target.value)}
                                  placeholder={histSet?.customFields?.[cf.id] ? String(histSet.customFields[cf.id]) : cf.unit}
                                  aria-label={`${cf.label} ${sub.name} giro ${rIdx + 1}`}
                                  className="bg-transparent text-white text-base font-bold w-full outline-none min-h-11 placeholder:text-zinc-400 disabled:opacity-50"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          circuit.exercises.map((sub, sIdx) => {
            if (!isEditMode && sub.metricType === 'rest') {
              return null;
            }

            const lastSubPerf = getLastExercisePerformance(state.sessionsV2, sub.exerciseId, sub.name);
            const currentWeight = state.weights[sub.id] || (lastSubPerf?.weight !== undefined ? String(lastSubPerf.weight) : '');
            const letter = String.fromCharCode(65 + sIdx);
            const coachAdvice = subCoachAdvices[sub.id];

            return (
              <div key={sub.id} className="bg-zinc-950/50 p-4 rounded-3xl border border-zinc-800/60 shadow-sm">
              {/* Intestazione Esercizio Interno */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 flex items-center justify-center bg-emerald-950/60 border border-emerald-900/50 rounded-md text-emerald-400 font-bold text-xs shrink-0">
                    {letter}
                  </div>
                  <h4 className="font-bold text-zinc-100 text-sm leading-tight truncate">
                    {sub.name}
                  </h4>
                </div>
                {(sub.videoUrl || sub.link) && (
                  <a
                    href={sub.videoUrl || sub.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (onOpenVideo) {
                        e.preventDefault();
                        onOpenVideo((sub.videoUrl || sub.link)!);
                      }
                    }}
                    aria-label={`Apri video esecuzione ${sub.name}`}
                    className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-zinc-900 text-emerald-400 hover:bg-zinc-800 transition-colors border border-zinc-700/60 shadow-sm shrink-0"
                  >
                    <i className="fa-solid fa-video text-sm" aria-hidden="true" />
                  </a>
                )}
              </div>

                {/* Sub Exercise Coach Advice */}
                {coachAdvice && (coachAdvice.compactText || coachAdvice.message) && (
                  isWorkoutActive ? (
                    <div className="mb-3 flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] font-bold shadow-sm max-w-full truncate">
                        {coachAdvice.badge === 'increase' ? (
                          <i className="fa-solid fa-arrow-trend-up text-emerald-400 text-[11px] shrink-0" aria-hidden="true" />
                        ) : coachAdvice.badge === 'stall' ? (
                          <i className="fa-solid fa-triangle-exclamation text-amber-400 text-[11px] shrink-0" aria-hidden="true" />
                        ) : coachAdvice.badge === 'decrease' ? (
                          <i className="fa-solid fa-arrow-trend-down text-rose-400 text-[11px] shrink-0" aria-hidden="true" />
                        ) : (
                          <i className="fa-solid fa-bullseye text-emerald-400 text-[11px] shrink-0" aria-hidden="true" />
                        )}
                        <span className={coachAdvice.badge === 'increase' ? 'text-emerald-400 font-black truncate' : 'text-zinc-300 font-black truncate'}>
                          {coachAdvice.compactText || coachAdvice.title}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-2xl mb-3 flex items-start gap-2.5 text-xs shadow-inner border ${
                        coachAdvice.badge === 'increase'
                          ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                          : coachAdvice.badge === 'stall' || coachAdvice.badge === 'deload'
                          ? 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                          : coachAdvice.badge === 'decrease'
                          ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 opacity-90">
                        {coachAdvice.badge === 'increase' ? (
                          <i className="fa-solid fa-arrow-trend-up text-emerald-400" aria-hidden="true" />
                        ) : coachAdvice.badge === 'stall' ? (
                          <i className="fa-solid fa-triangle-exclamation text-amber-400" aria-hidden="true" />
                        ) : (
                          <i className="fa-solid fa-robot text-emerald-400" aria-hidden="true" />
                        )}
                      </div>
                      <div className="leading-relaxed">
                        <b className="tracking-wide">{coachAdvice.title}:</b> {coachAdvice.message}
                      </div>
                    </div>
                  )
                )}

                {/* Weight Input */}
                {sub.metricType !== 'cardio' && (
                  <div className="flex items-center bg-zinc-950/80 rounded-2xl px-2 mb-3 border border-zinc-800/60 shadow-inner focus-within:border-emerald-500/50 transition-colors min-h-11">
                    <div className="px-2.5 text-zinc-400 text-xs">
                      <i className="fa-solid fa-weight-hanging" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!isWorkoutActive}
                      value={currentWeight}
                      onChange={(e) => onSaveWeight(sub.id, e.target.value)}
                      placeholder="Carico (kg)"
                      aria-label={`Carico predefinito ${sub.name}`}
                      className="bg-transparent text-white w-full py-2 min-h-11 outline-none font-bold text-base placeholder:text-zinc-400 disabled:opacity-50"
                    />
                  </div>
                )}

                {/* Rounds Inputs */}
                <div className="space-y-2.5">
                  {roundsArray.map((rIdx) => {
                    const setId = `${sub.id}-${rIdx}`;
                    const isChecked = Boolean(state.checkedSets[setId]);
                    const histSet = getHistoricalSetDataV2(state.sessionsV2, rIdx + 1, sub.exerciseId, sub.name);
                    const isTimeType = sub.metricType === 'time';
                    const defaultTargetReps = histSet?.reps !== undefined 
                      ? String(histSet.reps) 
                      : (isTimeType ? String(sub.workSec || 60) : (sub.reps || '10'));
                    const actualReps = state.setReps[setId] ?? defaultTargetReps;

                    let displayWeight = state.setWeights?.[setId];
                    if (displayWeight === undefined) {
                      for (let j = rIdx - 1; j >= 0; j--) {
                        const prevId = `${sub.id}-${j}`;
                        if (state.setWeights?.[prevId] !== undefined) {
                          displayWeight = state.setWeights[prevId];
                          break;
                        }
                      }
                      if (displayWeight === undefined && histSet?.weight !== undefined && histSet.weight !== '') {
                        displayWeight = String(histSet.weight);
                      }
                      if (displayWeight === undefined) {
                        displayWeight = state.weights[sub.id] || '';
                      }
                    }

                    const isCardio = sub.metricType === 'cardio';
                    const currentEffort = isCardio ? state.setRpe[setId] : state.setRir[setId];
                    const histEffort = isCardio ? histSet?.rpe : histSet?.rir;
                    const displayEffort = currentEffort !== undefined && currentEffort !== '' ? currentEffort : histEffort;

                    const prefillData = {
                      reps: actualReps,
                      weight: displayWeight,
                      rir: !isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
                      rpe: isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
                      customFields: histSet?.customFields
                        ? Object.fromEntries(Object.entries(histSet.customFields).map(([k, v]) => [k, String(v)]))
                        : {}
                    };

                    const timerRemaining = activeInlineTimerSec?.[setId];
                    const isTimerRunning = activeInlineTimerSec?.[setId] !== undefined || Boolean(state.activeInlineTimers?.[setId]);

                    let emomClass = '';
                    if (isEmom) {
                      if (activeEmomRound === -1 || rIdx > activeEmomRound) {
                        emomClass = 'emom-locked opacity-40 grayscale';
                      } else if (rIdx === activeEmomRound) {
                        emomClass = 'emom-active ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950 rounded-2xl p-1 bg-emerald-950/30 transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.35)]';
                      } else {
                        emomClass = 'opacity-60 transition-opacity duration-300';
                      }
                    }

                    return (
                      <div key={rIdx} className="flex flex-col gap-1.5">
                        <div className={`flex items-center gap-2 transition-all duration-300 ${emomClass}`}>
                          <span className="text-xs font-black text-zinc-300 w-12 min-h-11 flex items-center justify-center uppercase bg-zinc-950/80 border border-zinc-800/80 rounded-2xl shadow-sm shrink-0">
                            G{rIdx + 1}
                          </span>
                          {isTimeType ? (
                            <button
                              type="button"
                              disabled={!isWorkoutActive}
                              onPointerDown={() => {
                                isLongPressRef.current = false;
                                handlePointerDown(sub.id, rIdx, sub.pause || 0, prefillData);
                              }}
                              onPointerUp={handlePointerCancel}
                              onPointerLeave={handlePointerCancel}
                              onClick={(e) => {
                                e.preventDefault();
                                if (isLongPressRef.current) {
                                  isLongPressRef.current = false;
                                  return;
                                }
                                if (isChecked) {
                                  onToggleSubSet(sub.id, rIdx, sub.pause || 0, prefillData);
                                } else {
                                  const dur = Math.max(1, parseInt(String(actualReps)) || sub.workSec || 60);
                                  onRunInlineTimer(setId, dur, sub.pause || 0, prefillData);
                                }
                              }}
                              aria-label={isChecked ? `${sub.name} giro ${rIdx + 1} completato` : `Avvia timer ${sub.name} giro ${rIdx + 1}`}
                              aria-pressed={isChecked}
                              className={`flex-1 min-h-11 py-3 px-2 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
                                isChecked
                                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                                  : isTimerRunning
                                  ? 'bg-emerald-600 text-zinc-950 border-emerald-400 animate-pulse'
                                  : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                              }`}
                            >
                              {isTimerRunning ? `${timerRemaining !== undefined ? timerRemaining : actualReps}s` : isChecked ? <i className="fa-solid fa-check text-lg" aria-hidden="true" /> : `${actualReps}s`}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!isWorkoutActive}
                              onPointerDown={() => handlePointerDown(sub.id, rIdx, sub.pause || 0, prefillData)}
                              onPointerUp={() => handlePointerUp(sub.id, rIdx, sub.pause || 0, prefillData, actualReps)}
                              onPointerLeave={handlePointerCancel}
                              aria-label={isChecked ? `${sub.name} giro ${rIdx + 1} completato` : `Completa ${sub.name} giro ${rIdx + 1}`}
                              aria-pressed={isChecked}
                              className={`flex-1 min-h-11 py-3 px-2 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
                                isChecked
                                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                                  : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                              }`}
                            >
                              {isChecked ? (
                                (isCardio || actualReps === defaultTargetReps) ? (
                                  <i className="fa-solid fa-check text-lg" aria-hidden="true" />
                                ) : (
                                  `${actualReps} reps`
                                )
                              ) : (
                                isCardio ? 'Fatto' : `${actualReps} reps`
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!isWorkoutActive}
                            onClick={() => onOpenEffortModal(setId, isCardio)}
                            aria-label={`${isCardio ? 'Imposta RPE' : 'Imposta RIR'} ${sub.name} giro ${rIdx + 1}`}
                            className={`border text-xs font-extrabold min-w-[84px] min-h-11 px-3 py-3 rounded-2xl outline-none uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] shrink-0 ${
                              currentEffort !== undefined && currentEffort !== ''
                                ? 'text-zinc-100 border-zinc-500 bg-zinc-700'
                                : displayEffort !== undefined && displayEffort !== ''
                                ? 'text-emerald-400 border-dashed border-emerald-700/60 bg-emerald-950/20'
                                : 'text-zinc-300 border-zinc-700/60 bg-zinc-900/50 hover:bg-zinc-800/80'
                            }`}
                          >
                            {displayEffort !== undefined && displayEffort !== ''
                              ? displayEffort === '-1'
                                ? 'CED'
                                : `${isCardio ? 'RPE' : 'RIR'} ${displayEffort}`
                              : isCardio ? 'RPE' : 'RIR'}
                          </button>
                        </div>

                        {isCardio && sub.cardioFields && sub.cardioFields.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {sub.cardioFields.map(cf => (
                              <div key={cf.id} className="bg-zinc-950/80 rounded-xl border border-zinc-800/60 p-2.5 shadow-inner">
                                <span className="text-[11px] text-zinc-400 uppercase font-bold block mb-0.5 truncate">{cf.label}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  disabled={!isWorkoutActive}
                                  value={state.setCustomFields?.[setId]?.[cf.id] || ''}
                                  onChange={(e) => onSaveCustomField?.(setId, cf.id, e.target.value)}
                                  placeholder={histSet?.customFields?.[cf.id] ? String(histSet.customFields[cf.id]) : cf.unit}
                                  aria-label={`${cf.label} ${sub.name} giro ${rIdx + 1}`}
                                  className="bg-transparent text-white text-base font-bold w-full outline-none min-h-11 placeholder:text-zinc-400 disabled:opacity-50"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Classic Circuit Round Rest Buttons */}
      {!isEmom && !isAmrap && (
        <div className="mt-5 pt-4 border-t border-zinc-800/60 flex flex-wrap gap-2 pl-2">
          {Array.from({ length: totalRounds }).map((_, rIdx) => {
            const roundKey = `${circuit.id}-round-${rIdx}`;
            const isDone = Boolean(state.checkedSets[roundKey]);
            const pauseSec = circuit.pause !== undefined ? circuit.pause : 90;
            return (
              <button
                key={rIdx}
                type="button"
                disabled={!isWorkoutActive}
                onClick={() => onStartRoundRest(pauseSec, rIdx)}
                aria-pressed={isDone}
                className={`flex-1 min-h-11 py-3 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border outline-none active:scale-[0.98] shadow-sm ${
                  isDone
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                    : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <i className="fa-regular fa-clock" aria-hidden="true" />
                {isDone
                  ? `Giro ${rIdx + 1} ✓`
                  : pauseSec === 0
                  ? `Fine Giro ${rIdx + 1}`
                  : `Rec. Giro ${rIdx + 1} (${pauseSec}s)`}
              </button>
            );
          })}
        </div>
      )}

      {/* Coach Advice - Vista Ultra-Minimalista (Solo durante il Workout) */}
      {isWorkoutActive && circuitCoachAdvice && (circuitCoachAdvice.compactText || circuitCoachAdvice.message) && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/40 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] font-bold shadow-sm max-w-full truncate">
            {circuitCoachAdvice.badge === 'increase' ? (
              <i className="fa-solid fa-arrow-trend-up text-emerald-400 text-xs shrink-0" aria-hidden="true" />
            ) : circuitCoachAdvice.badge === 'decrease' ? (
              <i className="fa-solid fa-arrow-trend-down text-rose-400 text-xs shrink-0" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-bolt text-indigo-400 text-xs shrink-0" aria-hidden="true" />
            )}
            <span className={circuitCoachAdvice.badge === 'increase' ? 'text-emerald-400 font-black truncate' : 'text-zinc-300 font-black truncate'}>
              {circuitCoachAdvice.compactText || circuitCoachAdvice.title}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

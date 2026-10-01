import React, { useRef, useState } from 'react';
import { AppState, SupersetExercise } from '../types/gym';
import { formatTime } from '../utils/storage';
import { getExerciseCoachAdvice } from '../utils/coach';
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
  onToggleSubSet: (subId: string, roundIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string }) => void;
  onLongPressSubSet: (subId: string, roundIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string }) => void;
  onOpenEffortModal: (setId: string, isRpe: boolean) => void;
  onOpenVideo: (url: string) => void;
  onAddAmrapRound: () => void;
  onStartAmrapTimer: (totalMin: number) => void;
  onStartEmomTimer: (totalMin: number, intervalSec: number) => void;
  onStartRoundRest: (seconds: number, roundIndex: number) => void;
  isMasterTimerRunning: boolean;
  masterTimerRemainingSec: number;
  activeEmomRound: number;
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
  onToggleSubSet,
  onLongPressSubSet,
  onOpenEffortModal,
  onOpenVideo,
  onAddAmrapRound,
  onStartAmrapTimer,
  onStartEmomTimer,
  onStartRoundRest,
  isMasterTimerRunning,
  masterTimerRemainingSec,
  activeEmomRound
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

  const amrapRoundsCount = state.amrapRounds[circuit.id] || 0;

  if (isEditMode) {
    return (
      <div className="bg-zinc-900/60 rounded-3xl p-5 mb-5 shadow-sm border border-zinc-800/40 backdrop-blur-sm relative animate-in fade-in">
        {/* Reorder Circuit */}
        <div className="absolute -top-3 -right-2 bg-emerald-500 text-zinc-950 rounded-full flex items-center shadow-md border-2 border-zinc-950 overflow-hidden text-[10px] font-black z-10">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveCircuit(-1)}
            className="px-2 py-1 hover:bg-emerald-400 disabled:opacity-30 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-up" />
          </button>
          <div className="w-px h-3 bg-zinc-950/30" />
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveCircuit(1)}
            className="px-2 py-1 hover:bg-emerald-400 disabled:opacity-30 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-down" />
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex justify-between items-center gap-3">
            <select
              value={circuit.structureType}
              onChange={(e) => onUpdateCircuit('structureType', e.target.value)}
              className="bg-emerald-950/20 text-emerald-400 text-xs font-black uppercase tracking-wider p-3 rounded-2xl outline-none border border-emerald-900/50 shadow-inner"
            >
              <option value="classic">⚙️ Circuito Classico</option>
              <option value="emom">⏱️ EMOM</option>
              <option value="amrap">🔥 AMRAP</option>
            </select>
            <button
              type="button"
              onClick={onDeleteCircuit}
              className="text-rose-400 p-3 bg-rose-950/30 border border-rose-900/30 rounded-2xl outline-none hover:bg-rose-900/50 active:scale-95 transition-all shadow-sm"
            >
              <i className="fa-solid fa-trash text-sm" />
            </button>
          </div>
          <input
            type="text"
            value={circuit.name}
            onChange={(e) => onUpdateCircuit('name', e.target.value)}
            placeholder="Nome Circuito"
            className="bg-zinc-950 text-white font-extrabold p-3.5 rounded-2xl w-full outline-none text-sm border border-zinc-800/80 shadow-inner focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Structure Parameters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {!isEmom && !isAmrap && (
            <>
              <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-1 min-w-[90px] shadow-inner">
                <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-8 tracking-wider">Giri</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={circuit.rounds !== undefined ? circuit.rounds : 3}
                  onChange={(e) => onUpdateCircuit('rounds', parseInt(e.target.value) || 0)}
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-sm"
                />
              </div>
              <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-[2] min-w-[140px] shadow-inner">
                <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-14 tracking-wider">Recupero</span>
                <div className="flex items-center w-full gap-2 justify-end">
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
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-colors ${circuit.pause !== 0 ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'}`}
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
                      className="bg-transparent text-white font-bold w-12 text-center outline-none text-sm"
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {isEmom && (
            <>
              <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-1 min-w-[100px] shadow-inner">
                <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-16 tracking-wider">Min. Totali</span>
                <input
                  type="number"
                  min={1}
                  value={circuit.emomTotalMin !== undefined ? circuit.emomTotalMin : 10}
                  onChange={(e) => onUpdateCircuit('emomTotalMin', parseInt(e.target.value, 10) || 0)}
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-sm"
                />
              </div>
              <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-1 min-w-[100px] shadow-inner">
                <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-16 tracking-wider">Sec/Giro</span>
                <input
                  type="number"
                  min={5}
                  value={circuit.emomIntervalSec !== undefined ? circuit.emomIntervalSec : 60}
                  onChange={(e) => onUpdateCircuit('emomIntervalSec', parseInt(e.target.value, 10) || 0)}
                  className="bg-transparent text-white font-bold w-full text-center outline-none text-sm"
                />
              </div>
            </>
          )}

          {isAmrap && (
            <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-1 min-w-[100px] shadow-inner">
              <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-16 tracking-wider">Min. Totali</span>
              <input
                type="number"
                min={1}
                value={circuit.amrapTotalMin !== undefined ? circuit.amrapTotalMin : 10}
                onChange={(e) => onUpdateCircuit('amrapTotalMin', parseInt(e.target.value, 10) || 0)}
                className="bg-transparent text-white font-bold w-full text-center outline-none text-sm"
              />
            </div>
          )}
        </div>

        {/* Sub-exercises edit list */}
        <div className="space-y-4">
          {circuit.exercises.map((sub, sIdx) => {
            const isFirstSub = sIdx === 0;
            const isLastSub = sIdx === circuit.exercises.length - 1;

            if (sub.metricType === 'rest') {
              return (
                <div key={sub.id} className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/80 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <i className="fa-regular fa-clock text-zinc-500 text-sm" />
                    <span className="text-xs font-bold text-zinc-300">Pausa:</span>
                    <input
                      type="number"
                      min={0}
                      value={sub.restSeconds || 30}
                      onChange={(e) => onUpdateSubEx(sub.id, 'restSeconds', Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-zinc-900 text-white font-bold w-16 p-2 rounded-xl text-center border border-zinc-700/50 text-xs shadow-inner focus:border-emerald-500 outline-none transition-colors"
                    />
                    <span className="text-xs text-zinc-500 font-medium">sec</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isFirstSub}
                      onClick={() => onMoveSubEx(sub.id, -1)}
                      className="w-8 h-8 rounded-xl bg-zinc-900 text-zinc-400 disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-up text-[10px]" />
                    </button>
                    <button
                      type="button"
                      disabled={isLastSub}
                      onClick={() => onMoveSubEx(sub.id, 1)}
                      className="w-8 h-8 rounded-xl bg-zinc-900 text-zinc-400 disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-down text-[10px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubEx(sub.id)}
                      className="w-8 h-8 rounded-xl bg-rose-950/40 text-rose-400 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-trash text-[10px]" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={sub.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/80 space-y-3 shadow-sm">
                <div className="flex justify-between items-center gap-3">
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                    {String.fromCharCode(65 + sIdx)}
                  </span>
                  <input
                    type="text"
                    value={sub.name}
                    onChange={(e) => onUpdateSubEx(sub.id, 'name', e.target.value)}
                    placeholder="Nome Esercizio"
                    className="bg-zinc-900 text-white font-bold p-3 rounded-2xl text-xs w-full border border-zinc-700/50 outline-none shadow-inner focus:border-emerald-500 transition-colors"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isFirstSub}
                      onClick={() => onMoveSubEx(sub.id, -1)}
                      className="w-8 h-8 rounded-xl bg-zinc-900 text-zinc-400 disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-up text-[10px]" />
                    </button>
                    <button
                      type="button"
                      disabled={isLastSub}
                      onClick={() => onMoveSubEx(sub.id, 1)}
                      className="w-8 h-8 rounded-xl bg-zinc-900 text-zinc-400 disabled:opacity-30 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-chevron-down text-[10px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubEx(sub.id)}
                      className="w-8 h-8 rounded-xl bg-rose-950/40 text-rose-400 active:scale-95 transition-all"
                    >
                      <i className="fa-solid fa-trash text-[10px]" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={sub.metricType}
                    onChange={(e) => onUpdateSubEx(sub.id, 'metricType', e.target.value)}
                    className="bg-zinc-900 text-zinc-300 text-[10px] font-bold p-2.5 rounded-2xl border border-zinc-700/50 shadow-inner outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="weight">Pesi</option>
                    <option value="bodyweight">C. Libero</option>
                    <option value="time">A Tempo</option>
                  </select>
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
                    placeholder="Reps / Sec"
                    className="bg-zinc-900 text-white text-xs font-bold p-2.5 rounded-2xl border border-zinc-700/50 text-center shadow-inner outline-none focus:border-emerald-500 transition-colors"
                  />
                  <input
                    type="number"
                    min={0}
                    value={sub.pause || 0}
                    onChange={(e) => onUpdateSubEx(sub.id, 'pause', Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Pausa s"
                    className="bg-zinc-900 text-white text-xs font-bold p-2.5 rounded-2xl border border-zinc-700/50 text-center shadow-inner outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-2 flex-col sm:flex-row">
            <button
              type="button"
              onClick={onAddSubEx}
              className="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-2xl font-bold border border-zinc-700 text-xs transition-all active:scale-[0.98] shadow-sm"
            >
              <i className="fa-solid fa-plus mr-1" /> Aggiungi Esercizio
            </button>
            <button
              type="button"
              onClick={onAddRestBlock}
              className="flex-1 py-3.5 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 rounded-2xl font-bold border border-zinc-700/50 text-xs transition-all active:scale-[0.98] shadow-sm"
            >
              <i className="fa-regular fa-clock mr-1" /> + Pausa Intermedia
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pointer down/up handler for press / long press
  const handlePointerDown = (subId: string, roundIdx: number, pauseSec: number, prefillData: any) => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPressSubSet(subId, roundIdx, pauseSec, prefillData);
    }, 450);
  };

  const handlePointerUp = (subId: string, roundIdx: number, pauseSec: number, prefillData: any) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      onToggleSubSet(subId, roundIdx, pauseSec, prefillData);
    }
  };

  const handlePointerCancel = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    isLongPressRef.current = false;
  };

  return (
    <div
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
            <span className="text-[10px] uppercase font-black px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tracking-wider">
              {isEmom
                ? `EMOM ${circuit.emomTotalMin || 10}' (Ogni ${circuit.emomIntervalSec || 60}s)`
                : isAmrap
                ? `AMRAP ${circuit.amrapTotalMin || 10}'`
                : `Circuito (${circuit.rounds || 3} Giri)`}
            </span>
          </div>
          <h3 className="text-lg font-black text-white leading-tight flex items-baseline gap-1.5">
            <span className="text-emerald-500 font-black opacity-90">{index}.</span>
            {circuit.name}
            {!isEmom && !isAmrap && circuit.pause === 0 && (
              <span className="ml-2 text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider font-black translate-y-[-2px] shrink-0">
                NO REC
              </span>
            )}
          </h3>
        </div>
      </div>

      {/* AMRAP or EMOM Timers */}
      {isAmrap && (
        <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800/80 mb-5 flex items-center justify-between shadow-inner ml-2">
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Timer AMRAP</div>
            <div className="text-2xl font-black text-amber-400 font-mono tracking-tight mt-0.5">
              {isMasterTimerRunning ? formatTime(masterTimerRemainingSec) : `${circuit.amrapTotalMin || 10}:00`}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!isWorkoutActive}
              onClick={() => onStartAmrapTimer(circuit.amrapTotalMin || 10)}
              className={`px-4 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-sm ${
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
              onClick={onAddAmrapRound}
              className="bg-zinc-800 hover:bg-zinc-700 text-emerald-400 px-4 py-3 rounded-2xl font-black text-xs border border-zinc-700 active:scale-95 transition-all shadow-sm"
            >
              +1 Giro ({amrapRoundsCount})
            </button>
          </div>
        </div>
      )}

      {isEmom && (
        <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800/80 mb-5 flex items-center justify-between shadow-inner ml-2">
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
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
            className={`px-5 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-sm ${
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
        {circuit.exercises.map((sub, sIdx) => {
          if (sub.metricType === 'rest') {
            return (
              <div
                key={sub.id}
                className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-center text-xs text-zinc-400 flex items-center justify-center gap-2 shadow-inner"
              >
                <i className="fa-regular fa-clock text-zinc-500" />
                <span className="font-medium">Pausa tra gli esercizi: {sub.restSeconds || 30}s</span>
              </div>
            );
          }

          // 🔴 CANONICAL V2: Ultima prestazione letta dalle sessioni storiche immutabili
          const lastSubPerf = getLastExercisePerformance(state.sessionsV2, sub.exerciseId, sub.name);
          const currentWeight = state.weights[sub.id] || (lastSubPerf?.weight !== undefined ? String(lastSubPerf.weight) : '');
          const letter = String.fromCharCode(65 + sIdx);
          const coachAdvice = getExerciseCoachAdvice(state, sub.id, sub.reps || '10', sub.metricType, true, sub.name, sub.exerciseId);

          return (
            <div key={sub.id} className="bg-zinc-950/50 p-4 rounded-3xl border border-zinc-800/60 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    {letter}
                  </span>
                  <span className="font-extrabold text-sm text-white">{sub.name}</span>
                </div>
                {/* 🔴 BUG FIX: Icona video solo se c'è un link reale */}
                {sub.link && sub.link.trim() !== '' && !isEditMode && (
                  <button
                    type="button"
                    onClick={() => onOpenVideo(sub.link!)}
                    className="text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 p-2 rounded-xl border border-emerald-900/40 transition-all active:scale-95 shadow-sm"
                  >
                    <i className="fa-solid fa-video text-[10px]" />
                  </button>
                )}
              </div>

              {/* Sub Exercise Coach Advice */}
              {coachAdvice && coachAdvice.message && (
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
                      <i className="fa-solid fa-arrow-trend-up text-emerald-400" />
                    ) : coachAdvice.badge === 'stall' ? (
                      <i className="fa-solid fa-triangle-exclamation text-amber-400" />
                    ) : (
                      <i className="fa-solid fa-robot text-emerald-500" />
                    )}
                  </div>
                  <div className="leading-relaxed">
                    <b className="tracking-wide">{coachAdvice.title}:</b> {coachAdvice.message}
                  </div>
                </div>
              )}

              {/* Weight Input */}
              {sub.metricType !== 'cardio' && (
                <div className="flex items-center bg-zinc-950/80 rounded-2xl p-1.5 mb-3 border border-zinc-800/60 shadow-inner focus-within:border-emerald-500/50 transition-colors">
                  <div className="px-3 text-zinc-500 text-xs">
                    <i className="fa-solid fa-weight-hanging" />
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!isWorkoutActive}
                    value={currentWeight}
                    onChange={(e) => onSaveWeight(sub.id, e.target.value)}
                    placeholder="Carico (kg)"
                    className="bg-transparent text-white w-full py-1.5 outline-none font-bold text-xs disabled:opacity-50"
                  />
                </div>
              )}

              {/* Rounds Inputs */}
              <div className="space-y-2.5">
                {Array.from({ length: totalRounds }).map((_, rIdx) => {
                  const setId = `${sub.id}-${rIdx}`;
                  const isChecked = Boolean(state.checkedSets[setId]);
                  const histSet = getHistoricalSetDataV2(state.sessionsV2, rIdx + 1, sub.exerciseId, sub.name);
                  const defaultTargetReps = histSet?.reps !== undefined ? String(histSet.reps) : (sub.reps || '10');
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

                  // 🔴 BUG FIX: Gestione RPE per il Cardio nei Circuiti
                  const isCardio = sub.metricType === 'cardio';
                  const currentEffort = isCardio ? state.setRpe[setId] : state.setRir[setId];
                  const histEffort = isCardio ? histSet?.rpe : histSet?.rir;
                  const displayEffort = currentEffort !== undefined && currentEffort !== '' ? currentEffort : histEffort;
                  
                  const prefillData = {
                    reps: actualReps,
                    weight: displayWeight,
                    rir: !isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
                    rpe: isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined
                  };
                  
                  let emomClass = '';
                  if (isEmom) {
                    if (activeEmomRound === -1 || rIdx > activeEmomRound) {
                      emomClass = 'emom-locked';
                    } else if (rIdx === activeEmomRound) {
                      emomClass = 'emom-active';
                    } else {
                      emomClass = 'opacity-60';
                    }
                  }

                  return (
                    <div key={rIdx} className={`flex items-center gap-2.5 ${emomClass}`}>
                      <span className="text-[10px] font-black text-zinc-500 w-12 uppercase bg-zinc-950/80 border border-zinc-800/80 px-2 py-3.5 rounded-2xl text-center shadow-sm">
                        G{rIdx + 1}
                      </span>
                      <button
                        type="button"
                        disabled={!isWorkoutActive}
                        onPointerDown={() => handlePointerDown(sub.id, rIdx, sub.pause || 0, prefillData)}
                        onPointerUp={() => handlePointerUp(sub.id, rIdx, sub.pause || 0, prefillData)}
                        onPointerLeave={handlePointerCancel}
                        className={`w-28 py-3.5 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
                          isChecked
                            ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                            : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                        }`}
                      >
                        {isChecked ? (
                          actualReps !== defaultTargetReps ? (
                            `${actualReps} reps`
                          ) : (
                            <i className="fa-solid fa-check text-lg" />
                          )
                        ) : (
                          `${actualReps} reps`
                        )}
                      </button>
                      {/* 🔴 BUG FIX: Mostra RPE o RIR */}
                      <button
                        type="button"
                        disabled={!isWorkoutActive}
                        onClick={() => onOpenEffortModal(setId, isCardio)}
                        className={`border text-[10px] font-extrabold flex-1 py-3.5 rounded-2xl outline-none uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] ${
                          currentEffort !== undefined && currentEffort !== ''
                            ? 'text-zinc-100 border-zinc-500 bg-zinc-700'
                            : displayEffort !== undefined && displayEffort !== ''
                            ? 'text-emerald-400 border-dashed border-emerald-700/60 bg-emerald-950/20'
                            : 'text-zinc-400 border-zinc-700/60 bg-zinc-900/50 hover:bg-zinc-800/80'
                        }`}
                      >
                        {displayEffort !== undefined && displayEffort !== ''
                          ? displayEffort === '-1'
                            ? 'CED'
                            : `${isCardio ? 'RPE' : 'RIR'} ${displayEffort}`
                          : isCardio ? 'RPE' : 'RIR'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Classic Circuit Round Rest Buttons */}
      {!isEmom && !isAmrap && (circuit.pause || 0) > 0 && (
        <div className="mt-5 pt-4 border-t border-zinc-800/60 flex flex-wrap gap-2 pl-2">
          {Array.from({ length: totalRounds }).map((_, rIdx) => {
            const roundKey = `${circuit.id}-round-${rIdx}`;
            const isDone = Boolean(state.checkedSets[roundKey]);
            return (
              <button
                key={rIdx}
                type="button"
                disabled={!isWorkoutActive}
                onClick={() => onStartRoundRest(circuit.pause || 90, rIdx)}
                className={`flex-1 py-3 px-3 rounded-2xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 border outline-none active:scale-[0.98] shadow-sm ${
                  isDone
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <i className="fa-regular fa-clock" />
                {isDone ? `Giro ${rIdx + 1} ✓` : `Rec. Giro ${rIdx + 1} (${circuit.pause || 90}s)`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

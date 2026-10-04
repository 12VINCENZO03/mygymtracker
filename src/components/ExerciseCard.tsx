import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { AppState, SingleExercise } from '../types/gym';
import { getExerciseCoachAdvice } from '../utils/coach';
import { getLastExercisePerformance, getHistoricalSetDataV2 } from '../utils/domain';

interface ExerciseCardProps {
  ex: SingleExercise;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isWorkoutActive: boolean;
  isEditMode: boolean;
  state: AppState;
  onUpdateEx: (field: string, value: unknown) => void;
  onDeleteEx: () => void;
  onMoveEx: (dir: number) => void;
  onSaveWeight: (val: string) => void;
  onSaveSetWeight: (setId: string, val: string) => void;
  onSaveCustomField: (setId: string, fieldId: string, val: string) => void;
  onUpdateRegistry?: (permId: string, field: string, val: any) => void;
  onToggleSet: (setIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, string> }) => void;
  onLongPressSet: (setIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, string> }) => void;
  onOpenEffortModal: (setId: string, isRpe: boolean) => void;
  onOpenVideo: (url: string) => void;
  onRunInlineTimer: (setId: string, durationSec: number, pauseSec: number, prefill: { weight: string; rir?: string; rpe?: string }) => void;
  activeInlineTimerSec: Record<string, number>;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  ex,
  index,
  isFirst,
  isLast,
  isWorkoutActive,
  isEditMode,
  state,
  onUpdateEx,
  onDeleteEx,
  onMoveEx,
  onSaveWeight,
  onSaveSetWeight,
  onSaveCustomField, // 🔴 AGGIUNTO
  onUpdateRegistry,
  onToggleSet,
  onLongPressSet,
  onOpenEffortModal,
  onOpenVideo,
  onRunInlineTimer,
  activeInlineTimerSec
}) => {
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const regData = ex.exerciseId && state.registryV2 ? state.registryV2[ex.exerciseId] : null;

  // 🔴 CANONICAL V2: Ultima prestazione letta dalle sessioni storiche immutabili
  const lastPerf = getLastExercisePerformance(state.sessionsV2, ex.exerciseId, ex.name);
  const coachAdvice = React.useMemo(() => {
    return getExerciseCoachAdvice(state, ex.id, ex.reps, ex.metricType, false, ex.name, ex.exerciseId);
  }, [state.sessionsV2, state.bodyGoal, state.deloadActive, ex.id, ex.reps, ex.metricType, ex.name, ex.exerciseId]);

  const getHistoricalSetData = (setIdx: number) => {
    return getHistoricalSetDataV2(state.sessionsV2, setIdx + 1, ex.exerciseId, ex.name);
  };

  if (isEditMode) {
    return (
      <div className="bg-zinc-900/60 rounded-3xl p-5 mb-5 shadow-sm border border-zinc-800/40 backdrop-blur-sm relative animate-in fade-in">
        <div className="absolute -top-3 -right-2 bg-emerald-500 text-zinc-950 rounded-full flex items-center shadow-md border-2 border-zinc-950 overflow-hidden text-[10px] font-black z-10">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveEx(-1)}
            className="px-2 py-1 hover:bg-emerald-400 disabled:opacity-30 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-up" />
          </button>
          <div className="w-px h-3 bg-zinc-950/30" />
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveEx(1)}
            className="px-2 py-1 hover:bg-emerald-400 disabled:opacity-30 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-down" />
          </button>
        </div>

        <div className="flex justify-between items-start gap-3 mb-3">
          <select
            value={ex.metricType}
            onChange={(e) => onUpdateEx('metricType', e.target.value)}
            className="bg-zinc-950 text-zinc-300 text-xs font-bold p-3 rounded-2xl outline-none border border-zinc-800/80 w-1/3 shrink-0 shadow-inner"
          >
            <option value="weight">Pesi</option>
            <option value="bodyweight">C. Libero</option>
            <option value="time">Tempo</option>
            <option value="cardio">Cardio</option>
          </select>
          <input
            type="text"
            value={ex.name}
            onChange={(e) => onUpdateEx('name', e.target.value)}
            placeholder="Nome Esercizio"
            className="bg-zinc-950 text-white font-bold p-3 rounded-2xl w-full outline-none border border-zinc-800/80 text-sm shadow-inner focus:border-emerald-500 transition-colors"
          />
          <button
            type="button"
            onClick={onDeleteEx}
            className="text-rose-400 p-3 bg-rose-950/30 border border-rose-900/30 rounded-2xl outline-none shrink-0 hover:bg-rose-900/50 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-trash text-sm" />
          </button>
        </div>

        {ex.metricType !== 'cardio' && (
          <input
            type="text"
            value={ex.link || ''}
            onChange={(e) => onUpdateEx('link', e.target.value)}
            placeholder="Link video esecuzione (YouTube / Google Drive)"
            className="w-full bg-zinc-950 text-zinc-400 text-xs font-medium p-3 rounded-2xl mb-4 border border-zinc-800/80 outline-none shadow-inner focus:border-emerald-500 transition-colors"
          />
        )}

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-1 min-w-[90px] shadow-inner">
            <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-8 tracking-wider">Serie</span>
            <input
              type="number"
              min={1}
              max={20}
              value={ex.sets}
              onChange={(e) => onUpdateEx('sets', Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-transparent text-white font-bold w-full text-center outline-none text-sm"
            />
          </div>
          <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-1 min-w-[90px] shadow-inner">
            <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-8 tracking-wider">
              {ex.metricType === 'time' ? 'Sec' : 'Reps'}
            </span>
            <input
              type="text"
              value={ex.metricType === 'time' ? (ex.workSec || 60) : ex.reps}
              onChange={(e) => onUpdateEx(ex.metricType === 'time' ? 'workSec' : 'reps', e.target.value)}
              className="bg-transparent text-white font-bold w-full text-center outline-none text-sm"
            />
          </div>
          <div className="flex items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 flex-1 min-w-[90px] shadow-inner">
            <span className="text-[9px] text-zinc-500 font-extrabold uppercase ml-2 w-10 tracking-wider">Pausa</span>
            <input
              type="number"
              step={5}
              min={0}
              value={ex.pause || 0}
              onChange={(e) => onUpdateEx('pause', Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-transparent text-white font-bold w-full text-center outline-none text-sm"
            />
          </div>
        </div>

        {/* 🔴 NUOVO: Selezionatore Macchina Cardio */}
        {ex.metricType === 'cardio' && (
          <div className="mt-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 shadow-inner">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
              Tipo di Macchina (Imposta parametri di default)
            </label>
            <select
              value={ex.cardioMachine || ''}
              onChange={(e) => {
                const machine = e.target.value;
                onUpdateEx('cardioMachine', machine);
                // 🔴 PT LOGIC: Auto-compilazione campi in base alla macchina
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
                onUpdateEx('cardioFields', defaultFields);
              }}
              className="bg-zinc-900 text-emerald-400 text-xs font-bold p-2.5 rounded-xl outline-none border border-zinc-700/50 w-full"
            >
              <option value="">Seleziona macchina...</option>
              <option value="corsa">Corsa / Tapis Roulant</option>
              <option value="vogatore">Vogatore</option>
              <option value="bike">Bike / Assault</option>
            </select>
          </div>
        )}

        {/* SETUP COACH 2.0 */}
        {regData && (
          <div className="mt-4 pt-3 border-t border-zinc-800/80">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <i className="fa-solid fa-robot" /> Setup Coach 2.0
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={regData.equipment || ''}
                onChange={(e) => onUpdateRegistry?.(ex.exerciseId!, 'equipment', e.target.value)}
                className="bg-zinc-950 text-zinc-300 text-[10px] font-bold p-2 rounded-xl border border-zinc-700/50 outline-none"
              >
                <option value="">Attrezzatura...</option>
                <option value="barbell">Bilanciere</option>
                <option value="dumbbell">Manubri</option>
                <option value="machine">Macchina</option>
                <option value="cable">Cavi</option>
                <option value="smith_machine">Multipower</option>
                <option value="bodyweight">Corpo Libero</option>
              </select>
              
              <select
                value={regData.movementPattern || ''}
                onChange={(e) => onUpdateRegistry?.(ex.exerciseId!, 'movementPattern', e.target.value)}
                className="bg-zinc-950 text-zinc-300 text-[10px] font-bold p-2 rounded-xl border border-zinc-700/50 outline-none"
              >
                <option value="">Pattern...</option>
                <option value="horizontal_push">Spinta Orizzontale</option>
                <option value="vertical_push">Spinta Verticale</option>
                <option value="horizontal_pull">Tirata Orizzontale</option>
                <option value="vertical_pull">Tirata Verticale</option>
                <option value="squat">Squat / Press</option>
                <option value="hinge">Hinge / Stacco</option>
                <option value="isolation_shoulders">Isolamento Spalle</option>
                <option value="isolation_biceps">Isolamento Bicipiti</option>
                <option value="isolation_triceps">Isolamento Tricipiti</option>
                <option value="isolation_legs">Isolamento Gambe</option>
              </select>

              <select
                value={regData.progressionModel || ''}
                onChange={(e) => onUpdateRegistry?.(ex.exerciseId!, 'progressionModel', e.target.value)}
                className="bg-zinc-950 text-zinc-300 text-[10px] font-bold p-2 rounded-xl border border-zinc-700/50 outline-none"
              >
                <option value="">Progressione...</option>
                <option value="double_progression">Doppia Progressione</option>
                <option value="time_under_tension">Time Under Tension</option>
                <option value="fixed_volume">Volume Fisso</option>
              </select>

              <div className="flex items-center bg-zinc-950 border border-zinc-700/50 rounded-xl p-1 px-2">
                <span className="text-[9px] text-zinc-500 font-bold uppercase w-12">Incr.</span>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  placeholder="kg/s"
                  value={regData.progressionIncrement || ''}
                  onChange={(e) => onUpdateRegistry?.(ex.exerciseId!, 'progressionIncrement', parseFloat(e.target.value) || 0)}
                  className="bg-transparent text-white font-bold w-full text-right outline-none text-[10px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handlePointerDown = (setIndex: number, prefillData: any) => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPressSet(setIndex, ex.pause || 0, prefillData);
    }, 450);
  };

  const handlePointerUp = (setIndex: number, pauseSec: number, prefillData: any, actualReps: string) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      if (isNaN(Number(actualReps))) {
        onLongPressSet(setIndex, pauseSec, prefillData);
      } else {
        onToggleSet(setIndex, pauseSec, prefillData);
      }
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
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      id={`ex-container-${ex.id}`}
      className={`bg-zinc-900/60 rounded-3xl p-5 sm:p-6 mb-5 relative shadow-sm border border-zinc-800/40 backdrop-blur-md transition-all ${
        !isWorkoutActive ? 'opacity-75 grayscale-[20%]' : ''
      }`}
    >
      {/* Intestazione Esercizio e Video */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-lg sm:text-xl font-black text-white leading-tight truncate">
          <span className="text-emerald-500 mr-2">{index + 1}.</span>
          {ex.name}
        </h3>
        {(ex.videoUrl || ex.link) && (
          <a
            href={ex.videoUrl || ex.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (onOpenVideo) {
                e.preventDefault();
                onOpenVideo((ex.videoUrl || ex.link)!);
              }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 text-emerald-400 hover:bg-zinc-800 transition-colors border border-zinc-700/60 shadow-sm shrink-0"
          >
            <i className="fa-solid fa-video text-xs" />
          </a>
        )}
      </div>

      {/* Coach Advice - Vista Analitica (Solo fuori dal Workout) */}
      {!isWorkoutActive && coachAdvice && coachAdvice.message && (
        <div
          className={`p-3.5 rounded-2xl mb-3 flex items-start gap-3 text-xs shadow-inner border ${
            coachAdvice.badge === 'increase'
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
              : coachAdvice.badge === 'stall' || coachAdvice.badge === 'deload'
              ? 'bg-amber-950/30 border-amber-800/40 text-amber-300'
              : coachAdvice.badge === 'decrease'
              ? 'bg-rose-950/30 border-rose-800/40 text-rose-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
          }`}
        >
          <div className="mt-0.5 shrink-0 text-sm opacity-90">
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

      {!isWorkoutActive && coachAdvice?.fatigueAlert && (
        <div className="bg-indigo-950/40 border border-indigo-700/60 text-indigo-200 text-xs p-3.5 rounded-2xl mb-4 flex items-start gap-3 shadow-inner">
          <i className="fa-solid fa-chart-line text-indigo-400 mt-0.5 text-sm shrink-0 opacity-90" />
          <div className="leading-relaxed">
            <span className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-400 block mb-0.5">
              Tendenza Fatica Cronica (4-6 sett.)
            </span>
            {coachAdvice.fatigueAlert}
          </div>
        </div>
      )}

      {/* Sets Rows */}
      <div className="space-y-2.5">
        {Array.from({ length: ex.sets }).map((_, setIdx) => {
          const setId = `${ex.id}-${setIdx}`;
          const isChecked = Boolean(state.checkedSets[setId]);
          const hist = getHistoricalSetData(setIdx);
          const defaultTargetReps = hist?.reps !== undefined ? hist.reps : (ex.reps || '10');
          const actualReps = state.setReps[setId] ?? defaultTargetReps;
          
          let displayWeight = state.setWeights?.[setId];
          if (displayWeight === undefined) {
            for (let j = setIdx - 1; j >= 0; j--) {
              const prevId = `${ex.id}-${j}`;
              if (state.setWeights?.[prevId] !== undefined) {
                displayWeight = state.setWeights[prevId];
                break;
              }
            }
            if (displayWeight === undefined && hist?.weight !== undefined && hist.weight !== '') {
              displayWeight = String(hist.weight);
            }
            if (displayWeight === undefined) {
              displayWeight = state.weights[ex.id] || '';
            }
          }

          const isCardio = ex.metricType === 'cardio';
          const currentEffort = isCardio ? state.setRpe[setId] : state.setRir[setId];
          const histEffort = isCardio ? hist?.rpe : hist?.rir;
          const displayEffort = currentEffort !== undefined && currentEffort !== '' ? currentEffort : histEffort;
          const isTimeType = ex.metricType === 'time';
          const timerRemaining = activeInlineTimerSec[setId];
          const isTimerRunning = timerRemaining !== undefined && timerRemaining > 0;

          const prefillData = {
            reps: actualReps,
            weight: displayWeight,
            rir: !isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
            rpe: isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
            customFields: hist?.customFields || {}
          };

          return (
            <div key={setIdx} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-black text-zinc-500 w-12 uppercase tracking-wider bg-zinc-950/80 border border-zinc-800/80 px-2 py-3.5 rounded-2xl text-center shadow-sm shrink-0">
                  S{setIdx + 1}
                </span>
                {ex.metricType !== 'cardio' && (
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!isWorkoutActive}
                    value={displayWeight}
                    onChange={(e) => onSaveSetWeight(setId, e.target.value)}
                    placeholder={ex.metricType === 'bodyweight' ? '+kg' : 'kg'}
                    className="bg-zinc-950/80 text-white w-16 py-3.5 rounded-2xl border border-zinc-800/80 text-center font-bold text-sm shadow-inner outline-none focus:border-emerald-500/50 disabled:opacity-50 transition-colors"
                  />
                )}
                {isTimeType ? (
                  <button
                    type="button"
                    disabled={!isWorkoutActive}
                    onClick={() => {
                      const dur = Math.max(0, parseInt(actualReps) || ex.workSec || 60);
                      onRunInlineTimer(setId, dur, ex.pause || 0, prefillData);
                    }}
                    className={`w-28 py-3.5 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm active:scale-[0.98] ${
                      isChecked
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                        : isTimerRunning
                        ? 'bg-emerald-600 text-zinc-950 border-emerald-400 animate-pulse'
                        : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                    }`}
                  >
                    {isTimerRunning ? `${timerRemaining}s` : isChecked ? <i className="fa-solid fa-check text-lg" /> : `${actualReps}s`}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!isWorkoutActive}
                    onPointerDown={() => handlePointerDown(setIdx, prefillData)}
                    onPointerUp={() => handlePointerUp(setIdx, ex.pause || 0, prefillData, actualReps)}
                    onPointerLeave={handlePointerCancel}
                    className={`w-28 py-3.5 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
                      isChecked
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                        : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                    }`}
                  >
                    {isChecked ? (
                      (isCardio || actualReps === defaultTargetReps) ? (
                        <i className="fa-solid fa-check text-lg" />
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

              {isCardio && ex.cardioFields && ex.cardioFields.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-14 mt-1">
                  {ex.cardioFields.map(cf => (
                    <div key={cf.id} className="flex-1 min-w-[90px] bg-zinc-950/80 rounded-xl border border-zinc-800/60 p-2 flex items-center shadow-inner">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold w-1/2 truncate pr-1">{cf.label}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={!isWorkoutActive}
                        value={state.setCustomFields?.[setId]?.[cf.id] || ''}
                        onChange={(e) => onSaveCustomField(setId, cf.id, e.target.value)}
                        placeholder={hist?.customFields?.[cf.id] ? String(hist.customFields[cf.id]) : cf.unit}
                        className="bg-transparent text-white text-xs font-bold w-1/2 outline-none text-right disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Coach Advice - Vista Ultra-Minimalista (Solo durante il Workout) */}
      {isWorkoutActive && coachAdvice && (coachAdvice.compactText || coachAdvice.message) && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/40 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-[11px] font-bold shadow-sm max-w-full truncate">
            {coachAdvice.badge === 'increase' ? (
              <i className="fa-solid fa-arrow-trend-up text-emerald-400 text-xs shrink-0" />
            ) : coachAdvice.badge === 'stall' ? (
              <i className="fa-solid fa-triangle-exclamation text-amber-400 text-xs shrink-0" />
            ) : coachAdvice.badge === 'deload' ? (
              <i className="fa-solid fa-battery-half text-sky-400 text-xs shrink-0" />
            ) : coachAdvice.badge === 'decrease' ? (
              <i className="fa-solid fa-arrow-trend-down text-rose-400 text-xs shrink-0" />
            ) : (
              <i className="fa-solid fa-bullseye text-emerald-400 text-xs shrink-0" />
            )}
            <span
              className={`truncate ${
                coachAdvice.badge === 'increase'
                  ? 'text-emerald-400 font-black'
                  : coachAdvice.badge === 'stall'
                  ? 'text-amber-400 font-black'
                  : coachAdvice.badge === 'decrease'
                  ? 'text-rose-400 font-black'
                  : coachAdvice.badge === 'deload'
                  ? 'text-sky-400 font-black'
                  : 'text-zinc-300 font-black'
              }`}
            >
              {coachAdvice.compactText || coachAdvice.title}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

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
  onToggleSet: (setIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, any> }) => void;
  onLongPressSet: (setIndex: number, pauseSec: number, prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, any> }) => void;
  onOpenEffortModal: (setId: string, isRpe: boolean) => void;
  onOpenVideo: (url: string) => void;
  onRunInlineTimer: (setId: string, durationSec: number, pauseSec: number, prefill: { reps?: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, any> }) => void;
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
      <div className="bg-zinc-900/60 rounded-3xl p-5 pt-7 mb-5 shadow-sm border border-zinc-800/40 backdrop-blur-sm relative animate-in fade-in">
        <div className="absolute -top-4 right-2 flex items-center gap-2 z-10">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveEx(-1)}
            aria-label={`Sposta ${ex.name || 'esercizio'} su`}
            className="w-11 h-11 min-w-11 min-h-11 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-md border-2 border-zinc-950 hover:bg-emerald-400 disabled:opacity-40 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-up text-xs" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveEx(1)}
            aria-label={`Sposta ${ex.name || 'esercizio'} giù`}
            className="w-11 h-11 min-w-11 min-h-11 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-md border-2 border-zinc-950 hover:bg-emerald-400 disabled:opacity-40 outline-none transition-colors"
          >
            <i className="fa-solid fa-chevron-down text-xs" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 mb-3">
          <div className="flex items-center gap-2">
            <select
              value={ex.metricType}
              onChange={(e) => onUpdateEx('metricType', e.target.value)}
              aria-label="Tipo metrica esercizio"
              className="flex-1 min-h-11 bg-zinc-950 text-zinc-200 text-base font-bold px-3 py-2.5 rounded-2xl outline-none border border-zinc-800/80 shadow-inner"
            >
              <option value="weight">Pesi</option>
              <option value="bodyweight">C. Libero</option>
              <option value="time">Tempo</option>
              <option value="cardio">Cardio</option>
            </select>
            <button
              type="button"
              onClick={onDeleteEx}
              aria-label={`Elimina esercizio ${ex.name || ''}`}
              className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center text-rose-400 bg-rose-950/30 border border-rose-900/30 rounded-2xl outline-none shrink-0 hover:bg-rose-900/50 active:scale-95 transition-all"
            >
              <i className="fa-solid fa-trash text-sm" aria-hidden="true" />
            </button>
          </div>
          <input
            type="text"
            value={ex.name}
            onChange={(e) => onUpdateEx('name', e.target.value)}
            placeholder="Nome Esercizio"
            aria-label="Nome esercizio"
            className="bg-zinc-950 text-white font-bold px-3.5 py-2.5 min-h-11 rounded-2xl w-full outline-none border border-zinc-800/80 text-base shadow-inner focus:border-emerald-500 transition-colors"
          />
        </div>

        {ex.metricType !== 'cardio' && (
          <input
            type="text"
            value={ex.link || ''}
            onChange={(e) => onUpdateEx('link', e.target.value)}
            placeholder="Link video esecuzione (YouTube / Google Drive)"
            aria-label="Link video esecuzione"
            className="w-full min-h-11 bg-zinc-950 text-zinc-200 placeholder:text-zinc-400 text-base font-medium px-3.5 py-2.5 rounded-2xl mb-4 border border-zinc-800/80 outline-none shadow-inner focus:border-emerald-500 transition-colors"
          />
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 shadow-inner text-center">
            <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">Serie</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={20}
              value={ex.sets}
              onChange={(e) => onUpdateEx('sets', Math.max(1, parseInt(e.target.value) || 1))}
              aria-label="Numero di serie"
              className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
            />
          </div>
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 shadow-inner text-center">
            <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">
              {ex.metricType === 'time' ? 'Sec' : 'Reps'}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={ex.metricType === 'time' ? (ex.workSec || 60) : ex.reps}
              onChange={(e) => onUpdateEx(ex.metricType === 'time' ? 'workSec' : 'reps', e.target.value)}
              aria-label={ex.metricType === 'time' ? 'Secondi target' : 'Ripetizioni target'}
              className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
            />
          </div>
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2 shadow-inner text-center">
            <span className="text-[11px] text-zinc-400 font-extrabold uppercase tracking-wider block">Pausa</span>
            <input
              type="number"
              inputMode="decimal"
              step={5}
              min={0}
              value={ex.pause || 0}
              onChange={(e) => onUpdateEx('pause', Math.max(0, parseInt(e.target.value) || 0))}
              aria-label="Secondi di pausa"
              className="bg-transparent text-white font-bold w-full text-center outline-none text-base min-h-11"
            />
          </div>
        </div>

        {/* 🔴 NUOVO: Selezionatore Macchina Cardio */}
        {ex.metricType === 'cardio' && (
          <div className="mt-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 shadow-inner">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
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
              aria-label="Seleziona tipo di macchina cardio"
              className="bg-zinc-900 text-emerald-400 text-base font-bold px-3 py-2.5 min-h-11 rounded-xl outline-none border border-zinc-700/50 w-full"
            >
              <option value="">Seleziona macchina...</option>
              <option value="corsa">Corsa / Tapis Roulant</option>
              <option value="vogatore">Vogatore</option>
              <option value="bike">Bike / Assault</option>
            </select>
          </div>
        )}

        {/* SETUP COACH 2.0 (Collassabile) */}
        {regData && (
          <details className="group mt-4 pt-3 border-t border-zinc-800/80">
            <summary className="list-none flex items-center justify-between cursor-pointer min-h-11 py-2 px-1 rounded-xl text-zinc-300 hover:text-emerald-400 select-none transition-colors">
              <span className="flex items-center gap-2 text-zinc-200 group-open:text-emerald-400 font-extrabold text-[11px] uppercase tracking-wider">
                <i className="fa-solid fa-sliders text-emerald-400" aria-hidden="true" /> Impostazioni Avanzate Esercizio
              </span>
              <i className="fa-solid fa-chevron-down text-xs text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>

            <div className="pt-2.5">
              <div className="text-[11px] font-black text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-robot" aria-hidden="true" /> Setup Coach 2.0
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={regData.equipment || ''}
                  onChange={(e) => onUpdateRegistry?.(ex.exerciseId!, 'equipment', e.target.value)}
                  aria-label="Attrezzatura esercizio"
                  className="bg-zinc-950 text-zinc-200 text-base font-bold px-3 py-2.5 min-h-11 rounded-xl border border-zinc-700/50 outline-none"
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
                  aria-label="Pattern di movimento"
                  className="bg-zinc-950 text-zinc-200 text-base font-bold px-3 py-2.5 min-h-11 rounded-xl border border-zinc-700/50 outline-none"
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
                  aria-label="Modello di progressione"
                  className="bg-zinc-950 text-zinc-200 text-base font-bold px-3 py-2.5 min-h-11 rounded-xl border border-zinc-700/50 outline-none"
                >
                  <option value="">Progressione...</option>
                  <option value="double_progression">Doppia Progressione</option>
                  <option value="time_under_tension">Time Under Tension</option>
                  <option value="fixed_volume">Volume Fisso</option>
                </select>

                <div className="flex items-center bg-zinc-950 border border-zinc-700/50 rounded-xl px-3 min-h-11">
                  <span className="text-[11px] text-zinc-400 font-bold uppercase w-14 shrink-0">Incr.</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="kg/s"
                    value={regData.progressionIncrement || ''}
                    onChange={(e) => onUpdateRegistry?.(ex.exerciseId!, 'progressionIncrement', parseFloat(e.target.value) || 0)}
                    aria-label="Incremento progressione"
                    className="bg-transparent text-white font-bold w-full text-right outline-none text-base min-h-11"
                  />
                </div>
              </div>
            </div>
          </details>
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
          <span className="text-emerald-400 mr-2">{index + 1}.</span>
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
            aria-label={`Apri video esecuzione ${ex.name}`}
            className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-zinc-900 text-emerald-400 hover:bg-zinc-800 transition-colors border border-zinc-700/60 shadow-sm shrink-0"
          >
            <i className="fa-solid fa-video text-sm" aria-hidden="true" />
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
      )}

      {!isWorkoutActive && coachAdvice?.fatigueAlert && (
        <div className="bg-indigo-950/40 border border-indigo-700/60 text-indigo-200 text-xs p-3.5 rounded-2xl mb-4 flex items-start gap-3 shadow-inner">
          <i className="fa-solid fa-chart-line text-indigo-400 mt-0.5 text-sm shrink-0 opacity-90" aria-hidden="true" />
          <div className="leading-relaxed">
            <span className="font-extrabold uppercase text-[11px] tracking-wider text-indigo-300 block mb-0.5">
              Tendenza Fatica Cronica (4-6 sett.)
            </span>
            {coachAdvice.fatigueAlert}
          </div>
        </div>
      )}

      {/* Sets Rows */}
      <div className="space-y-3">
        {Array.from({ length: ex.sets }).map((_, setIdx) => {
          const setId = `${ex.id}-${setIdx}`;
          const isChecked = Boolean(state.checkedSets[setId]);
          const isTimeType = ex.metricType === 'time';
          const hist = getHistoricalSetData(setIdx);
          
          // FIX: Se l'esercizio è a tempo, peschiamo workSec (di default 60), altrimenti reps (di default 10)
          const defaultTargetReps = hist?.reps !== undefined 
            ? hist.reps 
            : (isTimeType ? String(ex.workSec || 60) : (ex.reps || '10'));
            
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
          const timerRemaining = activeInlineTimerSec[setId];
          const isTimerRunning = activeInlineTimerSec?.[setId] !== undefined || Boolean(state.activeInlineTimers?.[setId]);

          const prefillData = {
            reps: actualReps,
            weight: displayWeight,
            rir: !isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
            rpe: isCardio && displayEffort !== undefined && displayEffort !== '' ? String(displayEffort) : undefined,
            customFields: hist?.customFields || {}
          };

          const setActionButton = isTimeType ? (
            <button
              type="button"
              disabled={!isWorkoutActive}
              onPointerDown={() => {
                isLongPressRef.current = false;
                handlePointerDown(setIdx, prefillData);
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
                  onToggleSet(setIdx, ex.pause || 0, prefillData);
                } else {
                  const dur = Math.max(1, parseInt(String(actualReps)) || ex.workSec || 60);
                  onRunInlineTimer(setId, dur, ex.pause || 0, prefillData);
                }
              }}
              aria-label={isChecked ? `Serie ${setIdx + 1} completata (${actualReps} secondi)` : `Avvia timer serie ${setIdx + 1} (${actualReps} secondi)`}
              aria-pressed={isChecked}
              className={`flex-1 min-h-11 py-3 px-3 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
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
              onPointerDown={() => handlePointerDown(setIdx, prefillData)}
              onPointerUp={() => handlePointerUp(setIdx, ex.pause || 0, prefillData, actualReps)}
              onPointerLeave={handlePointerCancel}
              aria-label={isChecked ? `Serie ${setIdx + 1} completata` : isCardio ? `Segna serie ${setIdx + 1} completata` : `Completa serie ${setIdx + 1} da ${actualReps} ripetizioni`}
              aria-pressed={isChecked}
              className={`flex-1 min-h-11 py-3 px-3 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm select-none active:scale-[0.98] ${
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
          );

          const effortButton = (
            <button
              type="button"
              disabled={!isWorkoutActive}
              onClick={() => onOpenEffortModal(setId, isCardio)}
              aria-label={`${isCardio ? 'Imposta RPE' : 'Imposta RIR'} serie ${setIdx + 1}`}
              className={`border text-xs font-extrabold min-w-[96px] min-h-11 px-3 py-3 rounded-2xl outline-none uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] shrink-0 ${
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
          );

          return (
            <div key={setIdx} className="flex flex-col gap-2">
              {!isCardio ? (
                <div className="bg-zinc-950/35 border border-zinc-800/60 rounded-2xl p-2 space-y-2">
                  {/* Riga 1: Serie + Carico (input 16px ampio e anti-zoom iOS) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-zinc-300 w-14 min-h-11 flex items-center justify-center uppercase tracking-wider bg-zinc-950/80 border border-zinc-800/80 rounded-2xl shadow-sm shrink-0">
                      S{setIdx + 1}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!isWorkoutActive}
                      value={displayWeight}
                      onChange={(e) => onSaveSetWeight(setId, e.target.value)}
                      placeholder={ex.metricType === 'bodyweight' ? 'Zavorra (+kg)' : 'Carico (kg)'}
                      aria-label={`Carico serie ${setIdx + 1} in kg`}
                      className="flex-1 min-w-0 min-h-11 bg-zinc-950/80 text-white px-3 py-2.5 rounded-2xl border border-zinc-800/80 text-center font-bold text-base placeholder:text-zinc-400 shadow-inner outline-none focus:border-emerald-500/50 disabled:opacity-50 transition-colors"
                    />
                  </div>
                  {/* Riga 2: Completamento/Timer + RIR */}
                  <div className="flex items-center gap-2">
                    {setActionButton}
                    {effortButton}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-zinc-300 w-12 min-h-11 flex items-center justify-center uppercase tracking-wider bg-zinc-950/80 border border-zinc-800/80 rounded-2xl shadow-sm shrink-0">
                    S{setIdx + 1}
                  </span>
                  {setActionButton}
                  {effortButton}
                </div>
              )}

              {isCardio && ex.cardioFields && ex.cardioFields.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  {ex.cardioFields.map(cf => (
                    <div key={cf.id} className="bg-zinc-950/80 rounded-xl border border-zinc-800/60 p-2.5 shadow-inner">
                      <span className="text-[11px] text-zinc-400 uppercase font-bold block mb-1 truncate">{cf.label}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={!isWorkoutActive}
                        value={state.setCustomFields?.[setId]?.[cf.id] || ''}
                        onChange={(e) => onSaveCustomField(setId, cf.id, e.target.value)}
                        placeholder={hist?.customFields?.[cf.id] ? String(hist.customFields[cf.id]) : cf.unit}
                        aria-label={`${cf.label} serie ${setIdx + 1}`}
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

      {/* Coach Advice - Vista Ultra-Minimalista (Solo durante il Workout) */}
      {isWorkoutActive && coachAdvice && (coachAdvice.compactText || coachAdvice.message) && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/40 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-[11px] font-bold shadow-sm max-w-full truncate">
            {coachAdvice.badge === 'increase' ? (
              <i className="fa-solid fa-arrow-trend-up text-emerald-400 text-xs shrink-0" aria-hidden="true" />
            ) : coachAdvice.badge === 'stall' ? (
              <i className="fa-solid fa-triangle-exclamation text-amber-400 text-xs shrink-0" aria-hidden="true" />
            ) : coachAdvice.badge === 'deload' ? (
              <i className="fa-solid fa-battery-half text-amber-400 text-xs shrink-0" aria-hidden="true" />
            ) : coachAdvice.badge === 'decrease' ? (
              <i className="fa-solid fa-arrow-trend-down text-rose-400 text-xs shrink-0" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-bullseye text-emerald-400 text-xs shrink-0" aria-hidden="true" />
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
                  ? 'text-amber-400 font-black'
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

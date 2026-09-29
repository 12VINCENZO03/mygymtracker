import React, { useRef } from 'react';
import { AppState, SingleExercise } from '../types/gym';
import { getExerciseCoachAdvice } from '../utils/coach';

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
  onToggleSet: (setIndex: number, defaultReps: string, pauseSec: number) => void;
  onLongPressSet: (setIndex: number, defaultReps: string) => void;
  onOpenEffortModal: (setId: string, isRpe: boolean) => void;
  onOpenVideo: (url: string) => void;
  onRunInlineTimer: (setId: string, durationSec: number, pauseSec: number) => void;
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
  onToggleSet,
  onLongPressSet,
  onOpenEffortModal,
  onOpenVideo,
  onRunInlineTimer,
  activeInlineTimerSec
}) => {
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const getHistoricalSetData = (setIdx: number) => {
    const history = state.weightHistory && state.weightHistory[ex.id];
    if (!history || history.length === 0) return null;
    const entry = history[0];
    const sId = setIdx.toString();
    return {
      reps: entry.reps ? entry.reps[sId] : undefined,
      rir: entry.rirs ? entry.rirs[sId] : undefined,
      rpe: entry.rpes ? entry.rpes[sId] : undefined
    };
  };

  const currentWeight = state.weights[ex.id] || (state.weightHistory[ex.id]?.[0]?.weight ?? '');
  const coachAdvice = getExerciseCoachAdvice(state, ex.id, ex.reps, ex.metricType);

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
      </div>
    );
  }

  const handlePointerDown = (setIndex: number, defaultReps: string) => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPressSet(setIndex, defaultReps);
    }, 450);
  };

  const handlePointerUp = (setIndex: number, defaultReps: string, pauseSec: number) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      onToggleSet(setIndex, defaultReps, pauseSec);
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
      id={`ex-container-${ex.id}`}
      className={`bg-zinc-900/60 rounded-3xl p-5 sm:p-6 mb-5 relative shadow-sm border border-zinc-800/40 backdrop-blur-md transition-all ${
        !isWorkoutActive ? 'opacity-75 grayscale-[20%]' : ''
      }`}
    >
      {/* Title & Video */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-black text-white leading-tight flex items-baseline gap-1.5">
          <span className="text-emerald-500 font-black opacity-90">{index}.</span>
          {ex.name}
        </h3>
        {Boolean(ex.link && ex.link.trim()) && (
          <button
            type="button"
            onClick={() => onOpenVideo(ex.link!)}
            className="text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 p-2.5 rounded-2xl border border-emerald-900/40 transition-all active:scale-[0.96] shadow-sm"
            title="Guarda video esecuzione"
          >
            <i className="fa-solid fa-video text-xs" />
          </button>
        )}
      </div>

      {/* Smart Coach Advice */}
      {coachAdvice && coachAdvice.message && (
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

      {coachAdvice?.fatigueAlert && (
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

      {/* Weight Input */}
      {ex.metricType !== 'cardio' && (
        <div className="flex items-center bg-zinc-950/80 rounded-2xl p-2 mb-4 border border-zinc-800/60 shadow-inner transition-colors focus-within:border-emerald-500/50">
          <div className="px-3 text-zinc-500 text-sm">
            <i className="fa-solid fa-weight-hanging" />
          </div>
          <input
            type="text"
            inputMode="decimal"
            disabled={!isWorkoutActive}
            value={currentWeight}
            onChange={(e) => onSaveWeight(e.target.value)}
            placeholder={
              ex.metricType === 'bodyweight'
                ? 'Zavorra aggiuntiva (kg)'
                : ex.metricType === 'time'
                ? 'Zavorra opzionale (kg)'
                : 'Registra carico (kg)'
            }
            className="bg-transparent text-white w-full py-2 outline-none font-bold text-sm disabled:opacity-50"
          />
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
          const currentRir = state.setRir[setId];
          const histRir = hist?.rir;
          const displayRir = currentRir !== undefined && currentRir !== '' ? currentRir : histRir;

          const isTimeType = ex.metricType === 'time';
          const timerRemaining = activeInlineTimerSec[setId];
          const isTimerRunning = timerRemaining !== undefined && timerRemaining > 0;

          return (
            <div key={setIdx} className="flex items-center gap-2.5">
              <span className="text-[10px] font-black text-zinc-500 w-12 uppercase tracking-wider bg-zinc-950/80 border border-zinc-800/80 px-2 py-3.5 rounded-2xl text-center shadow-sm">
                S{setIdx + 1}
              </span>
              
              {/* Action Button */}
              {isTimeType ? (
                <button
                  type="button"
                  disabled={!isWorkoutActive}
                  onClick={() => {
                    const dur = Math.max(0, parseInt(actualReps) || ex.workSec || 60);
                    onRunInlineTimer(setId, dur, ex.pause || 0);
                  }}
                  className={`w-28 py-3.5 rounded-2xl border text-sm font-black transition-all flex items-center justify-center outline-none shadow-sm active:scale-[0.98] ${
                    isChecked
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
                      : isTimerRunning
                      ? 'bg-emerald-600 text-zinc-950 border-emerald-400 animate-pulse'
                      : 'bg-zinc-800/80 text-zinc-200 border-zinc-700/60 hover:bg-zinc-700'
                  }`}
                >
                  {isTimerRunning ? (
                    `${timerRemaining}s`
                  ) : isChecked ? (
                    <i className="fa-solid fa-check text-lg" />
                  ) : (
                    `${actualReps}s`
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isWorkoutActive}
                  onPointerDown={() => handlePointerDown(setIdx, defaultTargetReps)}
                  onPointerUp={() => handlePointerUp(setIdx, defaultTargetReps, ex.pause || 0)}
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
              )}

              {/* RIR / RPE selector */}
              <button
                type="button"
                disabled={!isWorkoutActive}
                onClick={() => onOpenEffortModal(setId, ex.metricType === 'cardio')}
                className={`border text-[10px] font-extrabold flex-1 py-3.5 rounded-2xl outline-none uppercase tracking-wider shadow-sm transition-all active:scale-[0.98] ${
                  currentRir !== undefined && currentRir !== ''
                    ? 'text-zinc-100 border-zinc-500 bg-zinc-700'
                    : displayRir !== undefined && displayRir !== ''
                    ? 'text-emerald-400 border-dashed border-emerald-700/60 bg-emerald-950/20'
                    : 'text-zinc-400 border-zinc-700/60 bg-zinc-900/50 hover:bg-zinc-800/80'
                }`}
              >
                {displayRir !== undefined && displayRir !== ''
                  ? displayRir === '-1'
                    ? 'CED'
                    : `RIR ${displayRir}`
                  : 'RIR'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

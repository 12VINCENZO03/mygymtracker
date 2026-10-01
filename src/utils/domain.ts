// src/utils/domain.ts
import { WorkoutSessionV2, WorkoutSetV2, ExerciseDefV2, ExerciseTypeV2 } from '../types/v2';
import { generateId } from './storage';

/**
 * Risultato della ricerca dell'ultima prestazione di un esercizio nello storico immutabile V2.
 */
export interface HistoricalPerformance {
  date: string;
  weight?: number;
  reps?: number;
  durationSec?: number;
  rir?: number;
  rpe?: number;
  isCed?: boolean;
  sets: WorkoutSetV2[];
  customFields?: Record<string, string | number>;
}

/**
 * Trova l'ultima prestazione registrata di un esercizio nello storico canonico V2.
 */
export function getLastExercisePerformance(
  sessions: WorkoutSessionV2[] | undefined,
  exerciseId?: string,
  exerciseName?: string
): HistoricalPerformance | null {
  if (!sessions || sessions.length === 0) return null;

  const targetName = exerciseName ? exerciseName.trim().toLowerCase() : '';

  for (const session of sessions) {
    for (const block of session.blocks) {
      if ('rounds' in block) {
        for (const round of block.rounds) {
          for (const sub of round.exercises) {
            const matchId = exerciseId && sub.exerciseId === exerciseId;
            const matchName = targetName && sub.nameSnapshot.trim().toLowerCase() === targetName;
            if (matchId || (!exerciseId && matchName)) {
              const firstSet = sub.sets[0];
              return {
                date: session.date,
                weight: firstSet?.weight,
                reps: firstSet?.reps,
                durationSec: firstSet?.durationSec,
                rir: firstSet?.rir,
                rpe: firstSet?.rpe,
                isCed: firstSet?.isCed,
                sets: sub.sets,
                customFields: firstSet?.customFields
              };
            }
          }
        }
      } else {
        const matchId = exerciseId && block.exerciseId === exerciseId;
        const matchName = targetName && block.nameSnapshot.trim().toLowerCase() === targetName;
        if (matchId || (!exerciseId && matchName)) {
          const firstSet = block.sets[0];
          return {
            date: session.date,
            weight: firstSet?.weight,
            reps: firstSet?.reps,
            durationSec: firstSet?.durationSec,
            rir: firstSet?.rir,
            rpe: firstSet?.rpe,
            isCed: firstSet?.isCed,
            sets: block.sets,
            customFields: firstSet?.customFields
          };
        }
      }
    }
  }
  return null;
}

/**
 * Restituisce i dati storici per un set specifico (1-based index) dell'ultima sessione.
 */
export function getHistoricalSetDataV2(
  sessions: WorkoutSessionV2[] | undefined,
  setIndexOneBased: number,
  exerciseId?: string,
  exerciseName?: string
): { reps?: number | string; weight?: number | string; rir?: number | string; rpe?: number | string } | null {
  const perf = getLastExercisePerformance(sessions, exerciseId, exerciseName);
  if (!perf || !perf.sets || perf.sets.length === 0) return null;

  const set = perf.sets.find((s) => s.index === setIndexOneBased) || perf.sets[setIndexOneBased - 1];
  if (!set) return null;

  return {
    reps: set.reps,
    weight: set.weight,
    rir: set.isCed ? 'CED' : set.rir !== undefined ? set.rir : undefined,
    rpe: set.rpe
  };
}

/**
 * Restituisce l'insieme unico di tutte le date in cui è avvenuto almeno un allenamento.
 */
export function getWorkoutDatesSet(sessions: WorkoutSessionV2[] | undefined): Set<string> {
  const set = new Set<string>();
  if (!sessions) return set;
  for (const s of sessions) {
    if (s.date) set.add(s.date);
  }
  return set;
}

/**
 * Calcola lo streak attuale (giorni consecutivi) direttamente dalle sessioni V2.
 */
export function computeStreakFromSessions(
  sessions: WorkoutSessionV2[] | undefined,
  favoriteTabIds?: string[]
): number {
  if (!sessions || sessions.length === 0) return 0;

  const filtered = favoriteTabIds && favoriteTabIds.length > 0
    ? sessions.filter(s => !s.planId || favoriteTabIds.includes(s.planId))
    : sessions;

  if (filtered.length === 0) return 0;

  const dateSet = getWorkoutDatesSet(filtered);
  const now = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];
  const today = format(now);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = format(yesterdayDate);

  let checkDate = new Date(now);

  if (!dateSet.has(today)) {
    if (!dateSet.has(yesterday)) {
      return 0;
    }
    checkDate = yesterdayDate;
  }

  let streak = 0;
  while (true) {
    const ds = format(checkDate);
    if (dateSet.has(ds)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Restituisce le statistiche di completamento per una singola scheda V2.
 */
export function getTabCompletionStats(
  sessions: WorkoutSessionV2[] | undefined,
  tabId: string
): { count: number; lastCompletedAt: number | null; lastDateStr: string | null } {
  if (!sessions || sessions.length === 0) {
    return { count: 0, lastCompletedAt: null, lastDateStr: null };
  }

  let count = 0;
  let lastCompletedAt: number | null = null;
  let lastDateStr: string | null = null;

  for (const s of sessions) {
    if (s.planId === tabId) {
      count++;
      if (lastCompletedAt === null || s.completedAt > lastCompletedAt) {
        lastCompletedAt = s.completedAt;
        lastDateStr = s.date;
      }
    }
  }
  return { count, lastCompletedAt, lastDateStr };
}

export function calculateTodayLoad(sessions: WorkoutSessionV2[], todayStr: string): number {
  let load = 0;
  if (!sessions) return load;
  const todaySessions = sessions.filter(s => s.date === todayStr);
  todaySessions.forEach(session => {
    session.blocks.forEach(block => {
      const processSets = (sets: WorkoutSetV2[]) => {
        sets.forEach(set => {
          const duration = set.durationSec || (set.reps ? Number(set.reps) * 3 : 60);
          const effort = set.rpe !== undefined ? set.rpe : (set.rir !== undefined ? (10 - set.rir) : 8);
          load += (duration / 60) * effort;
        });
      };
      if ('rounds' in block) {
        block.rounds.forEach(r => r.exercises.forEach(sub => processSets(sub.sets)));
      } else {
        processSets(block.sets);
      }
    });
  });
  return Math.round(load);
}

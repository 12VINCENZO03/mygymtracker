import { WorkoutSessionV2, WorkoutSetV2, ExerciseDefV2, ExerciseTypeV2 } from '../types/v2';
import { generateId, getTodayStr } from './storage';

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
): { reps?: number | string; weight?: number | string; rir?: number | string; rpe?: number | string; customFields?: Record<string, string | number> } | null {
  const perf = getLastExercisePerformance(sessions, exerciseId, exerciseName);
  if (!perf || !perf.sets || perf.sets.length === 0) return null;

  const set = perf.sets.find((s) => s.index === setIndexOneBased) || perf.sets[setIndexOneBased - 1];
  if (!set) return null;

  return {
    reps: set.reps,
    weight: set.weight,
    rir: set.isCed ? 'CED' : set.rir !== undefined ? set.rir : undefined,
    rpe: set.rpe,
    customFields: set.customFields
  };
}

/**
 * Restituisce l'insieme unico di tutte le date in cui è avvenuto almeno un allenamento.
 */
export function getWorkoutDatesSet(sessions: WorkoutSessionV2[] | undefined): Set<string> {
  if (!sessions) return new Set();
  return new Set(sessions.map((s) => s.date).filter(Boolean));
}

/**
 * Calcola lo streak attuale (giorni/sessioni consecutive) direttamente dalle sessioni V2,
 * rispettando i riposi fisiologici (fino a 48-72h tra allenamenti).
 */
export function computeStreakFromSessions(
  sessionsV2: WorkoutSessionV2[] | undefined,
  favoriteTabIds?: string[]
): number {
  if (!sessionsV2 || sessionsV2.length === 0) return 0;

  const filtered = favoriteTabIds && favoriteTabIds.length > 0
    ? sessionsV2.filter(s => !s.planId || favoriteTabIds.includes(s.planId))
    : sessionsV2;

  if (filtered.length === 0) return 0;

  // Ordina in modo decrescente (la più recente in cima)
  const uniqueDates = Array.from(getWorkoutDatesSet(filtered)).sort((a, b) => b.localeCompare(a));
  if (uniqueDates.length === 0) return 0;

  // Usa l'import diretto getTodayStr per l'orario locale reale
  const todayStr = getTodayStr();
  
  // Helper per il calcolo sicuro dei giorni di distanza in locale, senza fusi orari sballati
  const parseDate = (dStr: string) => {
    const parts = dStr.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  };

  const msPerDay = 1000 * 60 * 60 * 24;
  const lastWorkoutDate = parseDate(uniqueDates[0]);
  const todayDate = parseDate(todayStr);
  
  // Quanti giorni interi sono passati dall'ultimo allenamento?
  const daysSinceLast = Math.round((todayDate.getTime() - lastWorkoutDate.getTime()) / msPerDay);

  // FINESTRA DI TOLLERANZA PT: Se l'ultimo allenamento risale a PIÙ di 3 giorni fa (> 72h), la streak è persa.
  if (daysSinceLast > 3) {
    return 0;
  }

  // Se siamo qui, il primo workout è valido. Inizia il conteggio a 1.
  let streak = 1;

  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const cur = parseDate(uniqueDates[i]);
    const prev = parseDate(uniqueDates[i + 1]);
    
    // Distanza in giorni tra un allenamento e quello precedente
    const gap = Math.round((cur.getTime() - prev.getTime()) / msPerDay);

    // Se l'intervallo è tra 1 e 3 giorni (recupero fisiologico valido), la streak aumenta
    if (gap >= 1 && gap <= 3) {
      streak++;
    } else {
      // Buco superiore ai 3 giorni, la serie si è interrotta nel passato.
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

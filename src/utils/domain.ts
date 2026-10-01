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
 * Ordine di ricerca:
 * 1. Priorità assoluta ad exerciseId permanente
 * 2. Fallback sul nome normalizzato se l'ID non è ancora presente
 * Cerca partendo dalla sessione più recente (indice 0) e termina al primo riscontro -> O(1) in media.
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
        // Blocco Circuito / Superset
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
        // Esercizio Singolo
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

  // Trova il set con index corrispondente
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
 * O(N) una tantum, O(1) lookup.
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

  // Filtriamo per schede preferite se specificato
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
  // Se oggi non c'è allenamento, controlliamo se c'era ieri per mantenere lo streak attivo
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

/**
 * Assicura che un esercizio esista nel registro permanente V2.
 * Se esiste già un esercizio con lo stesso nome, restituisce l'ID esistente (deduplicazione).
 * Altrimenti, registra una nuova voce con ID permanente generato.
 */
export function getOrRegisterExercise(
  registry: Record<string, ExerciseDefV2>,
  name: string,
  type: ExerciseTypeV2 = 'weight',
  cardioMachine?: string
): { updatedRegistry: Record<string, ExerciseDefV2>; exerciseId: string } {
  const cleanName = name.trim();
  const existingKey = Object.keys(registry).find(
    (k) => registry[k].name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  if (existingKey) {
    return { updatedRegistry: registry, exerciseId: existingKey };
  }

  const newId = generateId();
  const updated = {
    ...registry,
    [newId]: {
      id: newId,
      name: cleanName,
      type,
      cardioMachine,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  };

  return { updatedRegistry: updated, exerciseId: newId };
}

export function calculateTodayLoad(sessions: WorkoutSessionV2[], todayStr: string): number {
  if (!sessions) return 0;
  let load = 0;
  sessions.filter(s => s.date === todayStr).forEach(session => {
    session.blocks.forEach(block => {
      if ('rounds' in block) {
        block.rounds.forEach(r => r.exercises.forEach(sub => {
          if (sub.type === 'time' || sub.type === 'cardio') sub.sets.forEach(set => load += (set.durationSec || 60) * (set.rpe || (10 - (set.rir || 2))));
        }));
      } else {
        if (block.type === 'time' || block.type === 'cardio') block.sets.forEach(set => load += (set.durationSec || 60) * (set.rpe || (10 - (set.rir || 2))));
      }
    });
  });
  return Math.round(load);
}

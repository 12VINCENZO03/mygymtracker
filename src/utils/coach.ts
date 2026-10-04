import { WorkoutSessionV2, CircuitSnapshotV2, ExerciseDefV2 } from '../types/v2';
import { AppState, MetricType, WeightHistoryEntry, SupersetExercise } from '../types/gym';
import { getTodayStr } from './storage';

export interface TrainingOutput {
  tonnage: number;     // solo pesi e corpo libero con sovraccarico (kg sollevati)
  totalReps: number;   // ripetizioni totali
  tutSeconds: number;  // time under tension (secondi)
  cardioScore: number; // distanza (km) o minuti cardio reali
  cardioKm: number;    // km effettivi
  cardioMinutes: number; // minuti effettivi
}

export function createEmptyTrainingOutput(): TrainingOutput {
  return {
    tonnage: 0,
    totalReps: 0,
    tutSeconds: 0,
    cardioScore: 0,
    cardioKm: 0,
    cardioMinutes: 0
  };
}

export function addTrainingOutputs(target: TrainingOutput, source: TrainingOutput): void {
  target.tonnage += source.tonnage;
  target.totalReps += source.totalReps;
  target.tutSeconds += source.tutSeconds;
  target.cardioScore += source.cardioScore;
  target.cardioKm += source.cardioKm;
  target.cardioMinutes += source.cardioMinutes;
}

export interface VolumeStats {
  today: TrainingOutput;
  week: TrainingOutput;
  lastWeek: TrainingOutput;
  month: TrainingOutput;
  lastMonth: TrainingOutput;
  year: TrainingOutput;
  lastYear: TrainingOutput;
  hasLastWeek: boolean;
  hasLastMonth: boolean;
  hasLastYear: boolean;
}

export function calculateVolumeFromSessionV2(session: WorkoutSessionV2): TrainingOutput {
  const output: TrainingOutput = createEmptyTrainingOutput();
  const bw = session?.bodyWeightAtSession || 0; // Il peso di quel giorno esatto!
  
  if (!session || !session.blocks || !Array.isArray(session.blocks)) return output;

  const processSet = (set: any, type: string) => {
    if (!set || typeof set !== 'object') return;
    const reps = typeof set.reps === 'number' ? set.reps : (parseInt(String(set.reps)) || 0);
    const w = typeof set.weight === 'number' ? set.weight : (parseFloat(String(set.weight)) || 0);
    const durationSec = typeof set.durationSec === 'number' ? set.durationSec : (parseFloat(String(set.durationSec)) || 0);
    const durationMin = durationSec / 60;

    if (type === 'weight' || !type) {
      output.tonnage += reps * w;
      output.totalReps += reps;
      if (durationSec > 0) output.tutSeconds += durationSec;
    } else if (type === 'bodyweight') {
      output.tonnage += reps * (bw + w);
      output.totalReps += reps;
      if (durationSec > 0) output.tutSeconds += durationSec;
    } else if (type === 'time') {
      if (durationSec > 0) output.tutSeconds += durationSec;
      if (reps > 0) output.totalReps += reps;
    } else if (type === 'cardio') {
      let distKm = 0;
      if (typeof set.distance === 'number' && set.distance > 0) {
        distKm = set.distance > 50 ? set.distance / 1000 : set.distance;
      }
      if (distKm === 0 && set.customFields && typeof set.customFields === 'object') {
        const rawDist = set.customFields['distanza'] ?? set.customFields['distance'] ?? set.customFields['km'];
        if (rawDist !== undefined && rawDist !== '') {
          const num = parseFloat(String(rawDist).replace(',', '.'));
          if (!isNaN(num) && num > 0) {
            distKm = num > 50 ? num / 1000 : num;
          }
        }
      }
      if (distKm === 0 && set.customFields && typeof set.customFields === 'object' && durationSec > 0) {
        const rawSpeed = set.customFields['velocita'] ?? set.customFields['speed'];
        if (rawSpeed !== undefined && rawSpeed !== '') {
          const speedKmh = parseFloat(String(rawSpeed).replace(',', '.'));
          if (!isNaN(speedKmh) && speedKmh > 0) {
            distKm = (speedKmh * durationSec) / 3600;
          }
        }
      }

      if (distKm > 0) {
        output.cardioKm += distKm;
        output.cardioScore += distKm;
      } else if (durationMin > 0) {
        output.cardioMinutes += durationMin;
        output.cardioScore += durationMin; // Minuti reali, nessun moltiplicatore fittizio
      }
      if (durationSec > 0) {
        output.tutSeconds += durationSec;
      }
    }
  };

  for (const block of session.blocks) {
    if (!block || typeof block !== 'object') continue;
    
    if ('rounds' in block && Array.isArray((block as any).rounds)) {
      for (const r of (block as any).rounds) {
        if (!r || !Array.isArray(r.exercises)) continue;
        for (const sub of r.exercises) {
          if (!sub || !Array.isArray(sub.sets)) continue;
          const subType = sub.type || 'weight';
          for (const set of sub.sets) {
            processSet(set, subType);
          }
        }
      }
    } else {
      const exBlock = block as any;
      if (!Array.isArray(exBlock.sets)) continue;
      const exType = exBlock.type || 'weight';
      for (const set of exBlock.sets) {
        processSet(set, exType);
      }
    }
  }

  output.tonnage = Math.round(output.tonnage);
  output.cardioKm = Math.round(output.cardioKm * 100) / 100;
  output.cardioMinutes = Math.round(output.cardioMinutes * 10) / 10;
  output.cardioScore = Math.round(output.cardioScore * 100) / 100;
  output.tutSeconds = Math.round(output.tutSeconds);

  return output;
}

export function calculateAllVolumeStatsV2(sessionsV2: WorkoutSessionV2[]): VolumeStats {
  const d = new Date();
  const todayStr = getTodayStr();
  const stats: VolumeStats = {
    today: createEmptyTrainingOutput(),
    week: createEmptyTrainingOutput(),
    lastWeek: createEmptyTrainingOutput(),
    month: createEmptyTrainingOutput(),
    lastMonth: createEmptyTrainingOutput(),
    year: createEmptyTrainingOutput(),
    lastYear: createEmptyTrainingOutput(),
    hasLastWeek: false,
    hasLastMonth: false,
    hasLastYear: false
  };

  if (!sessionsV2 || sessionsV2.length === 0) return stats;

  const currentWeekStart = new Date(d);
  currentWeekStart.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  currentWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(currentWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const currentMonth = d.getMonth();
  const currentYear = d.getFullYear();
  const lastMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastYear = currentYear - 1;

  for (const session of sessionsV2) {
    const out = calculateVolumeFromSessionV2(session);
    const isZero = out.tonnage === 0 && out.totalReps === 0 && out.tutSeconds === 0 && out.cardioScore === 0;
    if (isZero) continue;

    if (session.date === todayStr) {
      addTrainingOutputs(stats.today, out);
    }

    const parts = session.date.split('-');
    const logDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    
    if (logDate >= currentWeekStart) {
      addTrainingOutputs(stats.week, out);
    }
    if (logDate >= lastWeekStart && logDate <= lastWeekEnd) {
      addTrainingOutputs(stats.lastWeek, out);
      stats.hasLastWeek = true;
    }
    if (logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth) {
      addTrainingOutputs(stats.month, out);
    }
    if (logDate.getFullYear() === lastMonthYear && logDate.getMonth() === lastMonth) {
      addTrainingOutputs(stats.lastMonth, out);
      stats.hasLastMonth = true;
    }
    if (logDate.getFullYear() === currentYear) {
      addTrainingOutputs(stats.year, out);
    }
    if (logDate.getFullYear() === lastYear) {
      addTrainingOutputs(stats.lastYear, out);
      stats.hasLastYear = true;
    }
  }

  return stats;
}

function getAvgReps(histEntry: WeightHistoryEntry): number {
  const r = Object.values(histEntry.reps || {})
    .filter((v) => v !== '' && !isNaN(Number(v)))
    .map(Number);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
}

function getAvgRir(histEntry: WeightHistoryEntry): number | null {
  const v = Object.values(histEntry.rirs || {})
    .filter((r) => r !== '')
    .map((r) => (r === 'CED' || r === '-1') ? -1 : Number(r))
    .filter((num) => !isNaN(num));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function getAvgRpe(histEntry: WeightHistoryEntry): number | null {
  const v = Object.values(histEntry.rpes || {})
    .filter((r) => r !== '')
    .map(Number)
    .filter((num) => !isNaN(num));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function getAvgDuration(histEntry: WeightHistoryEntry): number {
  if (histEntry.durations) {
    const vals = Object.values(histEntry.durations)
      .filter((v) => v !== '' && !isNaN(Number(v)))
      .map(Number);
    if (vals.length > 0) return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  if (histEntry.reps) {
    const vals = Object.values(histEntry.reps)
      .filter((v) => v !== '' && !isNaN(Number(v)))
      .map(Number);
    if (vals.length > 0) return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return 0;
}

function getAvgCustomField(entry: WeightHistoryEntry, fieldKey: string): number | null {
  if (!entry.customFields) return null;
  const vals: number[] = [];
  const normalizedKey = fieldKey.trim().toLowerCase();
  Object.values(entry.customFields).forEach((fields) => {
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        if (k.trim().toLowerCase() === normalizedKey && v !== undefined && v !== '') {
          const parsed = parseFloat(String(v).replace(',', '.'));
          if (!isNaN(parsed)) vals.push(parsed);
        }
      }
    }
  });
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function getFatigueTrendAlert(effHistory: WeightHistoryEntry[]): string | null {
  try {
    if (!effHistory || effHistory.length < 4) return null;

    const recent = effHistory.slice(0, 2);
    const older = effHistory.slice(2, 4);
    if (recent.length < 2 || older.length < 2) return null;

    // Controllo data: le 4 sessioni devono ricadere in un arco temporale congruo (max 28 giorni),
    // altrimenti la variazione non è attribuibile a fatica acuta/sistemica cumulativa
    const newestDate = new Date(recent[0].date).getTime();
    const oldestDate = new Date(older[older.length - 1].date).getTime();
    if (!isNaN(newestDate) && !isNaN(oldestDate)) {
      const daysSpan = Math.abs(newestDate - oldestDate) / (1000 * 60 * 60 * 24);
      if (daysSpan > 28) return null;
    }

    const avgWRecent = recent.reduce((a, h) => a + (parseFloat(h.weight) || 0), 0) / recent.length;
    const avgWOlder = older.reduce((a, h) => a + (parseFloat(h.weight) || 0), 0) / older.length;

    // Se sta sovraccaricando, il drop dell'RIR è fisiologico, non è fatica sistemica
    if (avgWRecent > avgWOlder) return null;

    const rirOf = (h: WeightHistoryEntry) => {
      const v = Object.values(h.rirs || {})
        .filter((r) => r !== '')
        .map((r) => (r === 'CED' || r === '-1') ? -1 : Number(r))
        .filter((num) => !isNaN(num));
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const recentRirs = recent.map(rirOf).filter((v): v is number => v !== null);
    const olderRirs = older.map(rirOf).filter((v): v is number => v !== null);
    if (recentRirs.length < 2 || olderRirs.length < 2) return null;
    const avgRecent = recentRirs.reduce((a, b) => a + b, 0) / recentRirs.length;
    const avgOlder = olderRirs.reduce((a, b) => a + b, 0) / olderRirs.length;
    if (avgOlder - avgRecent >= 1) {
      return 'Tendenza Fatica: Il RIR medio sta calando rapidamente a parità di carico. Possibile accumulo di fatica sistemica, valuta uno scarico.';
    }
    return null;
  } catch {
    return null;
  }
}

export interface CoachAdvice {
  badge: 'increase' | 'maintain' | 'decrease' | 'info' | 'deload' | 'stall';
  title: string;
  message: string;
  fatigueAlert?: string;
  compactText?: string;
}

export function extractExerciseHistoryFromSessions(
  sessions: WorkoutSessionV2[] | undefined,
  exerciseId?: string,
  exerciseName?: string
): WeightHistoryEntry[] {
  if (!sessions) return [];
  const targetName = exerciseName ? exerciseName.trim().toLowerCase() : '';
  const dateMap = new Map<string, {
    date: string;
    sets: Array<{
      weight: number;
      reps: number | string;
      rir?: string;
      rpe?: string;
      durationSec?: number;
      customFields?: Record<string, string>;
    }>;
  }>();

  for (const session of sessions) {
    if (!session || !session.date) continue;
    if (!session.blocks || !Array.isArray(session.blocks)) continue;

    for (const block of session.blocks) {
      if (!block || typeof block !== 'object') continue;

      if ('rounds' in block) {
        if (!Array.isArray(block.rounds)) continue;
        for (const round of block.rounds) {
          if (!round || !Array.isArray(round.exercises)) continue;
          for (const sub of round.exercises) {
            if (!sub) continue;
            const matchId = exerciseId && sub.exerciseId === exerciseId;
            const matchName = targetName && String(sub.nameSnapshot || '').trim().toLowerCase() === targetName;
            if (matchId || (!exerciseId && matchName)) {
              if (!dateMap.has(session.date)) {
                dateMap.set(session.date, { date: session.date, sets: [] });
              }
              const entry = dateMap.get(session.date)!;
              if (Array.isArray(sub.sets)) {
                sub.sets.forEach((s) => {
                  if (!s) return;
                  let safeFields: Record<string, string> | undefined = undefined;
                  if (s.customFields && typeof s.customFields === 'object') {
                    safeFields = {};
                    Object.entries(s.customFields).forEach(([k, v]) => {
                      if (v !== undefined && v !== null && v !== '') {
                        safeFields![k] = String(v);
                      }
                    });
                    if (Object.keys(safeFields).length === 0) safeFields = undefined;
                  }
                  entry.sets.push({
                    weight: s.weight !== undefined ? s.weight : 0,
                    reps: s.reps !== undefined ? s.reps : '',
                    rir: s.isCed ? 'CED' : s.rir !== undefined ? String(s.rir) : undefined,
                    rpe: s.rpe !== undefined ? String(s.rpe) : undefined,
                    durationSec: s.durationSec !== undefined ? s.durationSec : undefined,
                    customFields: safeFields
                  });
                });
              }
            }
          }
        }
      } else {
        const exBlock = block as any;
        const matchId = exerciseId && exBlock.exerciseId === exerciseId;
        const matchName = targetName && String(exBlock.nameSnapshot || '').trim().toLowerCase() === targetName;
        if (matchId || (!exerciseId && matchName)) {
          if (!dateMap.has(session.date)) {
            dateMap.set(session.date, { date: session.date, sets: [] });
          }
          const entry = dateMap.get(session.date)!;
          if (Array.isArray(exBlock.sets)) {
            exBlock.sets.forEach((s: any) => {
              if (!s) return;
              let safeFields: Record<string, string> | undefined = undefined;
              if (s.customFields && typeof s.customFields === 'object') {
                safeFields = {};
                Object.entries(s.customFields).forEach(([k, v]) => {
                  if (v !== undefined && v !== null && v !== '') {
                    safeFields![k] = String(v);
                  }
                });
                if (Object.keys(safeFields).length === 0) safeFields = undefined;
              }
              entry.sets.push({
                weight: s.weight !== undefined ? s.weight : 0,
                reps: s.reps !== undefined ? s.reps : '',
                rir: s.isCed ? 'CED' : s.rir !== undefined ? String(s.rir) : undefined,
                rpe: s.rpe !== undefined ? String(s.rpe) : undefined,
                durationSec: s.durationSec !== undefined ? s.durationSec : undefined,
                customFields: safeFields
              });
            });
          }
        }
      }
    }
  }

  const entries: WeightHistoryEntry[] = [];
  for (const [date, data] of dateMap.entries()) {
    if (data.sets.length === 0) continue;
    const reps: Record<string, string> = {};
    const weights: Record<string, string> = {};
    const rirs: Record<string, string> = {};
    const rpes: Record<string, string> = {};
    const durations: Record<string, string> = {};
    const customFields: Record<string, Record<string, string>> = {};
    let maxW = 0;

    data.sets.forEach((s, idx) => {
      const sId = String(idx);
      if (s.reps !== undefined && s.reps !== '') reps[sId] = String(s.reps);
      weights[sId] = String(s.weight);
      if (s.weight > maxW) maxW = s.weight;
      if (s.rir !== undefined) rirs[sId] = s.rir;
      if (s.rpe !== undefined) rpes[sId] = s.rpe;
      if (s.durationSec !== undefined && s.durationSec !== null) durations[sId] = String(s.durationSec);
      if (s.customFields && Object.keys(s.customFields).length > 0) customFields[sId] = s.customFields;
    });

    entries.push({
      date,
      weight: String(maxW),
      weights,
      reps,
      rirs,
      rpes,
      durations: Object.keys(durations).length > 0 ? durations : undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined
    });
  }

  // Garantiamo ordinamento cronologico decrescente (la più recente all'indice 0)
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return entries;
}

export interface ProgressionContext {
  state: AppState;
  exId: string;
  targetRepsStr: string;
  metricType: MetricType;
  history: WeightHistoryEntry[];
  exName?: string;
  permanentExId?: string;
  exDef?: ExerciseDefV2 | null;
  fatigueAlert?: string | null;
  isCircuit?: boolean;
}

export type ProgressionStrategyFn = (ctx: ProgressionContext) => CoachAdvice | null;

/**
 * Strategy: Analisi Doppia Progressione (Pesi classici, macchine, zavorre e corpo libero)
 */
export function analyzeDoubleProgression(ctx: ProgressionContext): CoachAdvice | null {
  const { state, targetRepsStr, metricType, history, exDef, fatigueAlert } = ctx;
  if (!history || history.length === 0) return null;
  const lastSession = history[0];

  const validSetKeys = Object.keys(lastSession.reps || {}).filter((k) => lastSession.reps[k] !== '');
  if (validSetKeys.length === 0) {
    return fatigueAlert ? { badge: 'info', title: 'Segnale Affaticamento', message: fatigueAlert } : null;
  }

  let maxW = -1;
  const setsData: Array<{ reps: number; w: number; rir: number }> = [];

  validSetKeys.forEach((idx) => {
    const w = parseFloat(lastSession.weights?.[idx] ?? lastSession.weight) || 0;
    const reps = parseInt(lastSession.reps[idx]) || 0;
    const rawRir = lastSession.rirs?.[idx];
    const rir = (rawRir === 'CED' || rawRir === '-1') ? -1 : parseFloat(rawRir);

    if (w > maxW) maxW = w;
    if (!isNaN(rir)) {
      setsData.push({ reps, w, rir });
    }
  });

  if (setsData.length === 0) {
    return fatigueAlert ? { badge: 'info', title: 'Segnale Affaticamento', message: fatigueAlert } : null;
  }

  // Parsing Target Reps
  let minTarget = 8, maxTarget = 12;
  if (targetRepsStr.includes('-')) {
    const parts = targetRepsStr.split('-');
    minTarget = parseInt(parts[0]) || 8;
    maxTarget = parseInt(parts[1]) || 12;
  } else {
    const parsed = parseInt(targetRepsStr) || 10;
    minTarget = parsed;
    maxTarget = parsed;
  }

  const topSets = setsData.filter((s) => s.w === maxW);
  const bestTopSet = topSets.reduce((prev, curr) => (prev.reps > curr.reps ? prev : curr));
  const minRepsInTopSets = Math.min(...topSets.map((s) => s.reps));
  const avgRir = setsData.reduce((acc, curr) => acc + curr.rir, 0) / setsData.length;

  const jump = exDef?.progressionIncrement ?? (metricType === 'bodyweight' ? 1.0 : 2.5);

  let upThreshold = 1.5;
  if (state.bodyGoal === 'bulk') { upThreshold = 1.0; }
  else if (state.bodyGoal === 'cut') { upThreshold = 2.0; }

  const diagContext = `DIAGNOSI: Top set ${bestTopSet.reps}x${maxW > 0 ? maxW : 'BW'}${maxW > 0 ? 'kg' : ''} (RIR ${bestTopSet.rir}). RIR Medio: ${avgRir.toFixed(1)}. Serie peggiore al carico: ${minRepsInTopSets} reps.`;

  // 1. Esercizi di isolamento
  const isIsolation = exDef && typeof exDef.movementPattern === 'string' && exDef.movementPattern.includes('isolation');
  if (isIsolation) {
    if (minRepsInTopSets >= (minTarget - 1) && avgRir >= 1.5) {
      return {
        badge: 'increase',
        title: 'Overload Isolamento Sbloccato',
        message: `${diagContext} AZIONE: Drop-off fisiologico controllato (minimo ${minRepsInTopSets} reps, tollerata max 1 rep sotto il target ${minTarget}) e margine solido (RIR medio ${avgRir.toFixed(1)} >= 1.5). Puoi salire di carico a ${maxW + jump}kg.`,
        compactText: `AUMENTA - ${maxW + jump}kg (RIR solido ${avgRir.toFixed(1)})`
      };
    } else {
      return {
        badge: 'maintain',
        title: 'Consolidamento Isolamento',
        message: `${diagContext} AZIONE: Sugli esercizi di isolamento è tollerato un drop-off massimo di 1 rep sotto il target (${minTarget - 1} reps) con RIR medio >= 1.5 prima di salire di peso. Consolida a ${maxW > 0 ? maxW + 'kg' : 'BW'}.`,
        compactText: `MANTIENI - ${maxW > 0 ? maxW + 'kg' : 'BW'} (consolida isolamento)`
      };
    }
  }

  // 2. Corpo libero puro (senza zavorra)
  if (metricType === 'bodyweight' && maxW === 0) {
    if (bestTopSet.reps < maxTarget) {
      return {
        badge: 'increase',
        title: 'Costruzione Volume',
        message: `${diagContext} AZIONE: Non hai ancora saturato il target alto (${maxTarget}). Spingi per guadagnare ripetizioni totali.`,
        compactText: `SPINGI REPS - BW (target ${maxTarget} non saturato)`
      };
    } else {
      if (avgRir < upThreshold) {
        return {
          badge: 'maintain',
          title: 'Range Raggiunto (Consolida)',
          message: `${diagContext} AZIONE: Dominio numerico completato, ma il margine sistemico è basso. Consolida la pulizia tecnica prima di zavorrare.`,
          compactText: `MANTIENI - BW (RIR limite, consolida tecnica)`
        };
      } else {
        return {
          badge: 'increase',
          title: 'Pronto per Zavorra',
          message: `${diagContext} AZIONE: Pieno controllo tecnico. È il momento di inserire una zavorra modulare minima (registra il primo carico sostenibile).`,
          compactText: `ZAVORRA - prima zavorra minima (controllo tecnico pieno)`
        };
      }
    }
  }

  // 3. Pesi liberi, bilancieri, macchine e corpo libero zavorrato
  if (bestTopSet.reps < maxTarget) {
    return {
      badge: 'maintain',
      title: 'Progressione Volume',
      message: `${diagContext} AZIONE: Mantieni ${maxW}kg. Prova ad aggiungere 1 ripetizione nel primo set senza crollare nei successivi.`,
      compactText: `MANTIENI - ${maxW}kg (+1 rep primo set)`
    };
  } else {
    const repDropOff = bestTopSet.reps - minRepsInTopSets;

    if (repDropOff > 2) {
      return {
        badge: 'maintain',
        title: 'Stabilità Inadeguata',
        message: `${diagContext} AZIONE: Crollo prestazionale eccessivo tra le serie (drop-off di ${repDropOff} reps). Uniforma le ripetizioni su tutte le serie prima di salire di carico a causa dell'eccessiva perdita di stabilità.`,
        compactText: `MANTIENI - ${maxW}kg (drop-off eccessivo ${repDropOff} reps)`
      };
    }

    if (minRepsInTopSets < minTarget) {
      return {
        badge: 'maintain',
        title: 'Carenza Work Capacity',
        message: `${diagContext} AZIONE: Manca stamina a questo carico. Il drop-off è troppo ripido. Lavora per tenere almeno ${minTarget} reps in tutte le serie prima di salire.`,
        compactText: `MANTIENI - ${maxW}kg (stamina <${minTarget} reps)`
      };
    } else if (avgRir >= upThreshold && bestTopSet.rir >= upThreshold) {
      return {
        badge: 'increase',
        title: 'Overload Sbloccato',
        message: `${diagContext} AZIONE: Nessun crollo prestazionale e margine solido. Sali a ${maxW + jump}kg nel primo set odierno.`,
        compactText: `AUMENTA - ${maxW + jump}kg (RIR medio solido)`
      };
    } else {
      return {
        badge: 'maintain',
        title: 'Carico Saturato (RIR Limite)',
        message: `${diagContext} AZIONE: Ottimo volume a ${maxW}kg, ma il margine di sforzo sulle serie non consente ancora aumenti sicuri. Consolida.`,
        compactText: `MANTIENI - ${maxW}kg (RIR limite, consolida)`
      };
    }
  }
}

/**
 * Strategy: Analisi Progressione TUT (Time Under Tension per plank, isometrie, tenute)
 */
export function analyzeTUTProgression(ctx: ProgressionContext): CoachAdvice | null {
  const { history } = ctx;
  if (!history || history.length === 0) return null;

  if (history.length >= 2) {
    const curAvgDur = getAvgDuration(history[0]);
    const prevAvgDur = getAvgDuration(history[1]);
    const avgRir = getAvgRir(history[0]);

    if (curAvgDur > prevAvgDur && curAvgDur > 0) {
      const gain = Math.round(curAvgDur - prevAvgDur);
      return {
        badge: 'increase',
        title: 'Progressione TUT',
        message: `DIAGNOSI: Durata media aumentata da ${Math.round(prevAvgDur)}s a ${Math.round(curAvgDur)}s (+${gain}s). AZIONE: Eccellente progresso nel Time Under Tension. Consolida la tenuta isometrica prima di allungare ulteriormente.`,
        compactText: `TUT + - +${gain}s tenuta (consolida isometria)`
      };
    } else {
      if (avgRir !== null && avgRir <= 1) {
        return {
          badge: 'maintain',
          title: 'Insufficienza Work Capacity',
          message: `DIAGNOSI: Durata media (${Math.round(curAvgDur)}s) non superiore alla precedente (${Math.round(prevAvgDur)}s) con RIR tirato al limite (${avgRir.toFixed(1)}). AZIONE: Non forzare la durata; mantieni il tempo attuale curando la respirazione e la stabilità posturale.`,
          compactText: `MANTIENI - ${Math.round(curAvgDur)}s (RIR tirato al limite)`
        };
      } else {
        return {
          badge: 'maintain',
          title: 'Consolidamento Isometria',
          message: `DIAGNOSI: Durata media stabile (${Math.round(curAvgDur)}s vs ${Math.round(prevAvgDur)}s). AZIONE: Consolida la tenuta e mantieni la massima tensione corporea costante.`,
          compactText: `MANTIENI - ${Math.round(curAvgDur)}s (massima tensione)`
        };
      }
    }
  }

  return {
    badge: 'info',
    title: 'Focus Isometria',
    message: 'DIAGNOSI: Lavoro a tempo. AZIONE: Cura la respirazione diaframmatica e mantieni la massima tensione corporea costante.',
    compactText: 'FOCUS TUT - tenuta diaframmatica'
  };
}

/**
 * Strategy: Analisi Efficienza Cardio (RPE vs Lavoro)
 * Stesso lavoro a RPE più basso = Efficienza; Più lavoro a stesso RPE = Capacità.
 * Rimosso ogni assunto che RPE <= 6 sia automaticamente Zone 2.
 */
export function analyzeCardioEfficiency(ctx: ProgressionContext): CoachAdvice | null {
  const { history } = ctx;
  if (!history || history.length === 0) return null;

  const curSession = history[0];
  const curAvgRpe = getAvgRpe(curSession);

  if (history.length >= 2) {
    const prevSession = history[1];
    const prevAvgRpe = getAvgRpe(prevSession);

    const positiveMetricKeys = ['distanza', 'distance', 'velocita', 'velocità', 'speed', 'inclinazione', 'incline', 'resistenza', 'resistance'];

    let improvedCapacity = false;
    let improvedEfficiency = false;
    let diffDetail = '';

    for (const key of positiveMetricKeys) {
      const curVal = getAvgCustomField(curSession, key);
      const prevVal = getAvgCustomField(prevSession, key);
      if (curVal !== null && prevVal !== null && prevVal > 0) {
        const diffPct = ((curVal - prevVal) / prevVal) * 100;
        
        // Più lavoro a stesso o minore RPE = Capacità di Lavoro
        if (diffPct >= 2 && curAvgRpe !== null && prevAvgRpe !== null && curAvgRpe <= prevAvgRpe) {
          improvedCapacity = true;
          diffDetail = `${key} salita da ${prevVal.toFixed(1)} a ${curVal.toFixed(1)} (+${diffPct.toFixed(1)}%) con RPE stabile (${curAvgRpe.toFixed(1)} vs ${prevAvgRpe.toFixed(1)})`;
          break;
        }
        // Stesso lavoro a RPE più basso = Efficienza
        if (Math.abs(diffPct) < 2 && curAvgRpe !== null && prevAvgRpe !== null && (prevAvgRpe - curAvgRpe) >= 0.5) {
          improvedEfficiency = true;
          diffDetail = `${key} mantenuta a ${curVal.toFixed(1)} ma con RPE sceso da ${prevAvgRpe.toFixed(1)} a ${curAvgRpe.toFixed(1)}`;
          break;
        }
      }
    }

    if (!improvedCapacity && !improvedEfficiency) {
      const curPasso = getAvgCustomField(curSession, 'passo');
      const prevPasso = getAvgCustomField(prevSession, 'passo');
      if (curPasso !== null && prevPasso !== null && prevPasso > 0) {
        // Passo più veloce (numero inferiore) a RPE pari o minore = Capacità
        if (curPasso < prevPasso && curAvgRpe !== null && prevAvgRpe !== null && curAvgRpe <= prevAvgRpe) {
          improvedCapacity = true;
          diffDetail = `passo migliorato da ${prevPasso.toFixed(1)} a ${curPasso.toFixed(1)} con RPE ${curAvgRpe.toFixed(1)}`;
        } else if (Math.abs(curPasso - prevPasso) <= 0.1 && curAvgRpe !== null && prevAvgRpe !== null && (prevAvgRpe - curAvgRpe) >= 0.5) {
          improvedEfficiency = true;
          diffDetail = `passo invariato a ${curPasso.toFixed(1)} con sforzo RPE calato da ${prevAvgRpe.toFixed(1)} a ${curAvgRpe.toFixed(1)}`;
        }
      }
    }

    if (improvedCapacity) {
      return {
        badge: 'increase',
        title: 'Miglioramento Capacità di Lavoro',
        message: `DIAGNOSI: ${diffDetail}. AZIONE: Più lavoro svolto a parità o minore sforzo percepito. Capacità cardiovascolare incrementata: consolida o alza gradualmente il ritmo.`,
        compactText: 'CAPACITÀ + - più lavoro a pari RPE'
      };
    }

    if (improvedEfficiency) {
      return {
        badge: 'increase',
        title: 'Maggiore Efficienza Aerobica',
        message: `DIAGNOSI: ${diffDetail}. AZIONE: Stesso lavoro a RPE inferiore. Il sistema cardiovascolare lavora con minore dispendio energetico allo stesso output. Ottimo adattamento!`,
        compactText: 'EFFICIENZA + - stesso lavoro a minor RPE'
      };
    }
  }

  // Valutazione dello sforzo percepito RPE (senza assumere che RPE <= 6 sia automaticamente 'Zone 2')
  if (curAvgRpe !== null) {
    if (curAvgRpe <= 3) {
      return {
        badge: 'increase',
        title: 'Sforzo Blando',
        message: `DIAGNOSI: RPE medio ${curAvgRpe.toFixed(1)} (intensità minima). AZIONE: Sforzo molto leggero: puoi incrementare velocità, pendenza o resistenza per stimolare adattamenti cardiovascolari significativi.`,
        compactText: 'AUMENTA - sforzo blando (alza velocità/pendenza)'
      };
    } else if (curAvgRpe <= 6) {
      return {
        badge: 'maintain',
        title: 'Sforzo Moderato Controllato',
        message: `DIAGNOSI: RPE medio ${curAvgRpe.toFixed(1)} (intensità moderata sostenibile). AZIONE: Ritmo ben controllato. Mantieni questo pacing per consolidare la base aerobica senza generare eccessiva fatica sistemica.`,
        compactText: 'MANTIENI - ritmo moderato controllato'
      };
    } else if (curAvgRpe <= 8) {
      return {
        badge: 'maintain',
        title: 'Sforzo Intenso / Soglia',
        message: `DIAGNOSI: RPE medio ${curAvgRpe.toFixed(1)} (ritmo sostenuto in prossimità della soglia). AZIONE: Seduta impegnativa: consolida questo volume e intensità prima di forzare ulteriori incrementi.`,
        compactText: 'CONSOLIDA - sforzo intenso in soglia'
      };
    } else {
      return {
        badge: 'maintain',
        title: 'Sforzo Massimale',
        message: `DIAGNOSI: RPE medio ${curAvgRpe.toFixed(1)} (intensità massimale). AZIONE: Sessione spinta al limite anaerobico: assicurati un recupero completo prima della prossima seduta intensa.`,
        compactText: 'RECUPERA - sforzo massimale'
      };
    }
  }

  return null;
}

export const progressionStrategies: Record<string, ProgressionStrategyFn> = {
  double_progression: analyzeDoubleProgression,
  time_under_tension: analyzeTUTProgression,
  distance_speed: analyzeCardioEfficiency,
  fixed_volume: analyzeDoubleProgression
};

export function getExerciseCoachAdvice(
  state: AppState,
  exId: string,
  targetRepsStr: string,
  metricType: MetricType,
  isCircuit = false,
  exName?: string,
  permanentExId?: string
): CoachAdvice | null {
  try {
    const isWeightType = metricType === 'weight' || metricType === 'bodyweight' || !metricType;
    // CANONICAL V2: Estraiamo lo storico reale dalle sessioni immutabili
    const rawHistory = extractExerciseHistoryFromSessions(state.sessionsV2, permanentExId || exId, exName);
    const deloadDates = state.deloadDates || [];
    const history = isWeightType && deloadDates.length > 0
      ? rawHistory.filter((h) => !deloadDates.includes(h.date))
      : rawHistory;

    // Smart Deload check
    if (isWeightType && state.deloadActive) {
      return {
        badge: 'deload',
        title: 'Settimana di Scarico (Deload)',
        message: 'DIAGNOSI: Scarico sistemico attivo. AZIONE: Riduci il volume del 30-40% e mantieni un margine elevato (RIR 3-4). Nessuna progressione oggi.',
        compactText: 'SCARICO - volume -30-40% (RIR 3-4)'
      };
    }

    if (!history || history.length === 0) {
      const bm = state.bodyMetrics;
      if (bm && bm.ffm && isWeightType) {
        return {
          badge: 'info',
          title: 'Prima Sessione',
          message: `DIAGNOSI: Nessuno storico presente per calibrare. AZIONE: Esegui il primo set ed esplora il carico in base alle sensazioni odierne.`,
          compactText: 'PRIMA SESSIONE - esplora carico'
        };
      }
      return null;
    }

    const fatigueAlert = isWeightType ? getFatigueTrendAlert(history) : null;

    // Controllo Stallo avanzato (3 sessioni identiche in carico e ripetizioni medie non migliorate con verifica RIR)
    if (history.length >= 3 && isWeightType) {
      const w1 = parseFloat(history[0].weight) || 0;
      const w2 = parseFloat(history[1].weight) || 0;
      const w3 = parseFloat(history[2].weight) || 0;
      const reps1 = getAvgReps(history[0]);
      const reps3 = getAvgReps(history[2]);

      if ((w1 > 0 || metricType === 'bodyweight') && w1 === w2 && w2 === w3 && reps1 <= reps3) {
        const avgRirRecent = getAvgRir(history[0]);
        const avgRirOld = getAvgRir(history[2]);

        // Efficienza Neurale: scatta SE avgRirRecent > avgRirOld (il margine è aumentato, fai meno fatica)
        if (avgRirRecent !== null && avgRirOld !== null && avgRirRecent > avgRirOld) {
          return {
            badge: 'info',
            title: 'Efficienza Neurale',
            message: 'Carico e volume stabili, ma la tua tolleranza allo sforzo è migliorata. Il peso pesa meno. Consolida o preparati a salire.',
            compactText: `EFFICIENZA NEURALE - ${w1 > 0 ? w1 + 'kg' : 'BW'} (peso consolidato)`
          };
        }

        // Stallo Reale: scatta SE avgRirRecent <= avgRirOld (nessun miglioramento di reps E fatica uguale o peggiore)
        if (avgRirRecent === null || avgRirOld === null || avgRirRecent <= avgRirOld) {
          return {
            badge: 'stall',
            title: 'Segnale di Stallo Rilevato',
            message: `DIAGNOSI: 3 esposizioni con ${w1}kg senza miglioramento di volume medio. AZIONE: Non forzare il carico. Valuta un back-off (riduci 10%) o aumenta le pause di 30s per smaltire fatica.`,
            compactText: `STALLO - ${w1 > 0 ? w1 + 'kg' : 'BW'} (valuta back-off -10%)`,
            fatigueAlert: fatigueAlert || undefined
          };
        }
      }
    }

    const exDef = (permanentExId && state.registryV2?.[permanentExId]) ? state.registryV2[permanentExId] : null;

    const ctx: ProgressionContext = {
      state,
      exId,
      targetRepsStr,
      metricType,
      history,
      exName,
      permanentExId,
      exDef,
      fatigueAlert,
      isCircuit
    };

    // Strategy Pattern in base a progressionModel definito nel registryV2 (con fallback su metricType)
    let strategyKey: string = exDef?.progressionModel || '';
    if (!strategyKey) {
      if (metricType === 'cardio') strategyKey = 'distance_speed';
      else if (metricType === 'time') strategyKey = 'time_under_tension';
      else strategyKey = 'double_progression';
    }

    const strategy = progressionStrategies[strategyKey] || analyzeDoubleProgression;
    const advice = strategy(ctx);

    if (advice) return advice;
    return fatigueAlert ? { badge: 'info', title: 'Coach Tendenza', message: fatigueAlert } : null;
  } catch (e) {
    console.warn('Errore analisi Coach:', e);
    return null;
  }
}

export function getGoalCrossInsight(state: AppState, stats: VolumeStats): string | null {
  try {
    const goal = state.bodyGoal;
    if (!goal || goal === 'recomp') return null;
    const hist = state.bodyMetricsHistory || [];
    const validBiaEntries = hist.filter((h) => h.fm !== '' && h.fm != null && h.ffm !== '' && h.ffm != null);
    if (validBiaEntries.length < 2) return null;
    const cur = validBiaEntries[0];
    const past = validBiaEntries[1];
    const curFm = parseFloat(String(cur.fm)) || null;
    const pastFm = parseFloat(String(past.fm)) || null;
    const fmDown = curFm !== null && pastFm !== null && pastFm - curFm >= 0.5;
    const curWeight = parseFloat(String(cur.weight)) || 0;
    const pastWeight = parseFloat(String(past.weight)) || 0;
    const curFfm = parseFloat(String(cur.ffm)) || 0;
    const pastFfm = parseFloat(String(past.ffm)) || 0;
    const weightUp = curWeight - pastWeight >= 0.3;
    const ffmUp = curFfm - pastFfm >= 0.3;
    const volumeHigh = stats.hasLastWeek && stats.lastWeek.tonnage > 0 && stats.week.tonnage > stats.lastWeek.tonnage * 1.15;
    if (goal === 'cut' && fmDown && volumeHigh) {
      const pct = Math.round((stats.week.tonnage / stats.lastWeek.tonnage - 1) * 100);
      return `In cut la massa grassa è in calo ma il volume settimanale è salito del +${pct}%. Rischio sovraccarico: valuta uno scarico.`;
    }
    if (goal === 'bulk' && weightUp && ffmUp) {
      return `In bulk peso e massa magra sono in crescita costante: continua così!`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Analisi Ecosistema Circuiti
 * Confronta le ripetizioni del round 0 con il round 2 (o l'ultimo disponibile).
 * Se il crollo medio supera il 30%, consiglia un aumento della pausa tra i round.
 */
export function getCircuitCoachAdvice(state: AppState, circuit: SupersetExercise): CoachAdvice | null {
  try {
    if (!state.sessionsV2 || state.sessionsV2.length === 0 || !circuit || !Array.isArray(circuit.exercises) || circuit.exercises.length === 0) {
      return null;
    }

    const circuitName = (circuit.name || '').trim().toLowerCase();
    const exIds = new Set(circuit.exercises.map((e) => e.exerciseId || e.id));

    // 1. Estrai tutto lo storico di questo specifico circuito
    const history: CircuitSnapshotV2[] = [];
    for (const session of state.sessionsV2) {
      if (!session || !Array.isArray(session.blocks)) continue;
      for (const b of session.blocks) {
        if (!b || typeof b !== 'object' || !('rounds' in b)) continue;
        const circ = b as CircuitSnapshotV2;
        const nameMatches = circuitName && (circ.nameSnapshot || '').trim().toLowerCase() === circuitName;
        const hasMatchingExercises = Array.isArray(circ.rounds) && circ.rounds.some((r) =>
          Array.isArray(r.exercises) && r.exercises.some((sub) =>
            (sub.exerciseId && exIds.has(sub.exerciseId))
          )
        );
        if (nameMatches || hasMatchingExercises) {
          history.push(circ);
          break; // Preso il circuito, passa alla sessione successiva
        }
      }
    }

    if (history.length === 0) return null;

    const lastCirc = history[0];
    const prevCirc = history.length > 1 ? history[1] : null;
    const type = circuit.structureType || 'classic'; 

    // Helper per conteggio reps complessive del circuito
    const countCircuitTotalReps = (circ: CircuitSnapshotV2): number => {
      let total = 0;
      if (Array.isArray(circ.rounds)) {
        circ.rounds.forEach((r) => {
          if (Array.isArray(r.exercises)) {
            r.exercises.forEach((sub) => {
              if (Array.isArray(sub.sets)) {
                sub.sets.forEach((s) => {
                  total += Number(s.reps) || 0;
                });
              }
            });
          }
        });
      }
      return total;
    };

    // --- MOTORE AMRAP (Work Capacity & Pacing) ---
    if (type === 'amrap') {
      const curRounds = lastCirc.rounds?.length || 0;
      const curTotalReps = countCircuitTotalReps(lastCirc);

      if (!prevCirc) {
        return {
          badge: 'info',
          title: 'Baseline AMRAP',
          message: `DIAGNOSI: Primo riferimento registrato (${curRounds} giri, ${curTotalReps} reps totali). AZIONE: Usa questo volume come target da battere al prossimo allenamento impostando un pacing regolare fin dal primo minuto.`,
          compactText: `BASELINE AMRAP - ${curRounds} giri (${curTotalReps} reps)`
        };
      }

      const prevRounds = prevCirc.rounds?.length || 0;
      const prevTotalReps = countCircuitTotalReps(prevCirc);
      const diffReps = curTotalReps - prevTotalReps;

      if (curTotalReps > prevTotalReps) {
        return {
          badge: 'increase',
          title: 'Work Capacity Migliorata',
          message: `DIAGNOSI: Completate ${curTotalReps} reps totali (${curRounds} giri) contro ${prevTotalReps} reps (${prevRounds} giri) (+${diffReps} reps). AZIONE: Ottima gestione del ritmo e del pacing complessivo! Consolida questo volume o punta a ridurre le pause di transizione.`,
          compactText: `CAPACITÀ + - +${diffReps} reps (ottimo pacing)`
        };
      } else if (curTotalReps < prevTotalReps) {
        return {
          badge: 'decrease',
          title: 'Calo di Pacing',
          message: `DIAGNOSI: Registrate ${curTotalReps} reps totali (${curRounds} giri) contro ${prevTotalReps} reps (${prevRounds} giri) (-${Math.abs(diffReps)} reps). AZIONE: Probabile partenza troppo esplosiva o fatica sistemica. Distribuisci lo sforzo in modo più uniforme nei primi round per preservare la riserva energetica.`,
          compactText: `CALO PACING - distribuisci sforzo iniziale`
        };
      } else {
        return {
          badge: 'maintain',
          title: 'Pacing Costante',
          message: `DIAGNOSI: Volume stabile (${curTotalReps} reps totali, ${curRounds} giri). AZIONE: Pacing consolidato. Per sbloccare la progressione prova a velocizzare le transizioni tra un esercizio e il successivo.`,
          compactText: `PACING COSTANTE - ${curTotalReps} reps (${curRounds} giri)`
        };
      }
    }

    // --- MOTORE EMOM (Metabolic Failure & Densità) ---
    if (type === 'emom') {
      const curRounds = lastCirc.rounds?.length || 0;
      const targetRounds = circuit.emomTotalMin && circuit.emomIntervalSec ? Math.ceil((circuit.emomTotalMin * 60) / circuit.emomIntervalSec) : curRounds;
      
      if (curRounds < targetRounds) {
        return {
          badge: 'decrease',
          title: 'Cedimento Metabolico',
          message: `DIAGNOSI: Chiusi ${curRounds} intervalli su ${targetRounds}. Il tempo di lavoro ha eroso il recupero. AZIONE: Scala i carichi o riduci le reps del 10% per riuscire a completare ogni round entro il tempo previsto senza bruciarti.`,
          compactText: `CEDIMENTO - riduci reps 10% (buffer eroso)`
        };
      } else {
        // Estrai il tempo residuo registrato nei round
        const roundRemainingSecs: number[] = [];
        if (Array.isArray(lastCirc.rounds)) {
          lastCirc.rounds.forEach((r) => {
            let roundRem: number | null = null;
            if (Array.isArray(r.exercises)) {
              for (const ex of r.exercises) {
                if (Array.isArray(ex.sets)) {
                  for (const s of ex.sets) {
                    const rem = s.customFields?.['masterTimerRemainingSec'];
                    if (rem !== undefined && rem !== null && !isNaN(Number(rem))) {
                      roundRem = Number(rem);
                      break;
                    }
                  }
                }
                if (roundRem !== null) break;
              }
            }
            if (roundRem !== null) roundRemainingSecs.push(roundRem);
          });
        }

        if (roundRemainingSecs.length >= 2) {
          const firstRem = roundRemainingSecs[0];
          const lastRem = roundRemainingSecs[roundRemainingSecs.length - 1];
          const avgRem = Math.round(roundRemainingSecs.reduce((a, b) => a + b, 0) / roundRemainingSecs.length);
          const remDrop = firstRem - lastRem;

          // Se il tempo residuo cala drasticamente (erosione del buffer finale sotto i 5s o crollo >= 8s)
          if ((remDrop >= 8 && lastRem <= 5) || (firstRem > 0 && lastRem / firstRem <= 0.35) || lastRem <= 3) {
            return {
              badge: 'maintain',
              title: 'Densità Eccessiva (Buffer Eroso)',
              message: `DIAGNOSI: Tutti i ${curRounds} intervalli chiusi, ma il tempo residuo di recupero è crollato drasticamente (da ${firstRem}s a ${lastRem}s nei round finali). AZIONE: Densità metabolica al limite. Nessun aumento di carico: consolida questo ritmo per ripristinare un margine di recupero adeguato tra i round.`,
              compactText: `DENSITÀ AL LIMITE - ${lastRem}s residui (nessun aumento carico)`
            };
          }

          return {
            badge: 'increase',
            title: 'Densità Dominata',
            message: `DIAGNOSI: Completati tutti i ${targetRounds} intervalli con buffer di recupero solido (media ${avgRem}s residui per giro). AZIONE: Hai dominato la densità. Al prossimo workout puoi aggiungere 1 intervallo o incrementare un micro-carico.`,
            compactText: `DENSITÀ DOMINATA - media ${avgRem}s residui (sali carico)`
          };
        }

        return {
          badge: 'increase',
          title: 'Densità Dominata',
          message: `DIAGNOSI: Completati tutti i ${targetRounds} intervalli. AZIONE: Hai dominato la densità. Al prossimo workout aggiungi 1 minuto totale al timer o aumenta un micro-carico.`,
          compactText: `DENSITÀ DOMINATA - tutti gli intervalli chiusi`
        };
      }
    }

    // --- MOTORE CLASSICO (Performance Stability & Drop-off) ---
    if (type === 'classic') {
      if (!lastCirc.rounds || lastCirc.rounds.length < 2) return null;
      const r0 = lastCirc.rounds[0];
      const rLast = lastCirc.rounds[lastCirc.rounds.length - 1];
      
      const countReps = (round: any) => {
        let total = 0;
        if (Array.isArray(round.exercises)) {
          round.exercises.forEach((ex: any) => {
            if (Array.isArray(ex.sets)) ex.sets.forEach((s: any) => total += (Number(s.reps) || 0));
          });
        }
        return total;
      };

      const reps0 = countReps(r0);
      const repsLast = countReps(rLast);

      if (reps0 > 0) {
        const drop = (reps0 - repsLast) / reps0;
        if (drop > 0.25) {
           return { badge: 'maintain', title: 'Drop-off Eccessivo', message: `DIAGNOSI: Crollo del volume > 25% tra il primo e l'ultimo giro (${reps0} ➔ ${repsLast} reps). AZIONE: Aumenta il recupero di 30-45s a fine round per stabilizzare la performance.` };
        } else {
           return { badge: 'increase', title: 'Stabilità Ottimale', message: `DIAGNOSI: Performance mantenuta solida fino all'ultimo giro (Drop: ${(drop * 100).toFixed(0)}%). AZIONE: Se l'RIR è buono, puoi aumentare il carico sul primo esercizio o aggiungere un round.` };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('Errore analisi Circuito:', err);
    return null;
  }
}

import { WorkoutSessionV2 } from '../types/v2';
import { AppState, MetricType, WeightHistoryEntry } from '../types/gym';
import { getTodayStr } from './storage';

export interface VolumeStats {
  today: number;
  week: number;
  lastWeek: number;
  month: number;
  lastMonth: number;
  year: number;
  lastYear: number;
  hasLastWeek: boolean;
  hasLastMonth: boolean;
  hasLastYear: boolean;
}

// --- 🔴 MOTORE V2: Calcolo del volume storicizzato perfetto (FASE F) ---
export function calculateVolumeFromSessionV2(session: WorkoutSessionV2): number {
  let vol = 0;
  const bw = session.bodyWeightAtSession || 0; // Il peso di quel giorno esatto!
  if (!session.blocks) return vol;

  for (const block of session.blocks) {
    if ('rounds' in block) {
      for (const r of block.rounds) {
        for (const sub of r.exercises) {
          if (!sub.sets) continue;
          for (const set of sub.sets) {
            const reps = set.reps || 0;
            const w = set.weight || 0;
            if (sub.type === 'weight' || !sub.type) vol += reps * w;
            else if (sub.type === 'bodyweight') vol += reps * (w + bw);
            else if (sub.type === 'time') vol += bw * ((set.durationSec || 60) / 10);
          }
        }
      }
    } else {
      if (!block.sets) continue;
      for (const set of block.sets) {
        const reps = set.reps || 0;
        const w = set.weight || 0;
        if (block.type === 'weight' || !block.type) vol += reps * w;
        else if (block.type === 'bodyweight') vol += reps * (w + bw);
        else if (block.type === 'time') vol += bw * ((set.durationSec || 60) / 10);
      }
    }
  }
  return vol;
}

export function calculateAllVolumeStatsV2(sessionsV2: WorkoutSessionV2[]): VolumeStats {
  const d = new Date();
  const todayStr = getTodayStr();
  const stats: VolumeStats = {
    today: 0, week: 0, lastWeek: 0, month: 0, lastMonth: 0, year: 0, lastYear: 0,
    hasLastWeek: false, hasLastMonth: false, hasLastYear: false
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
    const vol = calculateVolumeFromSessionV2(session);
    if (vol === 0) continue;

    if (session.date === todayStr) stats.today += vol;

    const parts = session.date.split('-');
    const logDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    
    if (logDate >= currentWeekStart) stats.week += vol;
    if (logDate >= lastWeekStart && logDate <= lastWeekEnd) { stats.lastWeek += vol; stats.hasLastWeek = true; }
    if (logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth) stats.month += vol;
    if (logDate.getFullYear() === lastMonthYear && logDate.getMonth() === lastMonth) { stats.lastMonth += vol; stats.hasLastMonth = true; }
    if (logDate.getFullYear() === currentYear) stats.year += vol;
    if (logDate.getFullYear() === lastYear) { stats.lastYear += vol; stats.hasLastYear = true; }
  }

  return stats;
}

export function computeCurrentStreak(workoutDates: string[]): number {
  // 1. Raccogliamo le date univoche
  const dates = new Set(workoutDates || []);
  if (dates.size === 0) return 0;

  // 2. Funzione per trovare l'inizio della settimana (Lunedì a mezzanotte)
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay() || 7; // Rendiamo la domenica 7 invece di 0
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day + 1);
    return date.getTime();
  };

  // 3. Raggruppiamo gli allenamenti per settimana
  const weekCounts: Record<number, Set<string>> = {};
  dates.forEach(dStr => {
    const d = new Date(dStr);
    const mondayTime = getMonday(d);
    if (!weekCounts[mondayTime]) weekCounts[mondayTime] = new Set();
    weekCounts[mondayTime].add(dStr);
  });

  let streak = 0;
  let currentMonday = getMonday(new Date());

  // 4. Se questa settimana non ha ancora 4 allenamenti, controlliamo la settimana scorsa
  if ((weekCounts[currentMonday]?.size || 0) < 4) {
     const lastWeek = new Date(currentMonday);
     lastWeek.setDate(lastWeek.getDate() - 7);
     
     if ((weekCounts[lastWeek.getTime()]?.size || 0) >= 4) {
         // La settimana scorsa era valida, partiamo da lì a contare!
         currentMonday = lastWeek.getTime();
     } else {
         // Se nemmeno la settimana scorsa ha 4 allenamenti, la serie è persa
         return 0;
     }
  }

  // 5. Contiamo all'indietro tutte le settimane consecutive con almeno 4 allenamenti
  while ((weekCounts[currentMonday]?.size || 0) >= 4) {
    streak++;
    const prevWeek = new Date(currentMonday);
    prevWeek.setDate(prevWeek.getDate() - 7);
    currentMonday = prevWeek.getTime();
  }

  return streak;
}

function getAvgReps(histEntry: WeightHistoryEntry): number {
  const r = Object.values(histEntry.reps || {})
    .filter((v) => v !== '' && !isNaN(Number(v)))
    .map(Number);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
}

export function getFatigueTrendAlert(effHistory: WeightHistoryEntry[]): string | null {
  try {
    if (!effHistory || effHistory.length < 4) return null;
    const rirOf = (h: WeightHistoryEntry) => {
      const v = Object.values(h.rirs || {})
        .filter((r) => r !== '' && !isNaN(Number(r)))
        .map(Number);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const recentRirs = effHistory.slice(0, 2).map(rirOf).filter((v): v is number => v !== null);
    const olderRirs = effHistory.slice(2, 4).map(rirOf).filter((v): v is number => v !== null);
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
}

export function extractExerciseHistoryFromSessions(
  sessions: WorkoutSessionV2[] | undefined,
  exerciseId?: string,
  exerciseName?: string
): WeightHistoryEntry[] {
  if (!sessions) return [];
  const entries: WeightHistoryEntry[] = [];
  const targetName = exerciseName ? exerciseName.trim().toLowerCase() : '';

  for (const session of sessions) {
    for (const block of session.blocks) {
      if ('rounds' in block) {
        for (const round of block.rounds) {
          for (const sub of round.exercises) {
            const matchId = exerciseId && sub.exerciseId === exerciseId;
            const matchName = targetName && sub.nameSnapshot.trim().toLowerCase() === targetName;
            if (matchId || (!exerciseId && matchName)) {
              const reps: Record<string, string> = {};
              const weights: Record<string, string> = {};
              const rirs: Record<string, string> = {};
              const rpes: Record<string, string> = {};
              let primaryW = '0';
              sub.sets.forEach((s) => {
                const sId = String(s.index - 1);
                if (s.reps !== undefined) reps[sId] = String(s.reps);
                if (s.weight !== undefined) {
                  weights[sId] = String(s.weight);
                  primaryW = String(s.weight);
                }
                if (s.rir !== undefined) rirs[sId] = String(s.rir);
                if (s.isCed) rirs[sId] = 'CED';
                if (s.rpe !== undefined) rpes[sId] = String(s.rpe);
              });
              entries.push({ date: session.date, weight: primaryW, weights, reps, rirs, rpes });
            }
          }
        }
      } else {
        const matchId = exerciseId && block.exerciseId === exerciseId;
        const matchName = targetName && block.nameSnapshot.trim().toLowerCase() === targetName;
        if (matchId || (!exerciseId && matchName)) {
          const reps: Record<string, string> = {};
          const weights: Record<string, string> = {};
          const rirs: Record<string, string> = {};
          const rpes: Record<string, string> = {};
          let primaryW = '0';
          block.sets.forEach((s) => {
            const sId = String(s.index - 1);
            if (s.reps !== undefined) reps[sId] = String(s.reps);
            if (s.weight !== undefined) {
              weights[sId] = String(s.weight);
              primaryW = String(s.weight);
            }
            if (s.rir !== undefined) rirs[sId] = String(s.rir);
            if (s.isCed) rirs[sId] = 'CED';
            if (s.rpe !== undefined) rpes[sId] = String(s.rpe);
          });
          entries.push({ date: session.date, weight: primaryW, weights, reps, rirs, rpes });
        }
      }
    }
  }
  return entries;
}

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
    // 🔴 CANONICAL V2: Estraiamo lo storico reale dalle sessioni immutabili
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
        message: 'Scarico attivo: riduci il volume del 30-40% e mantieni un margine elevato (RIR 3-4). Nessuna progressione oggi.'
      };
    }

    if (!history || history.length === 0) {
      const bm = state.bodyMetrics;
      if (bm && bm.ffm && isWeightType) {
        return {
          badge: 'info',
          title: 'Prima Sessione',
          message: `Nello storico non ci sono dati per questo esercizio. Esegui il primo set e calibra in base alle sensazioni.`
        };
      }
      return null;
    }

    const lastSession = history[0];
    const fatigueAlert = isWeightType ? getFatigueTrendAlert(history) : null;

    // Controllo Stallo avanzato (3 sessioni identiche in carico e ripetizioni)
    if (history.length >= 3 && isWeightType) {
      const w1 = parseFloat(history[0].weight) || 0;
      const w2 = parseFloat(history[1].weight) || 0;
      const w3 = parseFloat(history[2].weight) || 0;
      const reps1 = getAvgReps(history[0]);
      const reps3 = getAvgReps(history[2]);
      if (w1 > 0 && w1 === w2 && w2 === w3 && reps1 <= reps3) {
        return {
          badge: 'stall',
          title: 'Stallo Rilevato',
          message: 'Carico bloccato da 3 sessioni. Strategia di sblocco: prova a ridurre il carico del 10% per un ciclo o aumenta la pausa di 30s.',
          fatigueAlert: fatigueAlert || undefined
        };
      }
    }

    if (metricType === 'cardio') {
      if (lastSession.rpes) {
        const validRpes = Object.values(lastSession.rpes).map(Number).filter((r) => !isNaN(r));
        if (validRpes.length > 0) {
          const avgRpe = validRpes.reduce((a, b) => a + b, 0) / validRpes.length;
          if (avgRpe <= 5) {
            return { badge: 'increase', title: 'Sforzo Leggero', message: `RPE medio ${avgRpe.toFixed(1)}. Puoi aumentare velocità o inclinazione.` };
          } else if (avgRpe <= 7) {
            return { badge: 'maintain', title: 'Zona Moderata', message: `RPE ${avgRpe.toFixed(1)}. Ottimo equilibrio aerobico.` };
          } else {
            return { badge: 'maintain', title: 'Sforzo Intenso', message: `RPE ${avgRpe.toFixed(1)}. Sessione impegnativa, mantieni i parametri.` };
          }
        }
      }
      return null;
    }

    if (metricType === 'time') {
      return { badge: 'info', title: 'Isometria', message: 'Cura la respirazione e mantieni la massima tensione corporea.' };
    }

    // Standard weights & Bodyweight (True Double Progression)
    if (isWeightType) {
      const validSetKeys = Object.keys(lastSession.reps || {}).filter((k) => lastSession.reps[k] !== '');
      if (validSetKeys.length > 0) {
        let maxW = -1;
        let topIdx = validSetKeys[0];
        validSetKeys.forEach((idx) => {
          const w = parseFloat(lastSession.weights?.[idx] ?? lastSession.weight) || 0;
          if (w > maxW) {
            maxW = w;
            topIdx = idx;
          }
        });

        const topWeight = maxW;
        const topReps = parseInt(lastSession.reps[topIdx]) || 0;
        const topRir = parseFloat(lastSession.rirs[topIdx]);

        // Parsing della Doppia Progressione (es. "8-12" -> min: 8, max: 12)
        let minTargetReps = 8;
        let maxTargetReps = 12;
        if (targetRepsStr.includes('-')) {
          const parts = targetRepsStr.split('-');
          minTargetReps = parseInt(parts[0]) || 8;
          maxTargetReps = parseInt(parts[1]) || 12;
        } else {
          const parsed = parseInt(targetRepsStr) || 10;
          minTargetReps = parsed;
          maxTargetReps = parsed;
        }

        let upThreshold = 2.0;
        let downThreshold = 0.5;
        if (state.bodyGoal === 'bulk') { upThreshold = 1.0; downThreshold = 0.5; }
        else if (state.bodyGoal === 'cut') { upThreshold = 2.5; downThreshold = 0.0; }

        // Corpo Libero Puro
        if (metricType === 'bodyweight' && topWeight === 0) {
          if (!isNaN(topRir)) {
            if (topReps < maxTargetReps && topRir >= upThreshold) {
              return {
                badge: 'increase',
                title: 'Doppia Progressione (Reps)',
                message: `Sul top set hai chiuso ${topReps} reps con RIR ${topRir.toFixed(1)}. Obiettivo: punta a chiudere ${topReps + 1}-${maxTargetReps} reps oggi.`,
                fatigueAlert: fatigueAlert || undefined
              };
            } else if (topReps >= maxTargetReps && topRir >= upThreshold) {
              return {
                badge: 'increase',
                title: 'Pronto per la Zavorra',
                message: `Hai saturato il range massimo (${topReps} reps) con ottimo margine (RIR ${topRir.toFixed(1)}). Inizia a usare una zavorra leggera (+2.5kg).`,
                fatigueAlert: fatigueAlert || undefined
              };
            } else {
              return {
                badge: 'maintain',
                title: 'Consolida le Reps',
                message: `Top set a ${topReps} reps (RIR ${topRir.toFixed(1)}). Mantieni e consolida la tecnica.`,
                fatigueAlert: fatigueAlert || undefined
              };
            }
          }
        } 
        // Pesi Liberi / Zavorrati (Doppia Progressione sul Carico)
        else {
          if (!isNaN(topRir)) {
            if (topReps < maxTargetReps && topRir >= upThreshold) {
              return {
                badge: 'increase',
                title: 'Aumenta le Ripetizioni',
                message: `Sul top set (${topWeight}kg) hai fatto ${topReps} reps (Target max: ${maxTargetReps}). Oggi prova a guadagnare 1 ripetizione in più.`,
                fatigueAlert: fatigueAlert || undefined
              };
            } else if (topReps >= maxTargetReps && topRir >= upThreshold) {
              const jump = 2.5; // Incremento standard raccomandato di 2.5kg
              const targetW = topWeight + jump;
              return {
                badge: 'increase',
                title: 'Progressione di Carico (+2.5kg)',
                message: `Range completato (${topReps} reps) con margine (RIR ${topRir.toFixed(1)}). Oggi sali a ${targetW}kg sul primo set!`,
                fatigueAlert: fatigueAlert || undefined
              };
            } else if (topRir <= downThreshold) {
              return {
                badge: 'maintain',
                title: 'Consolida il Carico',
                message: `Eri al limite sul top set (${topWeight}kg, RIR ${topRir.toFixed(1)}). Mantieni il carico per consolidarlo.`,
                fatigueAlert: fatigueAlert || undefined
              };
            } else {
              return {
                badge: 'maintain',
                title: 'Carico Calibrato',
                message: `Ottimo lavoro sul top set (${topWeight}kg). Mantieni i parametri attuali.`,
                fatigueAlert: fatigueAlert || undefined
              };
            }
          }
        }
      }
    }
    return fatigueAlert ? { badge: 'info', title: 'Coach Tendenza', message: fatigueAlert } : null;
  } catch {
    return null;
  }
}

export function getGoalCrossInsight(state: AppState, stats: VolumeStats): string | null {
  try {
    const goal = state.bodyGoal;
    if (!goal || goal === 'recomp') return null;
    const hist = state.bodyMetricsHistory || [];
    if (hist.length < 2) return null;
    const now = new Date();
    const past = hist.find((h) => {
      const d = Math.floor((now.getTime() - new Date(h.date).getTime()) / 86400000);
      return d >= 21 && d <= 42;
    });
    if (!past) return null;
    const cur = hist[0];
    const curFm = parseFloat(String(cur.fm)) || null;
    const pastFm = parseFloat(String(past.fm)) || null;
    const fmDown = curFm !== null && pastFm !== null && pastFm - curFm >= 0.5;
    const curWeight = parseFloat(String(cur.weight)) || 0;
    const pastWeight = parseFloat(String(past.weight)) || 0;
    const curFfm = parseFloat(String(cur.ffm)) || 0;
    const pastFfm = parseFloat(String(past.ffm)) || 0;
    const weightUp = curWeight - pastWeight >= 0.3;
    const ffmUp = curFfm - pastFfm >= 0.3;
    const volumeHigh = stats.hasLastWeek && stats.lastWeek > 0 && stats.week > stats.lastWeek * 1.15;
    if (goal === 'cut' && fmDown && volumeHigh) {
      const pct = Math.round((stats.week / stats.lastWeek - 1) * 100);
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

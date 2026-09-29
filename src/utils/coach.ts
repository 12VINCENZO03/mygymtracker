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

export function calculateAllVolumeStats(volumeLog: Record<string, number>): VolumeStats {
  const d = new Date();
  const todayStr = getTodayStr();
  const stats: VolumeStats = {
    today: volumeLog[todayStr] || 0,
    week: 0,
    lastWeek: 0,
    month: 0,
    lastMonth: 0,
    year: 0,
    lastYear: 0,
    hasLastWeek: false,
    hasLastMonth: false,
    hasLastYear: false
  };

  const currentWeekStart = new Date(d);
  currentWeekStart.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  currentWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(currentWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const currentMonth = d.getMonth();
  const currentYear = d.getFullYear();
  const lastMonthDate = new Date(d);
  lastMonthDate.setMonth(d.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastYear = currentYear - 1;

  for (const [dateStr, vol] of Object.entries(volumeLog)) {
    if (!vol) continue;
    const parts = dateStr.split('-');
    const logDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

    if (logDate >= currentWeekStart) stats.week += vol;
    if (logDate >= lastWeekStart && logDate <= lastWeekEnd) {
      stats.lastWeek += vol;
      stats.hasLastWeek = true;
    }
    if (logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth) stats.month += vol;
    if (logDate.getFullYear() === lastMonthYear && logDate.getMonth() === lastMonth) {
      stats.lastMonth += vol;
      stats.hasLastMonth = true;
    }
    if (logDate.getFullYear() === currentYear) stats.year += vol;
    if (logDate.getFullYear() === lastYear) {
      stats.lastYear += vol;
      stats.hasLastYear = true;
    }
  }

  return stats;
}

export function computeCurrentStreak(workoutDates: string[]): number {
  const dates = new Set(workoutDates || []);
  if (dates.size === 0) return 0;
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!dates.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(fmt(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
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
    const now = new Date();
    const withAge = effHistory
      .map((h) => ({ h, days: Math.floor((now.getTime() - new Date(h.date).getTime()) / 86400000) }))
      .filter((x) => x.days >= 0 && x.days <= 42);
    const refWeight = parseFloat(effHistory[0].weight) || 0;
    if (refWeight <= 0) return null;

    const inBand = withAge.filter((x) => {
      const w = parseFloat(x.h.weight) || 0;
      return w > 0 && Math.abs(w - refWeight) / refWeight <= 0.05;
    });
    if (inBand.length < 4) return null;

    const rirOf = (h: WeightHistoryEntry) => {
      const v = Object.values(h.rirs || {})
        .filter((r) => r !== '' && !isNaN(Number(r)))
        .map(Number);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };

    const recent = inBand.filter((x) => x.days <= 14).map((x) => rirOf(x.h)).filter((v): v is number => v !== null);
    const older = inBand.filter((x) => x.days > 28 && x.days <= 42).map((x) => rirOf(x.h)).filter((v): v is number => v !== null);

    if (recent.length < 2 || older.length < 2) return null;
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

    if (avgOlder - avgRecent >= 1) {
      return 'Tendenza: Il RIR a parità di carico sta peggiorando nelle ultime settimane — possibile fatica accumulata, valuta uno scarico.';
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

export function getExerciseCoachAdvice(
  state: AppState,
  exId: string,
  targetRepsStr: string,
  metricType: MetricType,
  isCircuit = false
): CoachAdvice | null {
  try {
    const isWeightType = metricType === 'weight' || metricType === 'bodyweight' || !metricType;
    const rawHistory = state.weightHistory && state.weightHistory[exId] ? state.weightHistory[exId] : [];
    const deloadDates = state.deloadDates || [];
    const history = isWeightType && deloadDates.length > 0
      ? rawHistory.filter((h) => !deloadDates.includes(h.date))
      : rawHistory;

    if (isWeightType && state.deloadActive) {
      return {
        badge: 'deload',
        title: 'Scarico',
        message: 'Settimana di scarico attiva, nessun aggiustamento di carico.'
      };
    }

    if (!history || history.length === 0) {
      const bm = state.bodyMetrics;
      if (bm && bm.ffm && isWeightType) {
        const ffmVal = parseFloat(String(bm.ffm)) || 0;
        const estMin = Math.round(ffmVal * 0.20 * 2) / 2;
        const estMax = Math.round(ffmVal * 0.25 * 2) / 2;
        return {
          badge: 'info',
          title: 'Stima FFM',
          message: `Stima di partenza molto approssimativa — calibra dopo il primo set in base a come ti senti: ~${estMin}-${estMax}kg (20-25% della FFM, ${bm.ffm}kg).`
        };
      }
      if (metricType === 'bodyweight' && (!bm || !bm.weight)) {
        return {
          badge: 'info',
          title: 'Peso corporeo',
          message: 'Inserisci il peso corporeo nel Profilo BIA per calcolare il volume esatto.'
        };
      }
      return null;
    }

    const lastSession = history[0];
    const fatigueAlert = isWeightType ? getFatigueTrendAlert(history) : null;

    // Check stall across 3 sessions
    if (history.length >= 3 && isWeightType) {
      const w1 = parseFloat(history[0].weight) || 0;
      const w2 = parseFloat(history[1].weight) || 0;
      const w3 = parseFloat(history[2].weight) || 0;
      if (w1 > 0 && w1 === w2 && w2 === w3) {
        const avgReps1 = getAvgReps(history[0]);
        const avgReps3 = getAvgReps(history[2]);
        if (avgReps1 <= avgReps3) {
          return {
            badge: 'stall',
            title: 'Stallo Rilevato',
            message: 'Carico e ripetizioni fermi da 3+ sessioni. Valuta uno scarico o una variazione di stimolo.',
            fatigueAlert: fatigueAlert || undefined
          };
        }
      }
    }

    if (metricType === 'cardio') {
      if (lastSession.rpes) {
        const validRpes = Object.values(lastSession.rpes)
          .map(Number)
          .filter((r) => !isNaN(r));
        if (validRpes.length > 0) {
          const avgRpe = validRpes.reduce((a, b) => a + b, 0) / validRpes.length;
          if (avgRpe <= 5) {
            return {
              badge: 'increase',
              title: 'Sforzo Leggero',
              message: `RPE medio ${avgRpe.toFixed(1)}. Puoi aumentare velocità o inclinazione.`
            };
          } else if (avgRpe <= 7) {
            return {
              badge: 'maintain',
              title: 'Zona Moderata',
              message: `RPE ${avgRpe.toFixed(1)}. Buon equilibrio di lavoro aerobico.`
            };
          } else if (avgRpe <= 9) {
            return {
              badge: 'maintain',
              title: 'Sforzo Intenso',
              message: `RPE ${avgRpe.toFixed(1)}. Sessione impegnativa, mantieni i parametri attuali.`
            };
          } else {
            return {
              badge: 'decrease',
              title: 'Sforzo Massimo',
              message: `RPE ${avgRpe.toFixed(1)}. Vicino al massimale, valuta un recupero più abbondante.`
            };
          }
        }
      }
      return null;
    }

    if (metricType === 'time') {
      if (lastSession.rirs) {
        const validRirs = Object.values(lastSession.rirs)
          .filter((r) => r !== '' && !isNaN(Number(r)))
          .map(Number);
        if (validRirs.length > 0) {
          const rirTarget = isCircuit ? validRirs[0] : validRirs.reduce((a, b) => a + b, 0) / validRirs.length;
          if (rirTarget >= 3) {
            return {
              badge: 'increase',
              title: 'Ampio Margine',
              message: 'Margine elevato (RIR 3+). Prova ad allungare di 10-15s.'
            };
          } else if (rirTarget >= 1.5) {
            return {
              badge: 'increase',
              title: 'Ottimo Margine',
              message: 'Buon controllo: prova ad aggiungere 5-10s al set.'
            };
          } else if (rirTarget > 0) {
            return {
              badge: 'maintain',
              title: 'Tempo Ideale',
              message: 'Tempo calibrato alla perfezione. Mantieni la durata e cura la tecnica.'
            };
          } else {
            return {
              badge: 'decrease',
              title: 'Cedimento Raggiunto',
              message: 'Arrivato a cedimento tecnico: riduci leggermente i secondi per mantenere qualità.'
            };
          }
        }
      }
      return null;
    }

    // Standard weights
    if (isWeightType) {
      const prevWeight = parseFloat(lastSession.weight) || 0;
      const validRirs = Object.values(lastSession.rirs || {})
        .filter((r) => r !== '' && !isNaN(Number(r)))
        .map(Number);
      const validReps = Object.values(lastSession.reps || {})
        .filter((r) => r !== '' && !isNaN(Number(r)))
        .map(Number);
      const targetReps = parseInt(targetRepsStr) || 0;

      if (validRirs.length > 0 && validReps.length > 0) {
        const avgRir = validRirs.reduce((a, b) => a + b, 0) / validRirs.length;
        const hitReps = targetReps === 0 || validReps.every((r) => r >= targetReps);
        
        let upThreshold = 2.0;
        let downThreshold = 0.5;

        if (state.bodyGoal === 'bulk') {
          upThreshold = 1.0;
          downThreshold = 0.5;
        } else if (state.bodyGoal === 'cut') {
          upThreshold = 2.5;
          downThreshold = 0.0;
        }

        // 🔴 NUOVA LOGICA: Corpo Libero Puro (Senza Zavorra)
        if (metricType === 'bodyweight' && prevWeight === 0) {
          const avgReps = validReps.reduce((a, b) => a + b, 0) / validReps.length;

          if (avgRir >= upThreshold && hitReps) {
            if (avgReps >= 12) {
              return {
                badge: 'increase',
                title: 'Pronto per la Zavorra',
                message: `Margine alto e ripetizioni eccellenti (${avgReps.toFixed(0)} reps). È il momento di aggiungere una zavorra leggera (es. 2.5 - 5kg) per progredire in forza.`,
                fatigueAlert: fatigueAlert || undefined
              };
            } else {
              return {
                badge: 'increase',
                title: 'Aumenta le Ripetizioni',
                message: `Scorsa volta reps in riserva alte (RIR ${avgRir.toFixed(1)}). Prova ad aggiungere 1-2 ripetizioni in più in questa sessione.`,
                fatigueAlert: fatigueAlert || undefined
              };
            }
          } else if (avgRir <= downThreshold || !hitReps) {
            const limitText = !hitReps ? 'target ripetizioni non completato' : `cedimento/limite (RIR ${avgRir.toFixed(1)})`;
            return {
              badge: 'maintain',
              title: 'Consolida le Ripetizioni',
              message: `Scorsa sessione ${limitText}. Mantieni le stesse ripetizioni per consolidare la tecnica e la resistenza.`,
              fatigueAlert: fatigueAlert || undefined
            };
          } else {
            return {
              badge: 'maintain',
              title: 'Volume Calibrato',
              message: `Ripetizioni attuali perfette (RIR ${avgRir.toFixed(1)}). Consolida l'esecuzione prima di spingere per chiudere più reps.`,
              fatigueAlert: fatigueAlert || undefined
            };
          }
        } 
        
        // 🔵 LOGICA STANDARD (Pesi o Corpo Libero Zavorrato)
        else {
          if (avgRir >= upThreshold && hitReps) {
            const jump = prevWeight < 20 ? 1 : prevWeight < 50 ? 2.5 : 5;
            const targetW = prevWeight + jump;
            return {
              badge: 'increase',
              title: 'Progressione Consigliata',
              message: `Target chiuso con RIR medio ${avgRir.toFixed(1)}. Oggi puoi salire a ${targetW}kg (+${jump}kg).`,
              fatigueAlert: fatigueAlert || undefined
            };
          } else if (avgRir <= downThreshold || !hitReps) {
            const limitText = !hitReps ? 'target ripetizioni non completato' : `cedimento/limite (RIR ${avgRir.toFixed(1)})`;
            return {
              badge: 'maintain',
              title: state.bodyGoal === 'cut' ? 'Recupera il Target' : 'Consolida il Carico',
              message: `Scorsa sessione ${limitText}. Mantieni ${prevWeight}kg per consolidare il volume.`,
              fatigueAlert: fatigueAlert || undefined
            };
          } else if (state.bodyGoal === 'cut') {
            return {
              badge: 'maintain',
              title: 'Mantenimento in Cut',
              message: `In cut, mantenere la forza a ${prevWeight}kg è un ottimo risultato.`,
              fatigueAlert: fatigueAlert || undefined
            };
          } else {
            return {
              badge: 'maintain',
              title: 'Carico Calibrato',
              message: `Carico attuale adeguato. Consolida ${prevWeight}kg prima di salire ulteriormente.`,
              fatigueAlert: fatigueAlert || undefined
            };
          }
        }
      }
    }

    return fatigueAlert
      ? {
          badge: 'info',
          title: 'Coach Tendenza',
          message: fatigueAlert
        }
      : null;
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
      return `In cut, la massa grassa è in calo ma il volume settimanale è salito del +${pct}%. Rischio sovraccarico: valuta di attivare una settimana di scarico.`;
    }
    if (goal === 'bulk' && weightUp && ffmUp) {
      return `In bulk, peso e massa magra sono in crescita costante rispetto a ${past.date}: continua con questa progressione!`;
    }
    return null;
  } catch {
    return null;
  }
}

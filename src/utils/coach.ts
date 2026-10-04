import { WorkoutSessionV2, CircuitSnapshotV2 } from '../types/v2';
import { AppState, MetricType, WeightHistoryEntry, SupersetExercise } from '../types/gym';
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

export function calculateVolumeFromSessionV2(session: WorkoutSessionV2): number {
  let vol = 0;
  const bw = session.bodyWeightAtSession || 0; // Il peso di quel giorno esatto!
  
  if (!session || !session.blocks || !Array.isArray(session.blocks)) return vol;
  
  for (const block of session.blocks) {
    // Controllo di tipo difensivo
    if (!block || typeof block !== 'object') continue;
    
    if ('rounds' in block && Array.isArray((block as any).rounds)) {
      for (const r of (block as any).rounds) {
        if (!r || !Array.isArray(r.exercises)) continue;
        for (const sub of r.exercises) {
          if (!sub || !Array.isArray(sub.sets)) continue;
          for (const set of sub.sets) {
            const reps = set.reps || 0;
            const w = set.weight || 0;
            const type = (sub.type || 'weight');
            
            if (type === 'weight' || !type) {
              vol += reps * w;
            } else if (type === 'bodyweight') {
              vol += reps * (bw + w); 
            } else if (type === 'cardio') {
              const durationMin = (set.durationSec || 0) / 60;
              const rpe = set.rpe || 5; 
              vol += Math.round(durationMin * rpe * 10);
            } else if (type === 'time') {
              const durationMin = (set.durationSec || 0) / 60;
              vol += Math.round(durationMin * 100);
            }
          }
        }
      }
    } else {
      const exBlock = block as any;
      if (!Array.isArray(exBlock.sets)) continue;
      for (const set of exBlock.sets) {
        const reps = set.reps || 0;
        const w = set.weight || 0;
        const type = (exBlock.type || 'weight');
        
        if (type === 'weight' || !type) {
          vol += reps * w;
        } else if (type === 'bodyweight') {
          vol += reps * (bw + w); 
        } else if (type === 'cardio') {
          const durationMin = (set.durationSec || 0) / 60;
          const rpe = set.rpe || 5; 
          vol += Math.round(durationMin * rpe * 10);
        } else if (type === 'time') {
          const durationMin = (set.durationSec || 0) / 60;
          vol += Math.round(durationMin * 100);
        }
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
        message: 'DIAGNOSI: Scarico sistemico attivo. AZIONE: Riduci il volume del 30-40% e mantieni un margine elevato (RIR 3-4). Nessuna progressione oggi.'
      };
    }

    if (!history || history.length === 0) {
      const bm = state.bodyMetrics;
      if (bm && bm.ffm && isWeightType) {
        return {
          badge: 'info',
          title: 'Prima Sessione',
          message: `DIAGNOSI: Nessuno storico presente per calibrare. AZIONE: Esegui il primo set ed esplora il carico in base alle sensazioni odierne.`
        };
      }
      return null;
    }

    const lastSession = history[0];
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
            message: 'Carico e volume stabili, ma la tua tolleranza allo sforzo è migliorata. Il peso pesa meno. Consolida o preparati a salire.'
          };
        }

        // Stallo Reale: scatta SE avgRirRecent <= avgRirOld (nessun miglioramento di reps E fatica uguale o peggiore)
        if (avgRirRecent === null || avgRirOld === null || avgRirRecent <= avgRirOld) {
          return {
            badge: 'stall',
            title: 'Segnale di Stallo Rilevato',
            message: `DIAGNOSI: 3 esposizioni con ${w1}kg senza miglioramento di volume medio. AZIONE: Non forzare il carico. Valuta un back-off (riduci 10%) o aumenta le pause di 30s per smaltire fatica.`,
            fatigueAlert: fatigueAlert || undefined
          };
        }
      }
    }

    // Cardio: Analisi Multi-variabile avanzata e zone RPE
    if (metricType === 'cardio') {
      const curSession = history[0];
      const curAvgRpe = getAvgRpe(curSession);

      if (history.length >= 2) {
        const prevSession = history[1];
        const prevAvgRpe = getAvgRpe(prevSession);

        const positiveMetricKeys = ['distanza', 'distance', 'velocita', 'velocità', 'speed', 'inclinazione', 'incline', 'resistenza', 'resistance'];
        
        let improvedCond = false;
        let improvedEff = false;
        let diffDetail = '';

        for (const key of positiveMetricKeys) {
          const curVal = getAvgCustomField(curSession, key);
          const prevVal = getAvgCustomField(prevSession, key);
          if (curVal !== null && prevVal !== null && prevVal > 0) {
            const diffPct = ((curVal - prevVal) / prevVal) * 100;
            if (diffPct >= 2 && curAvgRpe !== null && prevAvgRpe !== null && curAvgRpe <= prevAvgRpe) {
              improvedCond = true;
              diffDetail = `${key} salita da ${prevVal.toFixed(1)} a ${curVal.toFixed(1)} (+${diffPct.toFixed(1)}%) con RPE stabile (${curAvgRpe.toFixed(1)} vs ${prevAvgRpe.toFixed(1)})`;
              break;
            }
            if (diffPct >= -1 && curAvgRpe !== null && prevAvgRpe !== null && (prevAvgRpe - curAvgRpe) >= 0.5) {
              improvedEff = true;
              diffDetail = `${key} mantenuta a ${curVal.toFixed(1)} ma con RPE sceso da ${prevAvgRpe.toFixed(1)} a ${curAvgRpe.toFixed(1)}`;
              break;
            }
          }
        }

        if (!improvedCond && !improvedEff) {
          const curPasso = getAvgCustomField(curSession, 'passo');
          const prevPasso = getAvgCustomField(prevSession, 'passo');
          if (curPasso !== null && prevPasso !== null && prevPasso > 0) {
            if (curPasso < prevPasso && curAvgRpe !== null && prevAvgRpe !== null && curAvgRpe <= prevAvgRpe) {
              improvedCond = true;
              diffDetail = `passo migliorato da ${prevPasso.toFixed(1)} a ${curPasso.toFixed(1)} con RPE ${curAvgRpe.toFixed(1)}`;
            } else if (curPasso <= prevPasso && curAvgRpe !== null && prevAvgRpe !== null && (prevAvgRpe - curAvgRpe) >= 0.5) {
              improvedEff = true;
              diffDetail = `passo invariato a ${curPasso.toFixed(1)} con sforzo RPE calato da ${prevAvgRpe.toFixed(1)} a ${curAvgRpe.toFixed(1)}`;
            }
          }
        }

        if (improvedCond) {
          return {
            badge: 'increase',
            title: 'Miglioramento Condizionamento',
            message: `DIAGNOSI: ${diffDetail}. AZIONE: Capacità di lavoro cardiovascolare incrementata. Puoi consolidare o alzare ulteriormente il ritmo.`
          };
        }

        if (improvedEff) {
          return {
            badge: 'increase',
            title: 'Maggiore Efficienza Aerobica',
            message: `DIAGNOSI: ${diffDetail}. AZIONE: Il sistema cardiovascolare lavora con maggiore facilità allo stesso output. Ottimo adattamento aerobico!`
          };
        }
      }

      // Fallback: logiche attuali basate sulle zone RPE
      if (curAvgRpe !== null) {
        if (curAvgRpe <= 3) {
          return {
            badge: 'increase',
            title: 'Sforzo Blando',
            message: `DIAGNOSI: RPE medio ${curAvgRpe.toFixed(1)} <= 3. AZIONE: Sforzo troppo blando, puoi aumentare l'inclinazione, la velocità, la resistenza o il passo.`
          };
        } else if (curAvgRpe <= 6) {
          return {
            badge: 'maintain',
            title: 'Base Aerobica (Zone 2)',
            message: 'Sforzo ottimale per LISS e recupero attivo. Non aumentare intensità se il target non è anaerobico.'
          };
        } else if (curAvgRpe <= 7) {
          return {
            badge: 'maintain',
            title: 'Zona Moderata',
            message: `DIAGNOSI: RPE ${curAvgRpe.toFixed(1)}. AZIONE: Ottimo equilibrio aerobico, mantieni i parametri attuali.`
          };
        } else {
          return {
            badge: 'maintain',
            title: 'Sforzo Intenso',
            message: `DIAGNOSI: RPE ${curAvgRpe.toFixed(1)}. AZIONE: Sessione spinta al limite, consolida questo livello senza aumentare.`
          };
        }
      }

      return null;
    }

    if (metricType === 'time') {
      if (history.length >= 2) {
        const curAvgDur = getAvgDuration(history[0]);
        const prevAvgDur = getAvgDuration(history[1]);
        const avgRir = getAvgRir(history[0]);

        if (curAvgDur > prevAvgDur && curAvgDur > 0) {
          const gain = Math.round(curAvgDur - prevAvgDur);
          return {
            badge: 'increase',
            title: 'Progressione TUT',
            message: `DIAGNOSI: Durata media aumentata da ${Math.round(prevAvgDur)}s a ${Math.round(curAvgDur)}s (+${gain}s). AZIONE: Eccellente progresso nel Time Under Tension. Consolida la tenuta isometrica prima di allungare ulteriormente.`
          };
        } else {
          if (avgRir !== null && avgRir <= 1) {
            return {
              badge: 'maintain',
              title: 'Insufficienza Work Capacity',
              message: `DIAGNOSI: Durata media (${Math.round(curAvgDur)}s) non superiore alla precedente (${Math.round(prevAvgDur)}s) con RIR tirato al limite (${avgRir.toFixed(1)}). AZIONE: Non forzare la durata; mantieni il tempo attuale curando la respirazione e la stabilità posturale.`
            };
          } else {
            return {
              badge: 'maintain',
              title: 'Consolidamento Isometria',
              message: `DIAGNOSI: Durata media stabile (${Math.round(curAvgDur)}s vs ${Math.round(prevAvgDur)}s). AZIONE: Consolida la tenuta e mantieni la massima tensione corporea costante.`
            };
          }
        }
      }
      return {
        badge: 'info',
        title: 'Focus Isometria',
        message: 'DIAGNOSI: Lavoro a tempo. AZIONE: Cura la respirazione diaframmatica e mantieni la massima tensione corporea costante.'
      };
    }

    // --- COACH 2.0: MULTI-SET & FATIGUE ANALYSIS ---
    if (isWeightType) {
      const validSetKeys = Object.keys(lastSession.reps || {}).filter((k) => lastSession.reps[k] !== '');

      if (validSetKeys.length > 0) {
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

        // Se mancano dati RIR (vecchi workout), ci fermiamo al feedback di tendenza generale
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

        // Analisi di drop-off e media fatica
        const topSets = setsData.filter(s => s.w === maxW);
        const bestTopSet = topSets.reduce((prev, curr) => (prev.reps > curr.reps) ? prev : curr);
        const minRepsInTopSets = Math.min(...topSets.map(s => s.reps)); // Calcola il crollo prestazionale sul carico
        const avgRir = setsData.reduce((acc, curr) => acc + curr.rir, 0) / setsData.length;

        // Recupero incrementi intelligenti dal Registro (Fallback 2.5 per bilancieri non classificati, 1.0 corpo libero)
        const exDef = (permanentExId && state.registryV2?.[permanentExId]) ? state.registryV2[permanentExId] : null;
        const jump = exDef?.progressionIncrement ?? (metricType === 'bodyweight' ? 1.0 : 2.5);

        let upThreshold = 1.5;
        if (state.bodyGoal === 'bulk') { upThreshold = 1.0; }
        else if (state.bodyGoal === 'cut') { upThreshold = 2.0; }

        const diagContext = `DIAGNOSI: Top set ${bestTopSet.reps}x${maxW > 0 ? maxW : 'BW'}${maxW > 0 ? 'kg' : ''} (RIR ${bestTopSet.rir}). RIR Medio: ${avgRir.toFixed(1)}. Serie peggiore al carico: ${minRepsInTopSets} reps.`;

        // 3. INTEGRAZIONE MODELLI DI PROGRESSIONE (exDef: isolamento o TUT)
        const isIsolationOrTut = exDef && (
          exDef.progressionModel === 'time_under_tension' ||
          (typeof exDef.movementPattern === 'string' && exDef.movementPattern.includes('isolation'))
        );

        if (isIsolationOrTut) {
          if (minRepsInTopSets >= (minTarget - 1) && avgRir >= 1.5) {
            return {
              badge: 'increase',
              title: 'Overload Isolamento Sbloccato',
              message: `${diagContext} AZIONE: Drop-off fisiologico controllato (minimo ${minRepsInTopSets} reps, tollerata max 1 rep sotto il target ${minTarget}) e margine solido (RIR medio ${avgRir.toFixed(1)} >= 1.5). Puoi salire di carico a ${maxW + jump}kg.`
            };
          } else {
            return {
              badge: 'maintain',
              title: 'Consolidamento Isolamento',
              message: `${diagContext} AZIONE: Sugli esercizi di isolamento è tollerato un drop-off massimo di 1 rep sotto il target (${minTarget - 1} reps) con RIR medio >= 1.5 prima di salire di peso. Consolida a ${maxW > 0 ? maxW + 'kg' : 'BW'}.`
            };
          }
        }

        // 1. CORPO LIBERO PURO
        if (metricType === 'bodyweight' && maxW === 0) {
          if (bestTopSet.reps < maxTarget) {
            return {
              badge: 'increase',
              title: 'Costruzione Volume',
              message: `${diagContext} AZIONE: Non hai ancora saturato il target alto (${maxTarget}). Spingi per guadagnare ripetizioni totali.`
            };
          } else {
            if (avgRir < upThreshold) {
              return {
                badge: 'maintain',
                title: 'Range Raggiunto (Consolida)',
                message: `${diagContext} AZIONE: Dominio numerico completato, ma il margine sistemico è basso. Consolida la pulizia tecnica prima di zavorrare.`
              };
            } else {
              return {
                badge: 'increase',
                title: 'Pronto per Zavorra',
                message: `${diagContext} AZIONE: Pieno controllo tecnico. È il momento di inserire una zavorra modulare minima (registra il primo carico sostenibile).`
              };
            }
          }
        }

        // 2. PESI (ZAVORRE / BILANCIERI / MACCHINE)
        else {
          if (bestTopSet.reps < maxTarget) {
            return {
              badge: 'maintain',
              title: 'Progressione Volume',
              message: `${diagContext} AZIONE: Mantieni ${maxW}kg. Prova ad aggiungere 1 ripetizione nel primo set senza crollare nei successivi.`
            };
          } else {
            // Target raggiunto sul Top Set. Applichiamo la lente d'ingrandimento sul drop-off
            const repDropOff = bestTopSet.reps - minRepsInTopSets;

            if (repDropOff > 2) {
              return {
                badge: 'maintain',
                title: 'Stabilità Inadeguata',
                message: `${diagContext} AZIONE: Crollo prestazionale eccessivo tra le serie (drop-off di ${repDropOff} reps). Uniforma le ripetizioni su tutte le serie prima di salire di carico a causa dell'eccessiva perdita di stabilità.`
              };
            }

            if (minRepsInTopSets < minTarget) {
              return {
                badge: 'maintain',
                title: 'Carenza Work Capacity',
                message: `${diagContext} AZIONE: Manca stamina a questo carico. Il drop-off è troppo ripido. Lavora per tenere almeno ${minTarget} reps in tutte le serie prima di salire.`
              };
            } else if (avgRir >= upThreshold && bestTopSet.rir >= upThreshold) {
              return {
                badge: 'increase',
                title: 'Overload Sbloccato',
                message: `${diagContext} AZIONE: Nessun crollo prestazionale e margine solido. Sali a ${maxW + jump}kg nel primo set odierno.`
              };
            } else {
              return {
                badge: 'maintain',
                title: 'Carico Saturato (RIR Limite)',
                message: `${diagContext} AZIONE: Ottimo volume a ${maxW}kg, ma il margine di sforzo sulle serie non consente ancora aumenti sicuri. Consolida.`
              };
            }
          }
        }
      }
    }

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

    // --- MOTORE AMRAP (Work Capacity & Pacing) ---
    if (type === 'amrap') {
      const curRounds = lastCirc.rounds?.length || 0;
      if (!prevCirc) {
        return { badge: 'info', title: 'Baseline AMRAP', message: `DIAGNOSI: Primo riferimento registrato (${curRounds} giri). AZIONE: Usa questo volume come target da battere al prossimo allenamento gestendo bene il pacing iniziale.` };
      }
      const prevRounds = prevCirc.rounds?.length || 0;
      if (curRounds > prevRounds) {
        return { badge: 'increase', title: 'Work Capacity Migliorata', message: `DIAGNOSI: Chiusi ${curRounds} giri contro i ${prevRounds} della volta scorsa. AZIONE: Ottima gestione dell'acido lattico e del pacing! Consolida o prova a forzare una rep in più a giro.` };
      } else if (curRounds < prevRounds) {
        return { badge: 'decrease', title: 'Calo di Pacing', message: `DIAGNOSI: Chiusi ${curRounds} giri (erano ${prevRounds}). AZIONE: Probabile partenza troppo esplosiva o fatica sistemica. Rallenta il ritmo nei primi 3 minuti per non crollare nel finale.` };
      } else {
        return { badge: 'maintain', title: 'Pacing Costante', message: `DIAGNOSI: Volume invariato (${curRounds} giri). AZIONE: Pacing consolidato. Per sbloccare la progressione prova a ridurre le micro-pause tra le transizioni degli esercizi.` };
      }
    }

    // --- MOTORE EMOM (Metabolic Failure & Densità) ---
    if (type === 'emom') {
      const curRounds = lastCirc.rounds?.length || 0;
      const targetRounds = circuit.emomTotalMin && circuit.emomIntervalSec ? Math.ceil((circuit.emomTotalMin * 60) / circuit.emomIntervalSec) : curRounds;
      
      if (curRounds < targetRounds) {
        return { badge: 'decrease', title: 'Cedimento Metabolico', message: `DIAGNOSI: Chiusi ${curRounds} intervalli su ${targetRounds}. Il tempo di lavoro ha eroso il recupero. AZIONE: Scala i carichi o riduci le reps del 10% per riuscire a stare dentro il minuto senza bruciarti.` };
      } else {
        return { badge: 'increase', title: 'Densità Dominata', message: `DIAGNOSI: Completati tutti i ${targetRounds} intervalli. AZIONE: Hai dominato la densità. Al prossimo workout aggiungi 1 minuto totale al timer o aumenta un micro-carico.` };
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

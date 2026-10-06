import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppState,
  BodyGoal,
  SingleExercise,
  SupersetExercise,
  PersistentMasterTimer,
  BodyMetricHistoryEntry
} from './types/gym';
import {
  WorkoutSessionV2,
  BlockSnapshotV2,
  CircuitRoundV2,
  ExerciseSnapshotV2,
  WorkoutSetV2,
  ExerciseTypeV2
} from './types/v2';
import {
  loadGymState,
  saveGymState,
  createSafetyBackup,
  getTodayStr,
  generateId,
  exportBackupString,
  importBackupString,
  TIME_VOLUME_DIVISOR,
  onExternalTabUpdate
} from './utils/storage';
import { playTrumpet, playShortBeep, initAudio } from './utils/audio';
import { extractBiaFromPdf, ExtractedBiaData } from './utils/pdfExtractor';
import { computeStreakFromSessions } from './utils/domain';
import { safeSetInterval, safeClearInterval } from './utils/workerTimer';
import { validateSetData } from './utils/validation';

import { Header } from './components/Header';
import { SideMenu } from './components/SideMenu';
import { HomeDashboard } from './components/HomeDashboard';
import { ExerciseCard } from './components/ExerciseCard';
import { CircuitCard } from './components/CircuitCard';
import { EffortModal } from './components/EffortModal';
import { SummaryModal } from './components/SummaryModal';
import { RepsModal } from './components/RepsModal';
import { BiaModal } from './components/BiaModal';
import { PRModal } from './components/PRModal';
import { SyncModal } from './components/SyncModal';
import { HistoryModal } from './components/HistoryModal';
import { VideoModal } from './components/VideoModal';

const sanitizeNumericInput = (val: string | number): string => {
  if (val === undefined || val === null) return '';
  
  // 1. Sostituisce la virgola col punto e rimuove TUTTO ciò che non è numero, punto o meno
  let cleaned = String(val).replace(',', '.').replace(/[^0-9.\-]/g, '');
  
  // 2. Se è vuoto o c'è solo un punto/trattino, restituisce stringa vuota
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return '';
  
  // 3. Converte in numero
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) ? parsed.toString() : '';
};

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null); // 🔴 NUOVO: Riferimento silenzioso per la memoria
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Effort modal (RIR / RPE)
  const [effortTarget, setEffortTarget] = useState<{ setId: string; isRpe: boolean } | null>(null);

  // BIA modal
  const [biaModalData, setBiaModalData] = useState<ExtractedBiaData | null>(null);

  // Summary post-workout modal
  const [summaryData, setSummaryData] = useState<{
    newSnapshot: WorkoutSessionV2;
    prevSnapshot: WorkoutSessionV2 | null;
  } | null>(null);

  // Reps modal
  const [repsModalTarget, setRepsModalTarget] = useState<{
    exId: string;
    setIndex: number;
    pauseSec: number;
    prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, string> };
    circuitId?: string;
    initialReps: number;
    exerciseName?: string;
  } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Rest Timer Bubble
  const [restTimerSeconds, setRestTimerSeconds] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const restTimerCallbackRef = useRef<(() => void) | null>(null);
  const restTimerIntervalRef = useRef<number | null>(null);

  // Inline Timers (for time-based exercises like plank)
  const [inlineTimerCountdown, setInlineTimerCountdown] = useState<Record<string, number>>({});
  const inlineTimerIntervalsRef = useRef<Record<string, number>>({});

  // Master Timers (for EMOM / AMRAP)
  const [activeMasterTimer, setActiveMasterTimer] = useState<{
    circuitId: string;
    type: 'emom' | 'amrap';
    remainingSec: number;
    intervalSec?: number;
    activeEmomRound?: number;
    totalRounds?: number;
    pacingSec?: number;
  } | null>(null);
  const masterTimerIntervalRef = useRef<number | null>(null);

  // Live Workout duration
  const [workoutLiveSec, setWorkoutLiveSec] = useState(0);

  // Wake Lock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // 🔴 FASE 2: Blocco Anti-Spam Salvataggio
  const [isSaving, setIsSaving] = useState(false);

  const showToast = useCallback((msg: string, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === msg ? null : prev));
    }, 3500);
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        if (wakeLockRef.current) return; // Se è già attivo, non fare nulla
        
        const lock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = lock;
        
        // BUG FIX iOS: Ascoltiamo quando Apple killa il blocco per poterlo riattivare
        lock.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (e) {
      console.warn('Wake Lock disattivato da iOS:', e);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadGymState().then((loaded) => {
      setState(loaded);
    });
  }, []);

  // 🔴 CONCORRENZA MULTI-TAB: Ascolto aggiornamenti salvati da altri tab
  useEffect(() => {
    const unsubscribe = onExternalTabUpdate(({ revision }) => {
      loadGymState().then((loaded) => {
        if (loaded && loaded.revision > (stateRef.current?.revision || 0)) {
          const isWorkingOut = stateRef.current && Object.values(stateRef.current.activeWorkouts || {}).some(w => w.active);
          if (isWorkingOut) {
            showToast('Aggiornamento rilevato da un’altra scheda (preservato il workout attivo in corso).', true);
            return;
          }
          setState(loaded);
          showToast('Dati sincronizzati da un’altra scheda.');
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!state) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveGymState(state);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state]);

  const handleSelectTab = useCallback((tabId: string) => {
    setState((prev) => {
      if (!prev) return null;
      const next = { ...prev, activeTab: tabId };
      return next;
    });
  }, []);

  const handleSaveWeight = useCallback((id: string, val: string | number) => {
    const cleanVal = sanitizeNumericInput(val);
    setState((prev) => {
      if (!prev) return null;
      if (prev.weights[id] === cleanVal) return prev;
      const nextState = { ...prev, weights: { ...prev.weights, [id]: cleanVal } };
      saveGymState(nextState).catch(console.warn);
      return nextState;
    });
  }, []);

  const handleSaveSetWeight = useCallback((setId: string, val: string | number) => {
    const cleanVal = sanitizeNumericInput(val);
    setState((prev) => {
      if (!prev) return null;
      if (prev.setWeights[setId] === cleanVal) return prev;
      const nextState = { ...prev, setWeights: { ...prev.setWeights, [setId]: cleanVal } };
      saveGymState(nextState).catch(console.warn);
      return nextState;
    });
  }, []);

  // 🔴 NUOVO: Salvataggio campi cardio avanzati (Velocità, Inclinazione, ecc.)
  const handleSaveCustomField = useCallback((setId: string, fieldId: string, val: string) => {
    setState((prev) => {
      if (!prev) return null;
      const allFields = prev.setCustomFields || {};
      const currentFields = allFields[setId] || {};
      const nextState = { ...prev, setCustomFields: { ...allFields, [setId]: { ...currentFields, [fieldId]: val } } };
      saveGymState(nextState).catch(console.warn);
      return nextState;
    });
  }, []);


  // 🔴 1. Mantiene stateRef sempre sincronizzato in modo silenzioso
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 2. Gestisce gli eventi di sistema e il riarmo del Wake Lock
  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        const isWorkingOut = stateRef.current && Object.values(stateRef.current.activeWorkouts || {}).some(w => w.active);
        if (isWorkingOut && !wakeLockRef.current) requestWakeLock();
      } else if (document.visibilityState === 'hidden' && stateRef.current) {
        saveGymState(stateRef.current);
      }
    };

    const handlePageHide = () => {
      if (stateRef.current) saveGymState(stateRef.current);
    };

    // Riarmo furtivo: qualsiasi tocco sullo schermo durante il workout riattiva il blocco se iOS lo ha fatto cadere
    const handleTouch = () => {
      const isWorkingOut = stateRef.current && Object.values(stateRef.current.activeWorkouts || {}).some(w => w.active);
      if (isWorkingOut && !wakeLockRef.current) requestWakeLock();
    };

    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('pagehide', handlePageHide);
    // passive: true ottimizza le performance di scorrimento dello schermo su iOS
    document.addEventListener('touchstart', handleTouch, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('touchstart', handleTouch);
    };
  }, [requestWakeLock]);

  const activeTabId = state?.activeTab || 'home';
  const currentWorkout = state?.activeWorkouts[activeTabId];
  const isWorkoutActive = Boolean(currentWorkout?.active);

  useEffect(() => {
    if (!isWorkoutActive || !currentWorkout?.startTime) {
      setWorkoutLiveSec(0);
      return;
    }
    const updateTimer = () => {
      const diff = Math.floor((Date.now() - (currentWorkout.startTime || Date.now())) / 1000);
      setWorkoutLiveSec(diff >= 0 ? diff : 0);
    };
    updateTimer();
    const intv = safeSetInterval(updateTimer, 1000);
    return () => safeClearInterval(intv);
  }, [isWorkoutActive, currentWorkout?.startTime]);

  const skipRestTimer = useCallback(() => {
    if (restTimerIntervalRef.current) {
      safeClearInterval(restTimerIntervalRef.current);
      restTimerIntervalRef.current = null;
    }
    setIsRestTimerActive(false);
    setRestTimerSeconds(0);
    if (restTimerCallbackRef.current) {
      const cb = restTimerCallbackRef.current;
      restTimerCallbackRef.current = null;
      cb();
    }
  }, []);

  const startRestTimer = useCallback(
    (seconds: number, onFinished?: () => void) => {
      if (restTimerIntervalRef.current) {
        safeClearInterval(restTimerIntervalRef.current);
      }
      const dur = seconds > 0 ? seconds : 90;
      setRestTimerSeconds(dur);
      setIsRestTimerActive(true);
      restTimerCallbackRef.current = onFinished || null;
      const endTime = Date.now() + dur * 1000;
      restTimerIntervalRef.current = safeSetInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        if (remaining <= 0) {
          if (restTimerIntervalRef.current) safeClearInterval(restTimerIntervalRef.current);
          restTimerIntervalRef.current = null;
          setIsRestTimerActive(false);
          setRestTimerSeconds(0);
          playTrumpet();
          if (restTimerCallbackRef.current) {
            const cb = restTimerCallbackRef.current;
            restTimerCallbackRef.current = null;
            cb();
          }
        } else {
          setRestTimerSeconds(remaining);
        }
      }, 250);
    },
    []
  );

  // 🔴 FASE 1: Garbage Collector (Dati Orfani)
  const cleanupOrphanDataForId = (nextState: AppState, targetId: string) => {
    delete nextState.weights[targetId];

    const cleanRecord = (record: Record<string, unknown>) => {
      Object.keys(record).forEach((key) => {
        if (key.startsWith(`${targetId}-`)) {
          delete record[key];
        }
      });
    };

    cleanRecord(nextState.checkedSets);
    cleanRecord(nextState.setWeights);
    cleanRecord(nextState.setReps);
    cleanRecord(nextState.setRir);
    cleanRecord(nextState.setDurations);
    cleanRecord(nextState.setRpe);
    cleanRecord(nextState.setCustomFields);
    if (nextState.activeInlineTimers) {
      cleanRecord(nextState.activeInlineTimers);
    }

    setInlineTimerCountdown((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((k) => {
        if (k.startsWith(`${targetId}-`)) {
          if (inlineTimerIntervalsRef.current[k]) {
            safeClearInterval(inlineTimerIntervalsRef.current[k]);
            delete inlineTimerIntervalsRef.current[k];
          }
          delete updated[k];
        }
      });
      return updated;
    });
  };

  const cleanupCircuitOrphanData = (nextState: AppState, circuit: SupersetExercise) => {
    delete nextState.amrapState[circuit.id];
    Object.keys(nextState.checkedSets).forEach((key) => {
      if (key.startsWith(`${circuit.id}-round-`)) {
        delete nextState.checkedSets[key];
      }
    });
    circuit.exercises.forEach((sub) => {
      cleanupOrphanDataForId(nextState, sub.id);
    });
    
    // FASE 2: Pulizia Timer Fantasma dalla persistenza
    if (nextState.activeMasterTimer?.circuitId === circuit.id) {
      nextState.activeMasterTimer = null;
      // Il cleanup dell'intervallo verrà gestito in automatico dal useEffect
    }
  };

  const handleStartWorkout = async (tabId: string) => {
    if (!state) return;
    initAudio();
    const todayStr = getTodayStr();
    const newState = { ...state };

    const tab = newState.plan.find((t) => t.id === tabId);

    // Funzione centralizzata per azzerare i dati della sessione
    const clearSessionData = () => {
      tab?.exercises.forEach((ex) => {
        if (ex.type === 'single') {
          for (let i = 0; i < ex.sets; i++) {
            delete newState.checkedSets[`${ex.id}-${i}`];
            delete newState.setReps[`${ex.id}-${i}`];
            delete newState.setRir[`${ex.id}-${i}`];
            delete newState.setRpe[`${ex.id}-${i}`];
          }
        } else if (ex.type === 'superset') {
          delete newState.amrapState[ex.id];
          for (let j = 0; j < 50; j++) {
            delete newState.checkedSets[`${ex.id}-round-${j}`];
            ex.exercises.forEach((sub) => {
              delete newState.checkedSets[`${sub.id}-${j}`];
              delete newState.setReps[`${sub.id}-${j}`];
              delete newState.setRir[`${sub.id}-${j}`];
              delete newState.setRpe[`${sub.id}-${j}`];
            });
          }
        }
      });
      if (masterTimerIntervalRef.current) {
        safeClearInterval(masterTimerIntervalRef.current);
        masterTimerIntervalRef.current = null;
      }
      setActiveMasterTimer(null);
      newState.activeMasterTimer = null;
    };

    const workoutAlreadyActive = Boolean(newState.activeWorkouts[tabId]?.active);
    const hasSessionToday = (newState.sessionsV2 || []).some(s => s.planId === tabId && s.date === todayStr);

    if (workoutAlreadyActive || hasSessionToday) {
      const conf = window.confirm(
        workoutAlreadyActive
          ? 'Hai già un allenamento in corso su questa scheda. Vuoi azzerare i set per ricominciare da capo?'
          : 'Hai già una sessione registrata oggi per questa scheda. Vuoi azzerare i set per iniziarne una nuova?'
      );
      if (conf) {
        clearSessionData();
      } else {
        return;
      }
    } else {
      // È un giorno diverso e non ci sono allenamenti attivi: azzeriamo tutto
      clearSessionData();
    }

    newState.activeWorkouts[tabId] = { active: true, startTime: Date.now() };
    await requestWakeLock();
    setState(newState);
    await saveGymState(newState);
    showToast('Allenamento iniziato! 🔥');
  };

  // 🔴 FASE 2: Debounce/Lock con Try-Finally
  const handleStopWorkout = async (tabId: string) => {
    if (!window.confirm('Vuoi davvero terminare questo allenamento?')) return;
    if (!state || isSaving) return;
    
    setIsSaving(true);
    try {
      const currentTab = state.plan.find((t) => t.id === tabId);
      if (!currentTab) return;
      skipRestTimer();
      releaseWakeLock();
      if (masterTimerIntervalRef.current) {
        safeClearInterval(masterTimerIntervalRef.current);
        masterTimerIntervalRef.current = null;
      }
      setActiveMasterTimer(null);

      const workoutState = state.activeWorkouts[tabId] || { startTime: Date.now() };
      const diff = Date.now() - (workoutState.startTime || Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const durationStr = `${h > 0 ? `${h}h ` : ''}${m}m`;
      const todayDateStr = getTodayStr();

      let hasCheckedSets = false;
      let totalSets = 0;
      const v2Blocks: BlockSnapshotV2[] = [];

      // CLONE PROFONDO DI DIZIONARI E ARRAY
      const nextActiveWorkouts = { ...state.activeWorkouts, [tabId]: { active: false, startTime: null } };
      const nextRegistry = { ...(state.registryV2 || {}) };
      const nextSessionsV2 = [...(state.sessionsV2 || [])];
      const nextPrs = [...(state.prs || [])];

      const getOrRegisterEx = (name: string, type: any): string => {
        let regId = Object.keys(nextRegistry).find(
          (k) => nextRegistry[k].name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (!regId) {
          regId = generateId();
          nextRegistry[regId] = { id: regId, name: name.trim(), type: type || 'weight' };
        }
        return regId;
      };

      currentTab.exercises.forEach((ex) => {
        if (ex.type === 'single') {
          const completedSets: WorkoutSetV2[] = [];
          for (let i = 0; i < ex.sets; i++) {
            const setId = `${ex.id}-${i}`;
            if (state.checkedSets[setId]) {
              hasCheckedSets = true;
              totalSets++;
              const rawWeight = state.setWeights[setId] ?? state.weights[ex.id];
              const rawReps = state.setReps[setId] || ex.reps;
              const rawDuration = state.setDurations[setId] || state.setReps[setId] || ex.workSec || 60;
              const rawRir = state.setRir[setId];
              const rawRpe = state.setRpe[setId];
              const validData = validateSetData(
                parseInt(String(rawReps)) || undefined,
                parseFloat(String(rawWeight)) || undefined,
                parseFloat(String(rawDuration)) || undefined,
                rawRir === '' || rawRir == null || rawRir === '-1' || rawRir === 'CED' ? undefined : parseFloat(String(rawRir)),
                parseFloat(String(rawRpe)) || undefined
              );
              completedSets.push({
                id: generateId(),
                index: i + 1,
                ...validData,
                isCed: rawRir === '-1' || rawRir === 'CED',
                customFields: state.setCustomFields?.[`${ex.name}-${i + 1}`] || state.setCustomFields?.[setId] || undefined
              });
            }
          }
          if (completedSets.length > 0) {
            const regId = ex.exerciseId || getOrRegisterEx(ex.name, ex.metricType);
            v2Blocks.push({
              exerciseId: regId,
              nameSnapshot: ex.name,
              type: ex.metricType || 'weight',
              sets: completedSets
            });
          }
        } else if (ex.type === 'superset') {
          let roundsToCount = ex.rounds || 0;
          if (ex.structureType === 'emom') {
            roundsToCount = Math.ceil(((ex.emomTotalMin || 1) * 60) / (ex.emomIntervalSec || 60));
          }
          if (ex.structureType === 'amrap') {
            roundsToCount = state.amrapState?.[ex.id]?.completedRounds ?? 0;
          }
          const completedRounds: CircuitRoundV2[] = [];
          const maxRounds = ex.structureType === 'amrap' ? 50 : (roundsToCount || 10);
          for (let j = 0; j < maxRounds; j++) {
            const isMasterRoundDone = Boolean(state.checkedSets[`${ex.id}-round-${j}`]) || (ex.structureType === 'amrap' && j < roundsToCount);
            const roundExs: ExerciseSnapshotV2[] = [];

            for (const sub of ex.exercises) {
              if (sub.metricType === 'rest') continue;
              const setId = `${sub.id}-${j}`;
              const isSubDone = Boolean(state.checkedSets[setId]) || isMasterRoundDone;
              if (!isSubDone) continue;

              const regId = sub.exerciseId || getOrRegisterEx(sub.name, sub.metricType);
              const rawWeight = state.setWeights[setId] ?? state.weights[sub.id];
              const rawReps = state.setReps[setId] || sub.reps;
              const rawDuration = state.setDurations[setId] || state.setReps[setId] || sub.workSec || 60;
              const rawRir = state.setRir[setId];
              const rawRpe = state.setRpe[setId];
              const validData = validateSetData(
                parseInt(String(rawReps)) || undefined,
                parseFloat(String(rawWeight)) || undefined,
                parseFloat(String(rawDuration)) || undefined,
                rawRir === '' || rawRir == null || rawRir === '-1' || rawRir === 'CED' ? undefined : parseFloat(String(rawRir)),
                parseFloat(String(rawRpe)) || undefined
              );
              roundExs.push({
                exerciseId: regId,
                nameSnapshot: sub.name,
                type: sub.metricType || 'weight',
                sets: [{
                  id: generateId(),
                  index: 1,
                  ...validData,
                  isCed: rawRir === '-1' || rawRir === 'CED',
                  customFields: state.setCustomFields?.[`${sub.name}-${j + 1}`] || state.setCustomFields?.[setId] || undefined
                }]
              });
            }

            if (roundExs.length > 0) {
              hasCheckedSets = true;
              totalSets += roundExs.length;
              completedRounds.push({ roundIndex: j + 1, exercises: roundExs });
            }
          }
          if (completedRounds.length > 0) {
            v2Blocks.push({
              id: generateId(),
              nameSnapshot: ex.name,
              structureType: ex.structureType,
              rounds: completedRounds
            });
          }
        }
      });

      if (hasCheckedSets) {
        const prevSnapshot = state.sessionsV2?.find(
          (s) => s.tabNameSnapshot === currentTab.name
        ) || null;
        const bwAtSession = parseFloat(String(state.bodyMetrics?.weight)) || 0;
        const sessionId = generateId();

        const v2Session: WorkoutSessionV2 = {
          id: sessionId,
          planId: currentTab.id,
          planVersion: currentTab.version || 1,
          date: todayDateStr,
          startedAt: workoutState.startTime || Date.now(),
          completedAt: Date.now(),
          durationStr,
          tabNameSnapshot: currentTab.name,
          tabSubtitleSnapshot: currentTab.subtitle,
          bodyWeightAtSession: bwAtSession,
          blocks: v2Blocks
        };

        // GESTIONE IMMUTABILE DEI PR (Esercizi singoli + Sotto-esercizi dei Circuiti)
        const flatCandidates: Array<{ exerciseId: string; nameSnapshot: string; type?: string; sets: WorkoutSetV2[] }> = [];

        v2Blocks.forEach((block) => {
          if (!('rounds' in block)) {
            flatCandidates.push(block);
          } else {
            block.rounds?.forEach((r) => {
              r.exercises?.forEach((sub) => {
                flatCandidates.push(sub);
              });
            });
          }
        });

        // Raccogliamo il carico massimo per ogni esercizio (solo weight, bodyweight o undefined)
        const exerciseMaxWeights = new Map<string, { exerciseId: string; nameSnapshot: string; maxW: number }>();

        flatCandidates.forEach((cand) => {
          if (cand.type === 'weight' || cand.type === 'bodyweight' || !cand.type) {
            const maxW = Math.max(0, ...cand.sets.map((s) => s.weight || 0));
            if (maxW > 0) {
              const key = cand.exerciseId || cand.nameSnapshot.trim().toLowerCase();
              const existing = exerciseMaxWeights.get(key);
              if (!existing || maxW > existing.maxW) {
                exerciseMaxWeights.set(key, {
                  exerciseId: cand.exerciseId,
                  nameSnapshot: cand.nameSnapshot,
                  maxW
                });
              }
            }
          }
        });

        exerciseMaxWeights.forEach(({ exerciseId, nameSnapshot, maxW }) => {
          const permId = exerciseId;
          const existingPrIndex = nextPrs.findIndex((p) =>
            (permId && p.exerciseId === permId) ||
            (!p.exerciseId && p.name.trim().toLowerCase() === nameSnapshot.trim().toLowerCase())
          );

          if (existingPrIndex === -1) {
            nextPrs.push({
              id: generateId(),
              exerciseId: permId,
              name: nameSnapshot,
              weight: String(maxW),
              history: [{ date: todayDateStr, weight: String(maxW) }]
            });
          } else {
            const exPr = nextPrs[existingPrIndex];
            if (maxW > (parseFloat(exPr.weight) || 0)) {
              nextPrs[existingPrIndex] = {
                ...exPr,
                weight: String(maxW),
                exerciseId: permId || exPr.exerciseId,
                name: nameSnapshot,
                history: [{ date: todayDateStr, weight: String(maxW) }, ...exPr.history]
              };
            }
          }
        });

        nextSessionsV2.unshift(v2Session);

        const nextDeloadDates = [...(state.deloadDates || [])];
        if (state.deloadActive && !nextDeloadDates.includes(todayDateStr)) {
          nextDeloadDates.push(todayDateStr);
        }

        // Assemblaggio finale
        const newState: AppState = {
          ...state,
          activeMasterTimer: null, // 🔥 Spegne il timer se termini l'allenamento
          activeInlineTimers: {},
          deloadDates: nextDeloadDates,
          activeWorkouts: nextActiveWorkouts,
          registryV2: nextRegistry,
          sessionsV2: nextSessionsV2,
          prs: nextPrs,
          checkedSets: {},
          setReps: {},
          setWeights: {},
          setRir: {},
          setRpe: {},
          setDurations: {},
          setCustomFields: {},
          amrapState: {}
        };

        await saveGymState(newState, true, v2Session);
        setState(newState);
        setSummaryData({ newSnapshot: v2Session, prevSnapshot });
      } else {
        const newState = { ...state, activeWorkouts: nextActiveWorkouts, activeMasterTimer: null, activeInlineTimers: {}, amrapState: {} };
        await saveGymState(newState);
        setState(newState);
        showToast('Allenamento terminato (nessuna serie registrata).');
      }
    } catch (e: any) {
      showToast('Errore di salvataggio: ' + (e?.message || 'Riprova'), true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSession = async (tabId: string) => {
    if (!state) return;
    if (confirm('Vuoi davvero azzerare la sessione odierna in questa scheda?')) {
      if (masterTimerIntervalRef.current) {
        safeClearInterval(masterTimerIntervalRef.current);
        masterTimerIntervalRef.current = null;
      }
      setActiveMasterTimer(null);

      const nextCheckedSets = { ...state.checkedSets };
      const nextSetReps = { ...state.setReps };
      const nextSetRir = { ...state.setRir };
      const nextSetRpe = { ...state.setRpe };
      const nextAmrapState = { ...state.amrapState };

      const tab = state.plan.find((t) => t.id === tabId);
      tab?.exercises.forEach((ex) => {
        if (ex.type === 'single') {
          for (let i = 0; i < ex.sets; i++) {
            delete nextCheckedSets[`${ex.id}-${i}`];
            delete nextSetReps[`${ex.id}-${i}`];
            delete nextSetRir[`${ex.id}-${i}`];
            delete nextSetRpe[`${ex.id}-${i}`];
          }
        } else if (ex.type === 'superset') {
          delete nextAmrapState[ex.id];
          for (let j = 0; j < 50; j++) {
            delete nextCheckedSets[`${ex.id}-round-${j}`];
            ex.exercises.forEach((sub) => {
              delete nextCheckedSets[`${sub.id}-${j}`];
              delete nextSetReps[`${sub.id}-${j}`];
              delete nextSetRir[`${sub.id}-${j}`];
              delete nextSetRpe[`${sub.id}-${j}`];
            });
          }
        }
      });

      const newState = {
        ...state,
        checkedSets: nextCheckedSets,
        setReps: nextSetReps,
        setRir: nextSetRir,
        setRpe: nextSetRpe,
        amrapState: nextAmrapState,
        activeMasterTimer: null
      };
      
      setState(newState);
      await saveGymState(newState);
      showToast('Sessione riavviata.');
    }
  };

  const handleToggleSet = async (
    exId: string,
    setIndex: number,
    pauseSec: number,
    prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, string> },
    isSub = false,
    circuitId?: string
  ) => {
    if (!state) return;
    initAudio();
    const setId = `${exId}-${setIndex}`;
    const isChecked = Boolean(state.checkedSets[setId]);

    // Shallow copy sicura solo dei dizionari interessati (Immutabilità granulare)
    const nextCheckedSets = { ...state.checkedSets };
    let nextSetReps = state.setReps;
    let nextSetWeights = state.setWeights;
    let nextSetRir = state.setRir;
    let nextSetRpe = state.setRpe;
    let nextSetCustomFields = state.setCustomFields || {};

    if (isChecked) {
      delete nextCheckedSets[setId];
    } else {
      nextCheckedSets[setId] = true;
      if (nextSetReps[setId] === undefined) {
        nextSetReps = { ...nextSetReps, [setId]: prefill.reps };
      }
      if (nextSetWeights[setId] === undefined) {
        nextSetWeights = { ...nextSetWeights, [setId]: prefill.weight };
      }
      if (prefill.rir !== undefined && nextSetRir[setId] === undefined) {
        nextSetRir = { ...nextSetRir, [setId]: prefill.rir };
      }
      if (prefill.rpe !== undefined && nextSetRpe[setId] === undefined) {
        nextSetRpe = { ...nextSetRpe, [setId]: prefill.rpe };
      }
      if (prefill.customFields && Object.keys(prefill.customFields).length > 0) {
        const currentFields = nextSetCustomFields[setId] || {};
        nextSetCustomFields = { ...nextSetCustomFields, [setId]: { ...prefill.customFields, ...currentFields } };
      }
    }

    const nextState = {
      ...state,
      checkedSets: nextCheckedSets,
      setReps: nextSetReps,
      setWeights: nextSetWeights,
      setRir: nextSetRir,
      setRpe: nextSetRpe,
      setCustomFields: nextSetCustomFields
    };

    // Gestione Side Effects
    if (!isChecked) {
      let handledCircuitRest = false;
      if (isSub && circuitId) {
        const currentTab = nextState.plan.find((t) => t.id === nextState.activeTab);
        const circuit = currentTab?.exercises.find((e) => e.id === circuitId);
        
        if (circuit && circuit.type === 'superset' && circuit.structureType === 'classic') {
          const lastRealEx = [...circuit.exercises].reverse().find((e) => e.metricType !== 'rest');
          
          if (lastRealEx && lastRealEx.id === exId) {
            handledCircuitRest = true;
            const circuitPause = circuit.pause !== undefined ? circuit.pause : 90;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(20); } catch { /* ignore */ }
            }
            playShortBeep();
            
            if (circuitPause > 0) {
              startRestTimer(circuitPause, async () => {
                setState((prev) => {
                  if (!prev) return null;
                  const next = {
                    ...prev,
                    checkedSets: { ...prev.checkedSets, [`${circuitId}-round-${setIndex}`]: true }
                  };
                  saveGymState(next).catch(console.warn);
                  return next;
                });
                const circuitEl = document.getElementById(`circuit-${circuitId}`);
                circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              });
            } else {
              nextCheckedSets[`${circuitId}-round-${setIndex}`] = true;
            }
          }
        }
      }

      if (!handledCircuitRest) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(20); } catch { /* ignore */ }
        }
        playShortBeep();
        if (pauseSec > 0) {
          startRestTimer(pauseSec, () => {
            if (circuitId) {
              const circuitEl = document.getElementById(`circuit-${circuitId}`);
              circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              const exEl = document.getElementById(`ex-container-${exId}`) || document.getElementById(`exercise-${exId}`);
              exEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
      }
    }

    setState(nextState); // Immediato / ottimistico per massima fluidità
    await saveGymState(nextState); // Persistenza sicura su IndexedDB
  };

  const handleLongPressSet = (
    exId: string,
    setIndex: number,
    pauseSec: number,
    prefill: { reps: string; weight: string; rir?: string; rpe?: string; customFields?: Record<string, string> },
    circuitId?: string
  ) => {
    if (!state) return;
    const setId = `${exId}-${setIndex}`;
    const currentVal = state.setReps[setId] ?? prefill.reps;
    const parsedInitial = parseInt(String(currentVal)) || 10;

    let exerciseName: string | undefined;
    for (const tab of state.plan) {
      for (const ex of tab.exercises) {
        if (ex.id === exId) {
          exerciseName = ex.name;
          break;
        }
        if (ex.type === 'superset' && ex.exercises) {
          const sub = ex.exercises.find((s) => s.id === exId);
          if (sub) {
            exerciseName = sub.name;
            break;
          }
        }
      }
      if (exerciseName) break;
    }

    setRepsModalTarget({
      exId,
      setIndex,
      pauseSec,
      prefill,
      circuitId,
      initialReps: parsedInitial,
      exerciseName
    });
  };

  const handleConfirmRepsModal = async (reps: number) => {
    if (!state || !repsModalTarget) return;
    const { exId, setIndex, pauseSec, prefill, circuitId } = repsModalTarget;
    setRepsModalTarget(null);

    const setId = `${exId}-${setIndex}`;
    const parsed = Math.max(0, reps);

    const nextCheckedSets = { ...state.checkedSets };
    const nextSetReps = { ...state.setReps };
    const nextSetWeights = { ...state.setWeights };
    const nextSetRir = { ...state.setRir };
    const nextSetRpe = { ...state.setRpe };

    nextSetReps[setId] = parsed.toString();
    nextCheckedSets[setId] = true;
    
    if (nextSetWeights[setId] === undefined) nextSetWeights[setId] = prefill.weight;
    if (prefill.rir !== undefined && nextSetRir[setId] === undefined) nextSetRir[setId] = prefill.rir;
    if (prefill.rpe !== undefined && nextSetRpe[setId] === undefined) nextSetRpe[setId] = prefill.rpe;

    let nextSetCustomFields = state.setCustomFields || {};
    if (prefill.customFields && Object.keys(prefill.customFields).length > 0) {
      const currentFields = nextSetCustomFields[setId] || {};
      nextSetCustomFields = { ...nextSetCustomFields, [setId]: { ...prefill.customFields, ...currentFields } };
    }

    const nextState = {
      ...state,
      checkedSets: nextCheckedSets,
      setReps: nextSetReps,
      setWeights: nextSetWeights,
      setRir: nextSetRir,
      setRpe: nextSetRpe,
      setCustomFields: nextSetCustomFields
    };

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(20); } catch { /* ignore */ }
    }
    playShortBeep();

    let handledCircuitRest = false;
    if (circuitId) {
      const currentTab = nextState.plan.find((t) => t.id === nextState.activeTab);
      const circuit = currentTab?.exercises.find((e) => e.id === circuitId);
      
      if (circuit && circuit.type === 'superset' && circuit.structureType === 'classic') {
        const lastRealEx = [...circuit.exercises].reverse().find((e) => e.metricType !== 'rest');
        
        if (lastRealEx && lastRealEx.id === exId) {
          handledCircuitRest = true;
          const circuitPause = circuit.pause !== undefined ? circuit.pause : 90;
          
          if (circuitPause > 0) {
            startRestTimer(circuitPause, async () => {
              setState((prev) => {
                if (!prev) return null;
                const next = {
                  ...prev,
                  checkedSets: { ...prev.checkedSets, [`${circuitId}-round-${setIndex}`]: true }
                };
                saveGymState(next).catch(console.warn);
                return next;
              });
              const circuitEl = document.getElementById(`circuit-${circuitId}`);
              circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          } else {
            nextCheckedSets[`${circuitId}-round-${setIndex}`] = true;
          }
        }
      }
    }

    if (!handledCircuitRest) {
      if (pauseSec > 0) {
        startRestTimer(pauseSec, () => {
          if (circuitId) {
            const circuitEl = document.getElementById(`circuit-${circuitId}`);
            circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            const exEl = document.getElementById(`ex-container-${exId}`) || document.getElementById(`exercise-${exId}`);
            exEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    }

    setState(nextState);
    await saveGymState(nextState);
  };

  const handleRunInlineTimer = (
    setId: string, 
    durationSec: number, 
    pauseSec: number, 
    prefill: { weight: string; rir?: string; rpe?: string }
  ) => {
    if (!state) return;
    initAudio();

    if (state.activeInlineTimers?.[setId]) {
      setState((prev) => {
        if (!prev) return null;
        const nextInline = { ...(prev.activeInlineTimers || {}) };
        delete nextInline[setId];
        const next = { ...prev, activeInlineTimers: nextInline };
        saveGymState(next).catch(console.warn);
        return next;
      });
      return;
    }

    setState((prev) => {
      if (!prev) return null;
      const nextInline = {
        ...(prev.activeInlineTimers || {}),
        [setId]: {
          startTimestamp: Date.now(),
          durationSec,
          pauseSec,
          prefill
        }
      };
      const next = { ...prev, activeInlineTimers: nextInline };
      saveGymState(next).catch(console.warn);
      return next;
    });
  };

  // 🔴 Ricostruzione e gestione sincronizzata dei Timer Inline persistenti
  useEffect(() => {
    const inlineTimers = state?.activeInlineTimers || {};
    const activeIds = Object.keys(inlineTimers);

    // Pulizia degli intervalli per i timer rimossi
    Object.keys(inlineTimerIntervalsRef.current).forEach((id) => {
      if (!inlineTimers[id]) {
        safeClearInterval(inlineTimerIntervalsRef.current[id]);
        delete inlineTimerIntervalsRef.current[id];
        setInlineTimerCountdown((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    if (activeIds.length === 0) return;

    activeIds.forEach((setId) => {
      const timer = inlineTimers[setId];
      if (!timer) return;
      const { startTimestamp, durationSec, pauseSec, prefill } = timer;
      const elapsed = (Date.now() - startTimestamp) / 1000;
      const remaining = Math.max(0, Math.ceil(durationSec - elapsed));

      const completeInlineSet = () => {
        if (inlineTimerIntervalsRef.current[setId]) {
          safeClearInterval(inlineTimerIntervalsRef.current[setId]);
          delete inlineTimerIntervalsRef.current[setId];
        }
        setInlineTimerCountdown((prev) => {
          const next = { ...prev };
          delete next[setId];
          return next;
        });
        playTrumpet();
        setState((prev) => {
          if (!prev) return null;
          const nextCheckedSets = { ...prev.checkedSets, [setId]: true };
          const nextSetReps = { ...prev.setReps };
          const nextSetWeights = { ...prev.setWeights };
          const nextSetRir = { ...prev.setRir };
          const nextSetRpe = { ...prev.setRpe };

          if (nextSetReps[setId] === undefined) nextSetReps[setId] = String(durationSec);
          if (nextSetWeights[setId] === undefined) nextSetWeights[setId] = prefill.weight;
          if (prefill.rir !== undefined && nextSetRir[setId] === undefined) nextSetRir[setId] = prefill.rir;
          if (prefill.rpe !== undefined && nextSetRpe[setId] === undefined) nextSetRpe[setId] = prefill.rpe;

          const nextInline = { ...(prev.activeInlineTimers || {}) };
          delete nextInline[setId];

          const nextState: AppState = {
            ...prev,
            checkedSets: nextCheckedSets,
            setReps: nextSetReps,
            setWeights: nextSetWeights,
            setRir: nextSetRir,
            setRpe: nextSetRpe,
            activeInlineTimers: nextInline
          };
          saveGymState(nextState).catch(console.warn);
          return nextState;
        });
        if (pauseSec > 0) startRestTimer(pauseSec);
      };

      if (remaining <= 0) {
        completeInlineSet();
      } else {
        setInlineTimerCountdown((prev) => ({ ...prev, [setId]: remaining }));
        if (!inlineTimerIntervalsRef.current[setId]) {
          inlineTimerIntervalsRef.current[setId] = safeSetInterval(() => {
            const curElapsed = (Date.now() - startTimestamp) / 1000;
            const curRemaining = Math.max(0, Math.ceil(durationSec - curElapsed));
            if (curRemaining <= 0) {
              completeInlineSet();
            } else {
              setInlineTimerCountdown((prev) => ({ ...prev, [setId]: curRemaining }));
            }
          }, 250);
        }
      }
    });
  }, [state?.activeInlineTimers]);

  // 3. SOSTITUISCI handleStartEmom e handleStartAmrap CON QUESTE
  const handleStartEmom = async (circuitId: string, totalMin: number, intervalSec: number) => {
    if (state?.activeMasterTimer?.circuitId === circuitId) {
      const newState = { ...state, activeMasterTimer: null };
      setState(newState);
      await saveGymState(newState);
      return;
    }
    initAudio();
    const newState = {
      ...state!,
      activeMasterTimer: {
        circuitId,
        type: 'emom' as const,
        startTimestamp: Date.now(),
        durationSec: totalMin * 60,
        intervalSec
      }
    };
    setState(newState);
    await saveGymState(newState, false); // Sincrono
  };

  const handleStartAmrap = async (circuitId: string, totalMin: number, pacingSec?: number) => {
    if (state?.activeMasterTimer?.circuitId === circuitId) {
      const newState = { ...state, activeMasterTimer: null };
      setState(newState);
      await saveGymState(newState);
      return;
    }
    initAudio();
    const newState = {
      ...state!,
      activeMasterTimer: {
        circuitId,
        type: 'amrap' as const,
        startTimestamp: Date.now(),
        durationSec: totalMin * 60,
        pacingSec
      }
    };
    setState(newState);
    await saveGymState(newState, false); // Sincrono
  };

  // 4. 🔥 AGGIUNGI QUESTO USE_EFFECT SUBITO SOTTO AGLI ALTRI (Il cuore dell'Anti-Crash)
  useEffect(() => {
    const pTimer = state?.activeMasterTimer;

    // Se non c'è timer persistente, distruggi eventuali intervalli orfani in UI
    if (!pTimer) {
      if (masterTimerIntervalRef.current) {
        safeClearInterval(masterTimerIntervalRef.current);
        masterTimerIntervalRef.current = null;
      }
      setActiveMasterTimer(null);
      return;
    }

    // Se l'intervallo gira già per questo specifico timer, non fare nulla (evita loop e re-render fatali)
    if (masterTimerIntervalRef.current) return;

    const { circuitId, type, startTimestamp, durationSec, intervalSec, pacingSec } = pTimer;
    const totalRounds = type === 'emom' ? Math.ceil(durationSec / (intervalSec || 60)) : undefined;

    let lastAnnouncedRoundOrPacing = 0;

    // Boot: eseguiamo subito per evitare il lag di 1 secondo all'avvio o al rientro dall'app
    const initialElapsed = (Date.now() - startTimestamp) / 1000;
    if (type === 'emom') {
      lastAnnouncedRoundOrPacing = Math.floor(initialElapsed / (intervalSec || 60));
      setActiveMasterTimer({ circuitId, type, remainingSec: (intervalSec || 60), activeEmomRound: lastAnnouncedRoundOrPacing, totalRounds, intervalSec });
    } else {
      lastAnnouncedRoundOrPacing = pacingSec ? Math.floor(initialElapsed / pacingSec) : 0;
      setActiveMasterTimer({ circuitId, type, remainingSec: Math.max(0, durationSec - initialElapsed), pacingSec });
    }

    // Loop vitale a 250ms per massima fluidità
    masterTimerIntervalRef.current = safeSetInterval(() => {
      const elapsedSec = (Date.now() - startTimestamp) / 1000;
      const remainingTotal = Math.max(0, Math.ceil(durationSec - elapsedSec));

      if (remainingTotal <= 0) {
        safeClearInterval(masterTimerIntervalRef.current!);
        masterTimerIntervalRef.current = null;
        setActiveMasterTimer(null);
        playTrumpet();
        showToast(type === 'emom' ? 'EMOM Completato con successo!' : 'AMRAP Terminato!');
        
        // 🔥 FIX: Salva esplicitamente la rimozione del timer
        setState(prev => {
           if (!prev) return null;
           const nextState = { ...prev, activeMasterTimer: null };
           // Chiamata fire-and-forget, ma garantisce che IDB riceva l'ordine di eliminare il timer persistente
           saveGymState(nextState).catch(console.error);
           return nextState;
        });
        return;
      }

      if (type === 'emom') {
        const intSec = intervalSec || 60;
        const currentRound = Math.floor(elapsedSec / intSec);
        const remainingRound = Math.max(0, Math.ceil((currentRound + 1) * intSec - elapsedSec));

        if (currentRound > lastAnnouncedRoundOrPacing) {
          const missedRounds = currentRound - lastAnnouncedRoundOrPacing;
          lastAnnouncedRoundOrPacing = currentRound;
          setState((prev) => {
            if (!prev) return null;
            const nextCheckedSets = { ...prev.checkedSets };
            // Recupera tutti i giri completati mentre l'app era in sospensione
            for (let r = currentRound - missedRounds; r < currentRound; r++) {
              nextCheckedSets[`${circuitId}-round-${r}`] = true;
            }
            const next = { ...prev, checkedSets: nextCheckedSets };
            saveGymState(next).catch(console.warn);
            return next;
          });
          // Suona la tromba solo se il giro è appena scattato (evita spam sonoro al rientro)
          if (elapsedSec - (currentRound * intSec) < 5) playTrumpet();
        }
        setActiveMasterTimer({ circuitId, type, remainingSec: remainingRound, activeEmomRound: currentRound, totalRounds, intervalSec });
      
      } else {
        // AMRAP
        if (pacingSec && pacingSec > 0) {
          const currentPacing = Math.floor(elapsedSec / pacingSec);
          if (currentPacing > lastAnnouncedRoundOrPacing) {
            lastAnnouncedRoundOrPacing = currentPacing;
            if (elapsedSec - (currentPacing * pacingSec) < 5) playShortBeep();
          }
        }
        setActiveMasterTimer({ circuitId, type, remainingSec: remainingTotal, pacingSec });
      }
    }, 250);

  // NOTA BENE: Questo useEffect si riattiva SOLO se cambia il timestamp di avvio (quindi quando crei un NUOVO timer)
  }, [state?.activeMasterTimer?.startTimestamp]);

  const handlePdfUpload = async (file: File) => {
    showToast('Analisi referto BIA in corso...');
    try {
      const extracted = await extractBiaFromPdf(file);
      setBiaModalData(extracted);
    } catch (err) {
      showToast('Errore lettura PDF. Puoi compilare a mano i dati.', true);
      setBiaModalData({
        date: getTodayStr(),
        weight: '',
        height: '',
        fm: '',
        ffm: '',
        foundCount: 0
      });
    }
  };

  const handleExportBackup = async () => {
    if (!state) return;
    try {
      const code = exportBackupString(state);
      if (navigator.share) {
        await navigator.share({ title: 'MyGym Backup', text: code });
      } else {
        await navigator.clipboard.writeText(code);
        showToast('Codice di backup copiato negli appunti!');
      }
      setState((prev) => (prev ? { ...prev, lastBackupDate: getTodayStr() } : null));
      setIsSyncModalOpen(false);
    } catch {
      showToast('Errore esportazione.', true);
    }
  };

  const handleImportBackup = async () => {
    const code = prompt('Incolla il codice di backup (GYM2::... oppure JSON):');
    if (!code) return;

    try {
      // 1. Analizza e ripara i dati (ma NON li salva ancora)
      const parsed = importBackupString(code);
      
      // 2. 🔴 Estrae le informazioni per il popup intelligente
      const allenamenti = parsed.sessionsV2?.length || (parsed as any).workoutSessionsHistory?.length || 0;
      const dataBackup = parsed.lastBackupDate || 'sconosciuta';
      
      // 3. Mostra l'avviso di sicurezza all'utente
      if (!confirm(`Stai per ripristinare un backup del ${dataBackup} contenente ${allenamenti} allenamenti.\n\nATTENZIONE: i dati attuali verranno sovrascritti in modo irreversibile. Procedo?`)) {
        return; // L'utente ha annullato
      }

      // 4. Crea uno snapshot di sicurezza dello stato corrente prima del ripristino
      if (state) {
        await createSafetyBackup(state, `Snapshot automatico pre-ripristino backup (${dataBackup})`);
      }

      // 5. Salva i dati canonici
      setState(parsed);
      await saveGymState(parsed, true);
      showToast('Dati ripristinati con successo! 🚀');
      setIsSyncModalOpen(false);
    } catch (e: any) {
      showToast(e?.message || 'Codice di backup non valido o corrotto.', true);
    }
  };

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-400 gap-3">
        <i className="fa-solid fa-dumbbell text-3xl text-emerald-500 animate-bounce" />
        <p className="text-xs font-bold uppercase tracking-wider">Caricamento MyGym Tracker...</p>
      </div>
    );
  }

  const currentTab = state.plan.find((t) => t.id === state.activeTab) || state.plan[0];
  const isHomeTab = Boolean(currentTab.isHome);
  const streak = computeStreakFromSessions(state.sessionsV2);

  return (
    <div className="h-[100dvh] w-full bg-zinc-950 text-zinc-100 flex flex-col font-sans overflow-hidden">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed top-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-3xl shadow-2xl z-[130] font-bold text-xs text-center border animate-in fade-in slide-in-from-top-2 max-w-[90vw] ${
            toastMessage.isError
              ? 'bg-rose-950/90 text-rose-200 border-rose-800 backdrop-blur-md'
              : 'bg-zinc-800/90 text-zinc-100 border-zinc-700 backdrop-blur-md'
          }`}
        >
          {toastMessage.text}
        </div>
      )}



      {/* Header */}
      <Header
        profileName={state.profileName}
        streakCount={streak}
        tabs={state.plan}
        activeTabId={state.activeTab}
        favoriteTabs={state.favoriteTabs}
        isEditMode={state.isEditMode}
        onSelectTab={handleSelectTab}
        onToggleSideMenu={() => setIsSideMenuOpen(true)}
        onMoveTab={(id, dir) => {
          setState((prev) => {
            if (!prev) return null;
            const idx = prev.plan.findIndex((t) => t.id === id);
            if (idx <= 0) return prev;
            const targetIdx = idx + dir;
            if (targetIdx < 1 || targetIdx >= prev.plan.length) return prev;
            const newPlan = [...prev.plan];
            const temp = newPlan[idx];
            newPlan[idx] = newPlan[targetIdx];
            newPlan[targetIdx] = temp;
            const next = { ...prev, plan: newPlan };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onDeleteTab={async (id) => {
          if (state.plan.length <= 2) {
            showToast("Impossibile eliminare l'unica scheda.");
            return;
          }
          if (confirm('Eliminare questa scheda e tutti i suoi esercizi?')) {
            setState((prev) => {
              if (!prev) return null;
              
              // Isoliamo e cloniamo tutti i dizionari prima di passarli al Garbage Collector
              const next = { 
                ...prev,
                weights: { ...prev.weights },
                checkedSets: { ...prev.checkedSets },
                setWeights: { ...prev.setWeights },
                setReps: { ...prev.setReps },
                setRir: { ...prev.setRir },
                setDurations: { ...prev.setDurations },
                setRpe: { ...prev.setRpe },
                setCustomFields: { ...prev.setCustomFields },
                amrapState: { ...prev.amrapState },
                activeWorkouts: { ...prev.activeWorkouts }
              };
              
              const targetTab = next.plan.find(t => t.id === id);
              if (targetTab) {
                targetTab.exercises.forEach(ex => {
                  if (ex.type === 'single') cleanupOrphanDataForId(next, ex.id);
                  else if (ex.type === 'superset') cleanupCircuitOrphanData(next, ex);
                });
              }
              
              delete next.activeWorkouts[id];
              next.plan = next.plan.filter((t) => t.id !== id);
              next.activeTab = 'home';
              saveGymState(next).catch(console.warn);
              return next;
            });
          }
        }}
        onRenameTab={(id, name) => {
          setState((prev) => {
            if (!prev) return null;
            const next = {
              ...prev,
              plan: prev.plan.map((t) => (t.id === id ? { ...t, name } : t))
            };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onAddTab={() => {
          const newId = `scheda-${generateId()}`;
          setState((prev) => {
            if (!prev) return null;
            const next = {
              ...prev,
              plan: [...prev.plan, { id: newId, name: 'Nuova Scheda', subtitle: '', exercises: [] }],
              activeTab: newId
            };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        isRestTimerActive={isRestTimerActive}
        restTimerSeconds={restTimerSeconds}
        onSkipTimer={skipRestTimer}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain w-full max-w-2xl mx-auto p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {isHomeTab ? (
          <HomeDashboard
            state={state}
            onSelectTab={handleSelectTab}
            onAddFirstTab={() => {
              const newId = `scheda-${generateId()}`;
              setState((prev) => {
                if (!prev) return null;
                const next = {
                  ...prev,
                  plan: [...prev.plan, { id: newId, name: 'Scheda 1', subtitle: 'La mia scheda', exercises: [] }],
                  activeTab: newId,
                  isEditMode: true
                };
                saveGymState(next).catch(console.warn);
                return next;
              });
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Edit Mode Alert Banner */}
            {state.isEditMode && (
              <div className="bg-emerald-950/20 text-emerald-400 p-4 rounded-3xl flex justify-between items-center border border-emerald-900/30 mb-2 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <i className="fa-solid fa-pen-to-square text-lg" />
                  <span className="text-xs font-black uppercase tracking-wider">Modalità Modifica Attiva</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setState((prev) => {
                      if (!prev) return null;
                      const next = {
                        ...prev,
                        isEditMode: false,
                        // 🔴 FASE E: Incrementiamo la versione della scheda appena modificata
                        plan: prev.plan.map(t =>
                          t.id === currentTab.id ? { ...t, version: (t.version || 1) + 1 } : t
                        )
                      };
                      saveGymState(next).catch(console.warn);
                      return next;
                    });
                  }}
                  className="bg-emerald-500 text-zinc-950 px-4 py-2 rounded-xl text-xs font-bold outline-none active:scale-95 transition-transform"
                >
                  Fatto ✓
                </button>
              </div>
            )}

            {/* Routine Header Bar */}
            <div className="mb-4">
              {state.isEditMode ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setState((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            favoriteTabs: {
                              ...prev.favoriteTabs,
                              [currentTab.id]: !prev.favoriteTabs[currentTab.id]
                            }
                          };
                        });
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-2xl border flex items-center gap-1.5 transition-all ${
                        state.favoriteTabs[currentTab.id]
                          ? 'bg-amber-950/30 text-amber-400 border-amber-900/50 shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      <i className={`fa-${state.favoriteTabs[currentTab.id] ? 'solid' : 'regular'} fa-star`} />
                      {state.favoriteTabs[currentTab.id] ? 'Scheda Preferita' : 'Imposta come Preferita'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={currentTab.subtitle || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setState((prev) => {
                        if (!prev) return null;
                        return {
                          ...prev,
                          plan: prev.plan.map((t) => (t.id === currentTab.id ? { ...t, subtitle: val } : t))
                        };
                      });
                    }}
                    placeholder="Sottotitolo (es. Spalle & Braccia, Gambe Focus)"
                    className="w-full bg-zinc-900/80 text-zinc-200 text-xs font-bold rounded-2xl p-4 outline-none border border-zinc-800/80 focus:border-emerald-500 shadow-inner"
                  />
                </div>
              ) : isWorkoutActive ? (
                <div className="flex justify-between items-center bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-3xl shadow-sm backdrop-blur-sm">
                  <div>
                    <h2 className="text-emerald-500/70 font-bold uppercase tracking-wider text-[10px]">
                      {currentTab.subtitle || 'Sessione Workout'}
                    </h2>
                    <div className="text-emerald-400 font-black text-sm flex items-center gap-2 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Sessione in corso
                      <span className="ml-2 font-mono bg-emerald-900/40 px-2 py-0.5 rounded-md text-emerald-300 border border-emerald-800/60 text-xs shadow-sm">
                        {Math.floor(workoutLiveSec / 60)
                          .toString()
                          .padStart(2, '0')}
                        :
                        {(workoutLiveSec % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800/50 shadow-sm backdrop-blur-sm">
                  <div>
                    <h2 className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                      {currentTab.subtitle || 'Pronto per iniziare?'}
                    </h2>
                    <div className="text-white font-extrabold text-sm">{currentTab.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartWorkout(currentTab.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 outline-none text-xs shadow-md active:scale-95"
                  >
                    <i className="fa-solid fa-play" /> Inizia
                  </button>
                </div>
              )}
            </div>

            {/* Exercises List */}
            {currentTab.exercises.map((ex, exIdx) => {
              const isFirst = exIdx === 0;
              const isLast = exIdx === currentTab.exercises.length - 1;

              if (ex.type === 'single') {
                return (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    index={exIdx}
                    isFirst={isFirst}
                    isLast={isLast}
                    isWorkoutActive={isWorkoutActive}
                    isEditMode={state.isEditMode}
                    state={state}
                    activeInlineTimerSec={inlineTimerCountdown}
                    onOpenVideo={(url) => setVideoModalUrl(url)}
                    onOpenEffortModal={(setId, isRpe) => setEffortTarget({ setId, isRpe })}
                    onRunInlineTimer={(setId, dur, pauseSec, prefill) => 
                      handleRunInlineTimer(setId, dur, pauseSec, prefill)
                    }
                    onSaveWeight={(val) => handleSaveWeight(ex.id, val)}
                    onSaveSetWeight={handleSaveSetWeight}
                    onSaveCustomField={handleSaveCustomField} // 🔴 AGGIUNGI QUESTA RIGA QUI
                    onUpdateRegistry={(permId, field, val) => {
                      setState((prev) => {
                        if (!prev) return null;
                        const currentReg = prev.registryV2[permId];
                        if (!currentReg) return prev;
                        const next = {
                          ...prev,
                          registryV2: {
                            ...prev.registryV2,
                            [permId]: { ...currentReg, [field]: val }
                          }
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onToggleSet={(sIdx, pauseSec, prefill) =>
                      handleToggleSet(ex.id, sIdx, pauseSec, prefill)
                    }
                    onLongPressSet={(sIdx, pauseSec, prefill) =>
                      handleLongPressSet(ex.id, sIdx, pauseSec, prefill)
                    }
                    onUpdateEx={(field, val) => {
                      setState((prev) => {
                        if (!prev) return null;
                        
                        // Sincronizza col Registro se modifichiamo nome o tipo
                        let nextRegistry = prev.registryV2;
                        if ((field === 'name' || field === 'metricType') && ex.exerciseId) {
                          const existingReg = nextRegistry[ex.exerciseId];
                          if (existingReg) {
                            nextRegistry = {
                              ...nextRegistry,
                              [ex.exerciseId]: { 
                                ...existingReg, 
                                [field === 'metricType' ? 'type' : 'name']: val 
                              }
                            };
                          }
                        }

                        const next = {
                          ...prev,
                          registryV2: nextRegistry,
                          plan: prev.plan.map((t) =>
                            t.id === currentTab.id
                              ? {
                                  ...t,
                                  exercises: t.exercises.map((e) =>
                                    e.id === ex.id ? { ...e, [field]: val } : e
                                  )
                                }
                              : t
                          )
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onDeleteEx={() => {
                      setState((prev) => {
                        if (!prev) return null;
                        const next = { ...prev };
                        cleanupOrphanDataForId(next, ex.id); // 🔴 Eliminazione Dati
                        next.plan = next.plan.map((t) =>
                          t.id === currentTab.id
                            ? { ...t, exercises: t.exercises.filter((e) => e.id !== ex.id) }
                            : t
                        );
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onMoveEx={(dir) => {
                      setState((prev) => {
                        if (!prev) return null;
                        const tIdx = prev.plan.findIndex((t) => t.id === currentTab.id);
                        if (tIdx === -1) return prev;
                        const targetExIdx = exIdx + dir;
                        if (targetExIdx < 0 || targetExIdx >= currentTab.exercises.length) return prev;
                        const newExercises = [...currentTab.exercises];
                        const temp = newExercises[exIdx];
                        newExercises[exIdx] = newExercises[targetExIdx];
                        newExercises[targetExIdx] = temp;
                        const newPlan = [...prev.plan];
                        newPlan[tIdx] = { ...currentTab, exercises: newExercises };
                        const next = { ...prev, plan: newPlan };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                  />
                );
              } else {
                return (
                  <CircuitCard
                    key={ex.id}
                    circuit={ex}
                    index={exIdx + 1}
                    isFirst={isFirst}
                    isLast={isLast}
                    isWorkoutActive={isWorkoutActive}
                    isEditMode={state.isEditMode}
                    state={state}
                    activeInlineTimerSec={inlineTimerCountdown}
                    onRunInlineTimer={(setId, dur, pauseSec, prefill) => 
                      handleRunInlineTimer(setId, dur, pauseSec, prefill)
                    }
                    onSaveCustomField={handleSaveCustomField}
                    isMasterTimerRunning={activeMasterTimer?.circuitId === ex.id}
                    masterTimerRemainingSec={activeMasterTimer?.remainingSec || 0}
                    activeEmomRound={activeMasterTimer?.activeEmomRound ?? -1}
                    onEmomCriticalRest={(remSec) => {
                      showToast(`⚠️ EMOM: Solo ${remSec}s di recupero! Valuta di scalare reps o carico al prossimo giro.`, true);
                    }}
                    onOpenVideo={(url) => setVideoModalUrl(url)}
                    onOpenEffortModal={(setId, isRpe) => setEffortTarget({ setId, isRpe })}
                    onStartAmrapTimer={(min, pacingSec) => handleStartAmrap(ex.id, min, pacingSec)}
                    onStartEmomTimer={(min, sec) => handleStartEmom(ex.id, min, sec)}
                    onAddAmrapRound={async (roundSets) => {
                      setState((prev) => {
                        if (!prev) return null;
                        const currentAmrap = prev.amrapState?.[ex.id] || { currentRound: 0, completedRounds: 0 };
                        const curRoundIdx = currentAmrap.currentRound;
                        const nextCompleted = currentAmrap.completedRounds + 1;
                        const nextCurrent = currentAmrap.currentRound + 1;

                        const nextCheckedSets = { ...prev.checkedSets };
                        const nextSetReps = { ...prev.setReps };
                        const nextSetWeights = { ...prev.setWeights };
                        const nextSetRir = { ...prev.setRir };
                        const nextSetRpe = { ...prev.setRpe };

                        // Marca come completato il giro
                        nextCheckedSets[`${ex.id}-round-${curRoundIdx}`] = true;

                        if (roundSets && roundSets.length > 0) {
                          roundSets.forEach((item) => {
                            const setId = `${item.subId}-${curRoundIdx}`;
                            nextCheckedSets[setId] = true;
                            if (nextSetReps[setId] === undefined) nextSetReps[setId] = item.reps;
                            if (nextSetWeights[setId] === undefined) nextSetWeights[setId] = item.weight;
                            if (item.rir !== undefined && nextSetRir[setId] === undefined) nextSetRir[setId] = item.rir;
                            if (item.rpe !== undefined && nextSetRpe[setId] === undefined) nextSetRpe[setId] = item.rpe;
                          });
                        } else {
                          ex.exercises.forEach((sub) => {
                            if (sub.metricType !== 'rest') {
                              const setId = `${sub.id}-${curRoundIdx}`;
                              nextCheckedSets[setId] = true;
                              if (nextSetReps[setId] === undefined) nextSetReps[setId] = sub.reps || '10';
                              if (nextSetWeights[setId] === undefined) nextSetWeights[setId] = prev.weights[sub.id] || '0';
                            }
                          });
                        }

                        const next: AppState = {
                          ...prev,
                          checkedSets: nextCheckedSets,
                          setReps: nextSetReps,
                          setWeights: nextSetWeights,
                          setRir: nextSetRir,
                          setRpe: nextSetRpe,
                          amrapState: {
                            ...prev.amrapState,
                            [ex.id]: {
                              currentRound: nextCurrent,
                              completedRounds: nextCompleted
                            }
                          }
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                      setTimeout(() => {
                        const targetRoundIdx = (state.amrapState?.[ex.id]?.currentRound ?? 0) + 1;
                        const nextRoundEl = document.getElementById(`circuit-${ex.id}-round-${targetRoundIdx}`);
                        if (nextRoundEl) {
                          nextRoundEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                      }, 100);
                    }}
                    onStartRoundRest={async (sec, roundIdx) => {
                      const roundKey = `${ex.id}-round-${roundIdx}`;
                      if (state.checkedSets[roundKey]) {
                        setState((prev) => {
                          if (!prev) return null;
                          const nextSets = { ...prev.checkedSets };
                          delete nextSets[roundKey];
                          const next = { ...prev, checkedSets: nextSets };
                          saveGymState(next).catch(console.warn);
                          return next;
                        });
                      } else {
                        startRestTimer(sec, async () => {
                          setState((prev) => {
                            if (!prev) return null;
                            const next = {
                              ...prev,
                              checkedSets: { ...prev.checkedSets, [roundKey]: true }
                            };
                            saveGymState(next).catch(console.warn);
                            return next;
                          });
                          const circuitEl = document.getElementById(`circuit-${ex.id}`);
                          circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                      }
                    }}
                    onSaveWeight={(subId, val) => handleSaveWeight(subId, val)}
                    onToggleSubSet={(subId, roundIdx, pauseSec, prefill) =>
                      handleToggleSet(subId, roundIdx, pauseSec, prefill, true, ex.id)
                    }
                    onLongPressSubSet={(subId, roundIdx, pauseSec, prefill) => {
                      handleLongPressSet(subId, roundIdx, pauseSec, prefill, ex.id);
                    }}
                    onUpdateCircuit={(field, val) => {
                      setState((prev) => {
                        if (!prev) return null;
                        const next = {
                          ...prev,
                          plan: prev.plan.map((t) =>
                            t.id === currentTab.id
                              ? {
                                  ...t,
                                  exercises: t.exercises.map((e) =>
                                    e.id === ex.id ? { ...e, [field]: val } : e
                                  )
                                }
                              : t
                          )
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onDeleteCircuit={() => {
                      setState((prev) => {
                        if (!prev) return null;
                        const next = { ...prev };
                        cleanupCircuitOrphanData(next, ex); // 🔴 Eliminazione Dati
                        next.plan = next.plan.map((t) =>
                          t.id === currentTab.id
                            ? { ...t, exercises: t.exercises.filter((e) => e.id !== ex.id) }
                            : t
                        );
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onMoveCircuit={(dir) => {
                      setState((prev) => {
                        if (!prev) return null;
                        const tIdx = prev.plan.findIndex((t) => t.id === currentTab.id);
                        if (tIdx === -1) return prev;
                        const targetExIdx = exIdx + dir;
                        if (targetExIdx < 0 || targetExIdx >= currentTab.exercises.length) return prev;
                        const newExercises = [...currentTab.exercises];
                        const temp = newExercises[exIdx];
                        newExercises[exIdx] = newExercises[targetExIdx];
                        newExercises[targetExIdx] = temp;
                        const newPlan = [...prev.plan];
                        newPlan[tIdx] = { ...currentTab, exercises: newExercises };
                        const next = { ...prev, plan: newPlan };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onAddSubEx={() => {
                      setState((prev) => {
                        if (!prev) return null;
                        const newPermId = generateId(); // ID Permanente per il sub-esercizio
                        const next = {
                          ...prev,
                          registryV2: {
                            ...prev.registryV2,
                            [newPermId]: { id: newPermId, name: 'Nuovo Esercizio', type: 'weight' as const }
                          },
                          plan: prev.plan.map((t) =>
                            t.id === currentTab.id
                              ? {
                                  ...t,
                                  exercises: t.exercises.map((e) => {
                                    if (e.id === ex.id && e.type === 'superset') {
                                      return {
                                        ...e,
                                        exercises: [
                                          ...e.exercises,
                                          {
                                            id: generateId(), // ID Istanza
                                            exerciseId: newPermId,
                                            name: 'Nuovo Esercizio',
                                            reps: '10',
                                            pause: 0,
                                            metricType: 'weight' as const
                                          }
                                        ]
                                      };
                                    }
                                    return e;
                                    })
                                }
                              : t
                          )
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onAddRestBlock={() => {
                      setState((prev) => {
                        if (!prev) return null;
                        const next = {
                          ...prev,
                          plan: prev.plan.map((t) =>
                            t.id === currentTab.id
                              ? {
                                  ...t,
                                  exercises: t.exercises.map((e) => {
                                    if (e.id === ex.id && e.type === 'superset') {
                                      return {
                                        ...e,
                                        exercises: [
                                          ...e.exercises,
                                          {
                                            id: generateId(),
                                            name: 'Pausa',
                                            metricType: 'rest' as const,
                                            restSeconds: 30
                                          }
                                        ]
                                      };
                                    }
                                    return e;
                                  })
                                }
                              : t
                          )
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onUpdateSubEx={(subId, field, val) => {
                      setState((prev) => {
                        if (!prev) return null;

                        // Trova il sub-esercizio per prendere il suo exerciseId
                        const circuit = currentTab.exercises.find(e => e.id === ex.id) as SupersetExercise;
                        const subEx = circuit?.exercises.find(s => s.id === subId);
                        
                        let nextRegistry = prev.registryV2;
                        if (subEx && subEx.exerciseId && (field === 'name' || field === 'metricType')) {
                          const existingReg = nextRegistry[subEx.exerciseId];
                          if (existingReg) {
                            nextRegistry = {
                              ...nextRegistry,
                              [subEx.exerciseId]: {
                                ...existingReg,
                                [field === 'metricType' ? 'type' : 'name']: val
                              }
                            };
                          }
                        }

                        const next = {
                          ...prev,
                          registryV2: nextRegistry,
                          plan: prev.plan.map((t) =>
                            t.id === currentTab.id
                              ? {
                                  ...t,
                                  exercises: t.exercises.map((e) => {
                                    if (e.id === ex.id && e.type === 'superset') {
                                      return {
                                        ...e,
                                        exercises: e.exercises.map((s) =>
                                          s.id === subId ? { ...s, [field]: val } : s
                                        )
                                      };
                                    }
                                    return e;
                                  })
                                }
                              : t
                          )
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onDeleteSubEx={(subId) => {
                      setState((prev) => {
                        if (!prev) return null;
                        const next = { ...prev };
                        cleanupOrphanDataForId(next, subId); // 🔴 Eliminazione Dati
                        next.plan = next.plan.map((t) =>
                          t.id === currentTab.id
                            ? {
                                ...t,
                                exercises: t.exercises.map((e) => {
                                  if (e.id === ex.id && e.type === 'superset') {
                                    return {
                                      ...e,
                                      exercises: e.exercises.filter((s) => s.id !== subId)
                                    };
                                  }
                                  return e;
                                })
                              }
                            : t
                        );
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                    onMoveSubEx={(subId, dir) => {
                      setState((prev) => {
                        if (!prev) return null;
                        const next = {
                          ...prev,
                          plan: prev.plan.map((t) => {
                            if (t.id !== currentTab.id) return t;
                            return {
                              ...t,
                              exercises: t.exercises.map((e) => {
                                if (e.id !== ex.id || e.type !== 'superset') return e;
                                const subIdx = e.exercises.findIndex((s) => s.id === subId);
                                if (subIdx === -1) return e;
                                const targetSubIdx = subIdx + dir;
                                if (targetSubIdx < 0 || targetSubIdx >= e.exercises.length) return e;
                                const newSubs = [...e.exercises];
                                const temp = newSubs[subIdx];
                                newSubs[subIdx] = newSubs[targetSubIdx];
                                newSubs[targetSubIdx] = temp;
                                return { ...e, exercises: newSubs };
                              })
                            };
                          })
                        };
                        saveGymState(next).catch(console.warn);
                        return next;
                      });
                    }}
                  />
                );
              }
            })}

            {/* Add exercise buttons in edit mode */}
            {state.isEditMode && (
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const newPermId = generateId(); // ID Permanente (Registro)
                    const newEx: SingleExercise = {
                      id: generateId(), // ID Istanza (Scheda)
                      exerciseId: newPermId,
                      type: 'single',
                      name: 'Nuovo Esercizio',
                      sets: 3,
                      reps: '10',
                      pause: 90,
                      metricType: 'weight' as const
                    };
                    setState((prev) => {
                      if (!prev) return null;
                      const next: AppState = {
                        ...prev,
                        registryV2: {
                          ...prev.registryV2,
                          [newPermId]: { id: newPermId, name: 'Nuovo Esercizio', type: 'weight' as const }
                        },
                        plan: prev.plan.map((t) =>
                          t.id === currentTab.id ? { ...t, exercises: [...t.exercises, newEx] } : t
                        )
                      };
                      saveGymState(next).catch(console.warn);
                      return next;
                    });
                  }}
                  className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-100 py-4 rounded-3xl font-bold border border-zinc-800/80 flex items-center justify-center gap-2 text-xs transition-all shadow-sm active:scale-95"
                >
                  <i className="fa-solid fa-plus text-emerald-400" /> Aggiungi Singolo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newCirc: SupersetExercise = {
                      id: generateId(),
                      type: 'superset',
                      structureType: 'classic',
                      name: 'Nuovo Circuito',
                      rounds: 3,
                      pause: 90,
                      exercises: []
                    };
                    setState((prev) => {
                      if (!prev) return null;
                      const next = {
                        ...prev,
                        plan: prev.plan.map((t) =>
                          t.id === currentTab.id ? { ...t, exercises: [...t.exercises, newCirc] } : t
                        )
                      };
                      saveGymState(next).catch(console.warn);
                      return next;
                    });
                  }}
                  className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-100 py-4 rounded-3xl font-bold border border-zinc-800/80 flex items-center justify-center gap-2 text-xs transition-all shadow-sm active:scale-95"
                >
                  <i className="fa-solid fa-plus text-amber-400" /> Aggiungi Circuito
                </button>
              </div>
            )}

            {/* Active workout finish & reset actions */}
            {isWorkoutActive && !state.isEditMode && (
              <div className="pt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleStopWorkout(currentTab.id)}
                  className={`w-full py-4 rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] ${
                    isSaving
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" /> Salvataggio in corso...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-flag-checkered" /> Termina Allenamento
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleResetSession(currentTab.id)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs font-semibold py-3 transition-colors flex items-center gap-1.5 mt-2"
                >
                  <i className="fa-solid fa-rotate-left" /> Ricomincia sessione di oggi
                </button>
              </div>
            )}

            {currentTab.exercises.length === 0 && !state.isEditMode && (
              <div className="text-zinc-500 text-center py-16 text-xs">
                Questa scheda è vuota.
                <br />
                Apri il menu e attiva <b className="text-zinc-300">Modifica</b> per aggiungere esercizi.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Side Menu Drawer */}
      <SideMenu
        isOpen={isSideMenuOpen}
        state={state}
        onClose={() => setIsSideMenuOpen(false)}
        onToggleEditMode={() => setState((prev) => (prev ? { ...prev, isEditMode: !prev.isEditMode } : null))}
        onUpdateProfileName={(name) => setState((prev) => (prev ? { ...prev, profileName: name } : null))}
        onSetBodyGoal={(goal) => {
          setState((prev) => {
            if (!prev) return null;
            const next = { ...prev, bodyGoal: goal };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onToggleDeload={() => {
          setState((prev) => {
            if (!prev) return null;
            const next = { ...prev, deloadActive: !prev.deloadActive };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onUpdateBodyMetrics={(m) => {
          setState((prev) => {
            if (!prev) return null;
            const updated = { ...prev.bodyMetrics, ...m };
            const hist = [...prev.bodyMetricsHistory];
            const todayStr = getTodayStr();
            const now = Date.now();

            const existingIndex = hist.findIndex(h => h.date === todayStr);
            const ex = existingIndex >= 0 ? hist[existingIndex] : null;

            const entry: BodyMetricHistoryEntry = {
              date: todayStr,
              weight: m.weight !== undefined ? m.weight : (ex?.weight ?? ''),
              height: m.height !== undefined ? m.height : (ex?.height ?? prev.bodyMetrics.height),
              fm: m.fm !== undefined ? m.fm : (ex?.fm ?? ''),
              ffm: m.ffm !== undefined ? m.ffm : (ex?.ffm ?? ''),
              createdAt: now
            };

            if (existingIndex >= 0) {
              hist[existingIndex] = { ...hist[existingIndex], ...entry, createdAt: entry.createdAt };
            } else {
              hist.unshift(entry);
            }

            hist.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const next = { ...prev, bodyMetrics: updated, bodyMetricsHistory: hist };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onUploadPdf={handlePdfUpload}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onOpenPRModal={() => setIsPRModalOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* Effort Modal (RIR / RPE) */}
      <EffortModal
        isOpen={Boolean(effortTarget)}
        isRpe={Boolean(effortTarget?.isRpe)}
        currentValue={effortTarget ? (effortTarget.isRpe ? state.setRpe[effortTarget.setId] || '' : state.setRir[effortTarget.setId] || '') : ''}
        onSelect={async (val) => {
          if (!effortTarget) return;
          const { setId, isRpe } = effortTarget;
          setState((prev) => {
            if (!prev) return null;
            const next = {
              ...prev,
              setRir: !isRpe ? { ...prev.setRir, [setId]: val } : prev.setRir,
              setRpe: isRpe ? { ...prev.setRpe, [setId]: val } : prev.setRpe
            };
            saveGymState(next).catch(console.warn);
            return next;
          });
          setEffortTarget(null);
        }}
        onClose={() => setEffortTarget(null)}
      />

      {/* Summary Modal */}
      <SummaryModal
        isOpen={Boolean(summaryData)}
        newSnapshot={summaryData?.newSnapshot || null}
        previousSnapshot={summaryData?.prevSnapshot || null}
        state={state}
        onClose={() => setSummaryData(null)}
      />

      {/* Reps Modal */}
      <RepsModal
        isOpen={Boolean(repsModalTarget)}
        exerciseName={repsModalTarget?.exerciseName}
        setIndex={repsModalTarget?.setIndex ?? 0}
        initialReps={repsModalTarget?.initialReps ?? 10}
        onConfirm={handleConfirmRepsModal}
        onClose={() => setRepsModalTarget(null)}
      />

      {/* BIA Review Modal */}
      <BiaModal
        isOpen={Boolean(biaModalData)}
        data={biaModalData}
        onConfirm={async (confirmed) => {
          setState((prev) => {
            if (!prev) return null;
            const nextMetrics = {
              weight: confirmed.weight,
              height: confirmed.height || prev.bodyMetrics.height,
              fm: confirmed.fm,
              ffm: confirmed.ffm
            };
            const hist = [...prev.bodyMetricsHistory];
            const dateStr = confirmed.date || getTodayStr();
            const now = Date.now();

            const entry: BodyMetricHistoryEntry = {
              date: dateStr,
              weight: confirmed.weight,
              height: confirmed.height || prev.bodyMetrics.height,
              fm: confirmed.fm,
              ffm: confirmed.ffm,
              createdAt: now
            };

            const existingIndex = hist.findIndex(h => h.date === entry.date);
            if (existingIndex >= 0) {
              hist[existingIndex] = { ...hist[existingIndex], ...entry, createdAt: entry.createdAt };
            } else {
              hist.unshift(entry);
            }

            hist.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const next = { ...prev, bodyMetrics: nextMetrics, bodyMetricsHistory: hist };
            saveGymState(next).catch(console.warn);
            return next;
          });
          setBiaModalData(null);
          showToast('Referto BIA salvato nello storico!');
        }}
        onClose={() => setBiaModalData(null)}
      />

      {/* PR Modal */}
      <PRModal
        isOpen={isPRModalOpen}
        prs={state.prs}
        onAddPR={(newPR) => {
          setState((prev) => {
            if (!prev) return null;
            const next = { ...prev, prs: [...prev.prs, newPR] };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onUpdatePR={(id, newW) => {
          setState((prev) => {
            if (!prev) return null;
            const todayStr = getTodayStr();
            const next = {
              ...prev,
              prs: prev.prs.map((p) => {
                if (p.id !== id) return p;
                const newHistory = [...(p.history || [])];
                if (newHistory.length > 0 && newHistory[0]?.date === todayStr) {
                  newHistory[0] = { ...newHistory[0], weight: newW };
                } else {
                  newHistory.unshift({ date: todayStr, weight: newW });
                }
                return {
                  ...p,
                  weight: newW,
                  history: newHistory
                };
              })
            };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onDeletePR={(id) => {
          setState((prev) => {
            if (!prev) return null;
            const next = { ...prev, prs: prev.prs.filter((p) => p.id !== id) };
            saveGymState(next).catch(console.warn);
            return next;
          });
        }}
        onClose={() => setIsPRModalOpen(false)}
      />

      {/* Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onExport={handleExportBackup}
        onImport={handleImportBackup}
        onClose={() => setIsSyncModalOpen(false)}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        historyV2={state.sessionsV2 || []}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Video Modal */}
      <VideoModal url={videoModalUrl} onClose={() => setVideoModalUrl(null)} />
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppState,
  BodyGoal,
  SingleExercise,
  SupersetExercise
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
import { RestTimerBubble } from './components/RestTimerBubble';
import { EffortModal } from './components/EffortModal';
import { SummaryModal } from './components/SummaryModal';
import { BiaModal } from './components/BiaModal';
import { PRModal } from './components/PRModal';
import { SyncModal } from './components/SyncModal';
import { HistoryModal } from './components/HistoryModal';
import { VideoModal } from './components/VideoModal';

// 🔴 NUOVO: La Funzione Protettrice. Pulisce l'input da lettere, virgole e numeri negativi
const sanitizeNumericInput = (val: string | number): string => {
  if (val === undefined || val === null) return '';
  
  // 1. Sostituisce la virgola col punto e rimuove TUTTO ciò che non è numero o punto
  let cleaned = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
  
  // 2. Se è vuoto o c'è solo un punto, restituisce stringa vuota
  if (cleaned === '' || cleaned === '.') return '';
  
  // 3. Converte in numero e impedisce che sia minore di zero
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) ? Math.max(0, parsed).toString() : '';
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

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Rest Timer Bubble
  const [restTimerSeconds, setRestTimerSeconds] = useState(0);
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const restTimerCallbackRef = useRef<(() => void) | null>(null);
  const restTimerIntervalRef = useRef<number | null>(null);

  // Inline Timers (for time-based exercises like plank)
  const [activeInlineTimers, setActiveInlineTimers] = useState<Record<string, number>>({});
  const inlineTimerIntervalsRef = useRef<Record<string, number>>({});

  // Master Timers (for EMOM / AMRAP)
  const [activeMasterTimer, setActiveMasterTimer] = useState<{
    circuitId: string;
    type: 'emom' | 'amrap';
    remainingSec: number;
    intervalSec?: number;
    activeEmomRound?: number;
    totalRounds?: number;
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
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // ignore
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
      // 🔴 FASE I: Immutabilità garantita tramite copia profonda pulita
      return {
        ...prev,
        weights: {
          ...prev.weights,
          [id]: cleanVal
        }
      };
    });
  }, []);

  const handleSaveSetWeight = useCallback((setId: string, val: string | number) => {
    const cleanVal = sanitizeNumericInput(val);

    setState((prev) => {
      if (!prev) return null;
      const lastDashIndex = setId.lastIndexOf('-');
      const exId = lastDashIndex > 0 ? setId.substring(0, lastDashIndex) : setId;

      const nextState = {
        ...prev,
        setWeights: {
          ...prev.setWeights,
          [setId]: cleanVal
        }
      };

      updateExerciseHistory(nextState, exId);
      calculateVolumeAndLoad(nextState);
      return nextState;
    });
  }, []);

  // 🔴 NUOVO: Salvataggio campi cardio avanzati (Velocità, Inclinazione, ecc.)
  const handleSaveCustomField = useCallback((setId: string, fieldId: string, val: string) => {
    setState((prev) => {
      if (!prev) return null;
      const allFields = prev.setCustomFields || {};
      const currentFields = allFields[setId] || {};
      const next = {
        ...prev,
        setCustomFields: {
          ...allFields,
          [setId]: { ...currentFields, [fieldId]: val }
        }
      };
      return next;
    });
  }, []);


  // 🔴 1. Mantiene stateRef sempre sincronizzato in modo silenzioso
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 🔴 2. Gestisce gli eventi di sistema una sola volta all'avvio
  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        const curTab = stateRef.current?.activeTab;
        const active = curTab && stateRef.current?.activeWorkouts[curTab]?.active;
        if (active && !wakeLockRef.current) requestWakeLock();
      } else if (document.visibilityState === 'hidden' && stateRef.current) {
        saveGymState(stateRef.current);
      }
    };

    const handlePageHide = () => {
      if (stateRef.current) saveGymState(stateRef.current);
    };

    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [requestWakeLock]); // Rimosso 'state' dalle dipendenze!

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
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
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
    if (nextState.weightHistory) delete nextState.weightHistory[targetId];
    if (nextState.exerciseNameRegistry) delete nextState.exerciseNameRegistry[targetId];

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

    setActiveInlineTimers((prev) => {
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
    delete nextState.amrapRounds[circuit.id];

    Object.keys(nextState.checkedSets).forEach((key) => {
      if (key.startsWith(`${circuit.id}-round-`)) {
        delete nextState.checkedSets[key];
      }
    });

    circuit.exercises.forEach((sub) => {
      cleanupOrphanDataForId(nextState, sub.id);
    });

    // 🔴 FASE 2: Pulizia Timer Fantasma
    if (activeMasterTimer?.circuitId === circuit.id) {
      if (masterTimerIntervalRef.current) {
        safeClearInterval(masterTimerIntervalRef.current);
        masterTimerIntervalRef.current = null;
      }
      setActiveMasterTimer(null);
    }
  };

  // 🔴 CANONICAL V2: Volume, Carico e Storico Esercizio sono derived data calcolati da sessionsV2
  const calculateVolumeAndLoad = (_currState?: AppState) => {};
  const updateExerciseHistory = (_currState?: AppState, _targetId?: string) => {};

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
          delete newState.amrapRounds[ex.id];
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
    };

    const hasSessionToday = (newState.sessionsV2 || []).some(s => s.planId === tabId && s.date === todayStr);
    if (hasSessionToday) {
      const conf = confirm(
        'Hai già una sessione registrata oggi per questa scheda. Vuoi azzerare i set per iniziarne una nuova?'
      );
      if (conf) {
        clearSessionData();
      } else {
        return;
      }
    } else {
      // 🔴 È un giorno diverso: azzeriamo tutto automaticamente
      clearSessionData();
    }

    newState.activeWorkouts[tabId] = { active: true, startTime: Date.now() };
    await requestWakeLock();
    setState(newState);
    showToast('Allenamento iniziato! 🔥');
  };

  // 🔴 FASE 2: Debounce/Lock con Try-Finally
  const handleStopWorkout = async (tabId: string) => {
    if (!state || isSaving) return;
    
    setIsSaving(true);
    try {
      const currentTab = state.plan.find((t) => t.id === tabId);
      if (!currentTab) return;

      skipRestTimer();
      releaseWakeLock();

      const workoutState = state.activeWorkouts[tabId] || { startTime: Date.now() };
      const diff = Date.now() - (workoutState.startTime || Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const durationStr = `${h > 0 ? `${h}h ` : ''}${m}m`;
      const todayDateStr = getTodayStr();

      let hasCheckedSets = false;
      let totalSets = 0;
      const v2Blocks: BlockSnapshotV2[] = [];

      const newState = { ...state };
      newState.activeWorkouts[tabId] = { active: false, startTime: null };

      if (!newState.registryV2) newState.registryV2 = {};
      if (!newState.sessionsV2) newState.sessionsV2 = [];

      const getOrRegisterEx = (name: string, type: any): string => {
        let regId = Object.keys(newState.registryV2!).find(
          (k) => newState.registryV2![k].name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (!regId) {
          regId = generateId();
          newState.registryV2![regId] = { id: regId, name: name.trim(), type: type || 'weight' };
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
                rawRir === '-1' || rawRir === 'CED' ? undefined : parseFloat(String(rawRir)),
                parseFloat(String(rawRpe)) || undefined
              );

              completedSets.push({
                id: generateId(),
                index: i + 1,
                ...validData,
                isCed: rawRir === '-1' || rawRir === 'CED',
                customFields: newState.setCustomFields?.[`${ex.name}-${i + 1}`] || newState.setCustomFields?.[setId] || undefined
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
            roundsToCount = (state.amrapRounds[ex.id] || 0) + 1;
          }

          const completedRounds: CircuitRoundV2[] = [];
          for (let j = 0; j < (roundsToCount || 10); j++) {
            const isDone = ex.exercises.some((sub) => state.checkedSets[`${sub.id}-${j}`]) || state.checkedSets[`${ex.id}-round-${j}`];
            if (isDone) {
              hasCheckedSets = true;
              totalSets++;
              const roundExs: ExerciseSnapshotV2[] = ex.exercises.map((sub) => {
                const setId = `${sub.id}-${j}`;
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
                  rawRir === '-1' || rawRir === 'CED' ? undefined : parseFloat(String(rawRir)),
                  parseFloat(String(rawRpe)) || undefined
                );

                return {
                  exerciseId: regId,
                  nameSnapshot: sub.name,
                  type: sub.metricType || 'weight',
                  sets: [{
                    id: generateId(),
                    index: 1,
                    ...validData,
                    isCed: rawRir === '-1' || rawRir === 'CED',
                    customFields: newState.setCustomFields?.[`${sub.name}-${j + 1}`] || newState.setCustomFields?.[setId] || undefined
                  }]
                };
              });
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
        const prevSnapshot = newState.sessionsV2.find(
          (s) => s.tabNameSnapshot === currentTab.name
        ) || null;

        const bwAtSession = parseFloat(String(newState.bodyMetrics?.weight)) || 0;
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

        // 🔴 MOTORE V2: Aggiornamento Record Personali (PR) tramite ID Permanente
        v2Blocks.forEach((block) => {
          if (!('rounds' in block) && (block.type === 'weight' || !block.type)) {
            const maxW = Math.max(...block.sets.map((s) => s.weight || 0));
            if (maxW > 0) {
              const permId = block.exerciseId;
              const existingPr = newState.prs.find((p) =>
                (permId && p.exerciseId === permId) ||
                (!p.exerciseId && p.name.trim().toLowerCase() === block.nameSnapshot.trim().toLowerCase())
              );

              if (!existingPr) {
                newState.prs.push({
                  id: generateId(),
                  exerciseId: permId,
                  name: block.nameSnapshot,
                  weight: String(maxW),
                  history: [{ date: todayDateStr, weight: String(maxW) }]
                });
              } else if (maxW > (parseFloat(existingPr.weight) || 0)) {
                existingPr.weight = String(maxW);
                existingPr.exerciseId = permId || existingPr.exerciseId;
                existingPr.name = block.nameSnapshot;
                existingPr.history.unshift({ date: todayDateStr, weight: String(maxW) });
              }
            }
          }
        });

        // Salvataggio della sessione canonica V2
        newState.sessionsV2.unshift(v2Session);

        // 🔴 PULIZIA INTERFACCIA: Svuotiamo le spunte per preparare il prossimo allenamento!
        newState.checkedSets = {};
        newState.setReps = {};
        newState.setWeights = {};
        newState.setRir = {};
        newState.setRpe = {};
        newState.setDurations = {};
        newState.setCustomFields = {};

        if (newState.allWorkoutDates && !newState.allWorkoutDates.includes(todayDateStr)) {
          newState.allWorkoutDates.push(todayDateStr);
        }
        if (newState.streakDates && newState.favoriteTabs[tabId] && !newState.streakDates.includes(todayDateStr)) {
          newState.streakDates.push(todayDateStr);
        }
        if (newState.scheduleHistoryDates) newState.scheduleHistoryDates[tabId] = new Date().toISOString();
        if (newState.schedaCompletions) newState.schedaCompletions[tabId] = (newState.schedaCompletions[tabId] || 0) + 1;

        calculateVolumeAndLoad(newState);
        await saveGymState(newState);
        setState(newState);
        setSummaryData({ newSnapshot: v2Session, prevSnapshot });
      } else {
        await saveGymState(newState);
        setState(newState);
        showToast('Allenamento terminato (nessuna serie registrata).');
      }
    } finally {
      setIsSaving(false); // 🔴 Rilasciamo il blocco solo a fine operazione
    }
  };

  const handleResetSession = (tabId: string) => {
    if (!state) return;
    if (confirm('Vuoi davvero azzerare la sessione odierna in questa scheda?')) {
      const newState = { ...state };
      const tab = newState.plan.find((t) => t.id === tabId);
      tab?.exercises.forEach((ex) => {
        if (ex.type === 'single') {
          for (let i = 0; i < ex.sets; i++) {
            delete newState.checkedSets[`${ex.id}-${i}`];
            delete newState.setReps[`${ex.id}-${i}`];
            delete newState.setRir[`${ex.id}-${i}`];
            delete newState.setRpe[`${ex.id}-${i}`];
          }
        } else if (ex.type === 'superset') {
          delete newState.amrapRounds[ex.id];
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
      calculateVolumeAndLoad(newState);
      setState(newState);
      showToast('Sessione riavviata.');
    }
  };

  const handleToggleSet = (
    exId: string,
    setIndex: number,
    pauseSec: number,
    prefill: { reps: string; weight: string; rir?: string; rpe?: string },
    isSub = false,
    circuitId?: string
  ) => {
    if (!state) return;
    initAudio();
    const setId = `${exId}-${setIndex}`;
    const newState = { ...state };
    const isChecked = Boolean(newState.checkedSets[setId]);

    if (isChecked) {
      delete newState.checkedSets[setId];
    } else {
      newState.checkedSets[setId] = true;
      // 🔴 Congeliamo i dati visivi pre-compilati nello stato effettivo
      if (newState.setReps[setId] === undefined) newState.setReps[setId] = prefill.reps;
      if (newState.setWeights[setId] === undefined) newState.setWeights[setId] = prefill.weight;
      if (prefill.rir !== undefined && newState.setRir[setId] === undefined) newState.setRir[setId] = prefill.rir;
      if (prefill.rpe !== undefined && newState.setRpe[setId] === undefined) newState.setRpe[setId] = prefill.rpe;

      let handledCircuitRest = false;

      if (isSub && circuitId) {
        const currentTab = newState.plan.find((t) => t.id === newState.activeTab);
        const circuit = currentTab?.exercises.find((e) => e.id === circuitId);
                 
        if (circuit && circuit.type === 'superset' && circuit.structureType === 'classic') {
          const lastRealEx = [...circuit.exercises].reverse().find((e) => e.metricType !== 'rest');
                     
          if (lastRealEx && lastRealEx.id === exId) {
            handledCircuitRest = true;
            const circuitPause = circuit.pause || 90;
            playShortBeep();
                         
            if (circuitPause > 0) {
              startRestTimer(circuitPause, () => {
                setState((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    checkedSets: { ...prev.checkedSets, [`${circuitId}-round-${setIndex}`]: true }
                  };
                });
                const circuitEl = document.getElementById(`circuit-${circuitId}`);
                circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              });
            }
          }
        }
      }

      if (!handledCircuitRest) {
        playShortBeep();
        if (pauseSec > 0) {
          startRestTimer(pauseSec, () => {
            if (circuitId) {
              const circuitEl = document.getElementById(`circuit-${circuitId}`);
              circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }
      }
    }

    updateExerciseHistory(newState, exId);
    calculateVolumeAndLoad(newState);
    setState(newState);
  };

  const handleLongPressSet = (
    exId: string,
    setIndex: number,
    pauseSec: number,
    prefill: { reps: string; weight: string; rir?: string; rpe?: string },
    circuitId?: string
  ) => {
    if (!state) return;
    const setId = `${exId}-${setIndex}`;
    const currentVal = state.setReps[setId] ?? prefill.reps;
    const input = prompt('Quante ripetizioni hai eseguito davvero?', currentVal);
         
    if (input !== null && input.trim() !== '') {
      const parsed = Math.max(0, parseInt(input)); 
      if (!isNaN(parsed)) {
        const newState = { ...state };
        newState.setReps[setId] = parsed.toString();
        // 🔴 Congeliamo i pesi e gli sforzi pre-compilati insieme alle nuove reps
        if (newState.setWeights[setId] === undefined) newState.setWeights[setId] = prefill.weight;
        if (prefill.rir !== undefined && newState.setRir[setId] === undefined) newState.setRir[setId] = prefill.rir;
        if (prefill.rpe !== undefined && newState.setRpe[setId] === undefined) newState.setRpe[setId] = prefill.rpe;
        newState.checkedSets[setId] = true;

        let handledCircuitRest = false;

        if (circuitId) {
          const currentTab = newState.plan.find((t) => t.id === newState.activeTab);
          const circuit = currentTab?.exercises.find((e) => e.id === circuitId);
                     
          if (circuit && circuit.type === 'superset' && circuit.structureType === 'classic') {
            const lastRealEx = [...circuit.exercises].reverse().find((e) => e.metricType !== 'rest');
                             
            if (lastRealEx && lastRealEx.id === exId) {
              handledCircuitRest = true;
              const circuitPause = circuit.pause || 90;
                                 
              if (circuitPause > 0) {
                startRestTimer(circuitPause, () => {
                  setState((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      checkedSets: { ...prev.checkedSets, [`${circuitId}-round-${setIndex}`]: true }
                    };
                  });
                  const circuitEl = document.getElementById(`circuit-${circuitId}`);
                  circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
              }
            }
          }
        }

        if (!handledCircuitRest && pauseSec > 0) {
          startRestTimer(pauseSec, () => {
            if (circuitId) {
              const circuitEl = document.getElementById(`circuit-${circuitId}`);
              circuitEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        }

        updateExerciseHistory(newState, exId);
        calculateVolumeAndLoad(newState);
        setState(newState);
      }
    }
  };

  const handleRunInlineTimer = (
    setId: string, 
    durationSec: number, 
    pauseSec: number, 
    prefill: { weight: string; rir?: string; rpe?: string }
  ) => {
    if (!state) return;
    initAudio();
    if (activeInlineTimers[setId]) {
      if (inlineTimerIntervalsRef.current[setId]) {
        safeClearInterval(inlineTimerIntervalsRef.current[setId]);
        delete inlineTimerIntervalsRef.current[setId];
      }
      setActiveInlineTimers((prev) => {
        const next = { ...prev };
        delete next[setId];
        return next;
      });
      return;
    }
    setActiveInlineTimers((prev) => ({ ...prev, [setId]: durationSec }));
    const endTime = Date.now() + durationSec * 1000;
    inlineTimerIntervalsRef.current[setId] = safeSetInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        safeClearInterval(inlineTimerIntervalsRef.current[setId]);
        delete inlineTimerIntervalsRef.current[setId];
        setActiveInlineTimers((prev) => {
          const next = { ...prev };
          delete next[setId];
          return next;
        });
        playTrumpet();
        setState((prev) => {
          if (!prev) return null;
          const nextState = { ...prev };
          nextState.checkedSets[setId] = true;
          // 🔴 Congeliamo i dati al termine del timer
          if (nextState.setReps[setId] === undefined) nextState.setReps[setId] = String(durationSec);
          if (nextState.setWeights[setId] === undefined) nextState.setWeights[setId] = prefill.weight;
          if (prefill.rir !== undefined && nextState.setRir[setId] === undefined) nextState.setRir[setId] = prefill.rir;
          if (prefill.rpe !== undefined && nextState.setRpe[setId] === undefined) nextState.setRpe[setId] = prefill.rpe;
          return nextState;
        });
        if (pauseSec > 0) startRestTimer(pauseSec);
      } else {
        setActiveInlineTimers((prev) => ({ ...prev, [setId]: remaining }));
      }
    }, 250);
  };

  const handleStartEmom = (circuitId: string, totalMin: number, intervalSec: number) => {
    if (activeMasterTimer && activeMasterTimer.circuitId === circuitId) {
      if (masterTimerIntervalRef.current) safeClearInterval(masterTimerIntervalRef.current);
      masterTimerIntervalRef.current = null;
      setActiveMasterTimer(null);
      return;
    }
    initAudio();
    const totalRounds = Math.ceil((totalMin * 60) / intervalSec);
    let currentRound = 0;
    let roundEndTime = Date.now() + intervalSec * 1000;
    setActiveMasterTimer({
      circuitId,
      type: 'emom',
      remainingSec: intervalSec,
      activeEmomRound: currentRound,
      totalRounds,
      intervalSec
    });
    masterTimerIntervalRef.current = safeSetInterval(() => {
      const remaining = Math.ceil((roundEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        playTrumpet();
        currentRound++;
        if (currentRound >= totalRounds) {
          if (masterTimerIntervalRef.current) safeClearInterval(masterTimerIntervalRef.current);
          masterTimerIntervalRef.current = null;
          setActiveMasterTimer(null);
          showToast('EMOM Completato con successo! 🎉');
        } else {
          roundEndTime = Date.now() + intervalSec * 1000;
          setActiveMasterTimer({
            circuitId,
            type: 'emom',
            remainingSec: intervalSec,
            activeEmomRound: currentRound,
            totalRounds,
            intervalSec
          });
        }
      } else {
        setActiveMasterTimer((prev) => (prev ? { ...prev, remainingSec: remaining } : null));
      }
    }, 250);
  };

  const handleStartAmrap = (circuitId: string, totalMin: number) => {
    if (activeMasterTimer && activeMasterTimer.circuitId === circuitId) {
      if (masterTimerIntervalRef.current) safeClearInterval(masterTimerIntervalRef.current);
      masterTimerIntervalRef.current = null;
      setActiveMasterTimer(null);
      return;
    }
    initAudio();
    const duration = totalMin * 60;
    const endTime = Date.now() + duration * 1000;
    setActiveMasterTimer({
      circuitId,
      type: 'amrap',
      remainingSec: duration
    });
    masterTimerIntervalRef.current = safeSetInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        if (masterTimerIntervalRef.current) safeClearInterval(masterTimerIntervalRef.current);
        masterTimerIntervalRef.current = null;
        setActiveMasterTimer(null);
        playTrumpet();
        showToast('AMRAP Terminato!');
      } else {
        setActiveMasterTimer((prev) => (prev ? { ...prev, remainingSec: remaining } : null));
      }
    }, 250);
  };

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
      await saveGymState(parsed);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans pb-16">
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

      {/* Floating Rest Timer Bubble */}
      <RestTimerBubble
        isActive={isRestTimerActive}
        remainingSeconds={restTimerSeconds}
        onSkip={skipRestTimer}
      />

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
            return { ...prev, plan: newPlan };
          });
        }}
        onDeleteTab={(id) => {
          if (state.plan.length <= 2) {
            showToast('Impossibile eliminare l&apos;unica scheda.');
            return;
          }
          if (confirm('Eliminare questa scheda e tutti i suoi esercizi?')) {
            setState((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                plan: prev.plan.filter((t) => t.id !== id),
                activeTab: 'home'
              };
            });
          }
        }}
        onRenameTab={(id, name) => {
          setState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              plan: prev.plan.map((t) => (t.id === id ? { ...t, name } : t))
            };
          });
        }}
        onAddTab={() => {
          const newId = `scheda-${generateId()}`;
          setState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              plan: [...prev.plan, { id: newId, name: 'Nuova Scheda', subtitle: '', exercises: [] }],
              activeTab: newId
            };
          });
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 w-full max-w-2xl mx-auto">
        {isHomeTab ? (
          <HomeDashboard
            state={state}
            onSelectTab={handleSelectTab}
            onAddFirstTab={() => {
              const newId = `scheda-${generateId()}`;
              setState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  plan: [...prev.plan, { id: newId, name: 'Scheda 1', subtitle: 'La mia scheda', exercises: [] }],
                  activeTab: newId,
                  isEditMode: true
                };
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
                  onClick={() => setState((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      isEditMode: false,
                      // 🔴 FASE E: Incrementiamo la versione della scheda appena modificata
                      plan: prev.plan.map(t =>
                        t.id === currentTab.id ? { ...t, version: (t.version || 1) + 1 } : t
                      )
                    };
                  })}
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
                    index={exIdx + 1}
                    isFirst={isFirst}
                    isLast={isLast}
                    isWorkoutActive={isWorkoutActive}
                    isEditMode={state.isEditMode}
                    state={state}
                    activeInlineTimerSec={activeInlineTimers}
                    onOpenVideo={(url) => setVideoModalUrl(url)}
                    onOpenEffortModal={(setId, isRpe) => setEffortTarget({ setId, isRpe })}
                    onRunInlineTimer={(setId, dur, pauseSec, prefill) => 
                      handleRunInlineTimer(setId, dur, pauseSec, prefill)
                    }
                    onSaveWeight={(val) => handleSaveWeight(ex.id, val)}
                    onSaveSetWeight={handleSaveSetWeight}
                    onSaveCustomField={handleSaveCustomField} // 🔴 AGGIUNGI QUESTA RIGA QUI
                    onToggleSet={(sIdx, pauseSec, prefill) =>
                      handleToggleSet(ex.id, sIdx, pauseSec, prefill)
                    }
                    onLongPressSet={(sIdx, pauseSec, prefill) =>
                      handleLongPressSet(ex.id, sIdx, pauseSec, prefill)
                    }
                    onUpdateEx={(field, val) => {
                      setState((prev) => {
                        if (!prev) return null;
                        return {
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
                        return { ...prev, plan: newPlan };
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
                    isMasterTimerRunning={activeMasterTimer?.circuitId === ex.id}
                    masterTimerRemainingSec={activeMasterTimer?.remainingSec || 0}
                    activeEmomRound={activeMasterTimer?.activeEmomRound ?? -1}
                    onOpenVideo={(url) => setVideoModalUrl(url)}
                    onOpenEffortModal={(setId, isRpe) => setEffortTarget({ setId, isRpe })}
                    onStartAmrapTimer={(min) => handleStartAmrap(ex.id, min)}
                    onStartEmomTimer={(min, sec) => handleStartEmom(ex.id, min, sec)}
                    onAddAmrapRound={() => {
                      setState((prev) => {
                        if (!prev) return null;
                        const cur = prev.amrapRounds[ex.id] || 0;
                        const next = {
                          ...prev,
                          amrapRounds: { ...prev.amrapRounds, [ex.id]: cur + 1 }
                        };
                        calculateVolumeAndLoad(next);
                        return next;
                      });
                    }}
                    onStartRoundRest={(sec, roundIdx) => {
                      const roundKey = `${ex.id}-round-${roundIdx}`;
                      if (state.checkedSets[roundKey]) {
                        setState((prev) => {
                          if (!prev) return null;
                          const nextSets = { ...prev.checkedSets };
                          delete nextSets[roundKey];
                          return { ...prev, checkedSets: nextSets };
                        });
                      } else {
                        startRestTimer(sec, () => {
                          setState((prev) => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              checkedSets: { ...prev.checkedSets, [roundKey]: true }
                            };
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
                        return {
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
                        return { ...prev, plan: newPlan };
                      });
                    }}
                    onAddSubEx={() => {
                      setState((prev) => {
                        if (!prev) return null;
                        return {
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
                                            name: 'Nuovo Esercizio',
                                            reps: '10',
                                            pause: 0,
                                            metricType: 'weight'
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
                      });
                    }}
                    onAddRestBlock={() => {
                      setState((prev) => {
                        if (!prev) return null;
                        return {
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
                                            metricType: 'rest',
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
                      });
                    }}
                    onUpdateSubEx={(subId, field, val) => {
                      setState((prev) => {
                        if (!prev) return null;
                        return {
                          ...prev,
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
                        return next;
                      });
                    }}
                    onMoveSubEx={(subId, dir) => {
                      setState((prev) => {
                        if (!prev) return null;
                        return {
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
                    const newEx: SingleExercise = {
                      id: generateId(),
                      type: 'single',
                      name: 'Nuovo Esercizio',
                      sets: 3,
                      reps: '10',
                      pause: 90,
                      metricType: 'weight'
                    };
                    setState((prev) => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        plan: prev.plan.map((t) =>
                          t.id === currentTab.id ? { ...t, exercises: [...t.exercises, newEx] } : t
                        )
                      };
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
                      return {
                        ...prev,
                        plan: prev.plan.map((t) =>
                          t.id === currentTab.id ? { ...t, exercises: [...t.exercises, newCirc] } : t
                        )
                      };
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
        onSetBodyGoal={(goal) => setState((prev) => (prev ? { ...prev, bodyGoal: goal } : null))}
        onToggleDeload={() => setState((prev) => (prev ? { ...prev, deloadActive: !prev.deloadActive } : null))}
        onUpdateBodyMetrics={(m) => {
          setState((prev) => {
            if (!prev) return null;
            const updated = { ...prev.bodyMetrics, ...m };
            const hist = [...prev.bodyMetricsHistory];
            const todayStr = getTodayStr();
            const existingIdx = hist.findIndex((h) => h.date === todayStr);

            // 🔴 BUG FIX BIA: Se mi peso e basta, NON copio la FM del mese scorso.
            const oldEntry = existingIdx >= 0 ? hist[existingIdx] : null;
            const entry = {
              date: todayStr,
              weight: m.weight !== undefined ? m.weight : (oldEntry?.weight || ''),
              height: m.height !== undefined ? m.height : (oldEntry?.height || prev.bodyMetrics.height),
              fm: m.fm !== undefined ? m.fm : (oldEntry?.fm || ''), // Niente falsi positivi!
              ffm: m.ffm !== undefined ? m.ffm : (oldEntry?.ffm || '')
            };
            
            if (existingIdx >= 0) hist[existingIdx] = entry;
            else hist.unshift(entry);
            
            // 🔴 BUG FIX: Ordiniamo lo storico in modo decrescente (dal più recente)
            hist.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            return { ...prev, bodyMetrics: updated, bodyMetricsHistory: hist };
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
        onSelect={(val) => {
          if (!effortTarget) return;
          const { setId, isRpe } = effortTarget;
          setState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              setRir: !isRpe ? { ...prev.setRir, [setId]: val } : prev.setRir,
              setRpe: isRpe ? { ...prev.setRpe, [setId]: val } : prev.setRpe
            };
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
        onClose={() => setSummaryData(null)}
      />

      {/* BIA Review Modal */}
      <BiaModal
        isOpen={Boolean(biaModalData)}
        data={biaModalData}
        onConfirm={(confirmed) => {
          setState((prev) => {
            if (!prev) return null;
            const nextMetrics = {
              weight: confirmed.weight,
              height: confirmed.height,
              fm: confirmed.fm,
              ffm: confirmed.ffm
            };
            const hist = [...prev.bodyMetricsHistory];
            const dateStr = confirmed.date || getTodayStr();
            const existingIdx = hist.findIndex((h) => h.date === dateStr);
            const entry = {
              date: dateStr,
              weight: confirmed.weight,
              height: confirmed.height,
              fm: confirmed.fm,
              ffm: confirmed.ffm
            };
            if (existingIdx >= 0) hist[existingIdx] = entry;
            else {
              hist.unshift(entry);
              hist.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            }
            return { ...prev, bodyMetrics: nextMetrics, bodyMetricsHistory: hist };
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
        onAddPR={(newPR) => setState((prev) => (prev ? { ...prev, prs: [...prev.prs, newPR] } : null))}
        onUpdatePR={(id, newW) => {
          setState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              prs: prev.prs.map((p) => {
                if (p.id !== id) return p;
                return {
                  ...p,
                  weight: newW,
                  history: [{ date: getTodayStr(), weight: newW }, ...(p.history || [])]
                };
              })
            };
          });
        }}
        onDeletePR={(id) => setState((prev) => (prev ? { ...prev, prs: prev.prs.filter((p) => p.id !== id) } : null))}
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

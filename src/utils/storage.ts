// src/utils/storage.ts
import LZString from 'lz-string';
import { AppState, WorkoutTab } from '../types/gym';
import { PersistenceStatus, ExerciseDefV2, WorkoutSessionV2 } from '../types/v2';
import { storageWorker } from './storageWorker';
import { migrateV1ToV2 } from './migration';
import { runDataIntegrityCheck } from './audit';

export const TIME_VOLUME_DIVISOR = 10;

// Registro iniziale degli esercizi predefiniti con ID permanenti
export const initialRegistry: Record<string, ExerciseDefV2> = {
  'ex_bench_press': { id: 'ex_bench_press', name: 'Panca Piana Bilanciere', type: 'weight' },
  'ex_incline_db': { id: 'ex_incline_db', name: 'Spinte Manubri Panca Inclinata', type: 'weight' },
  'ex_lat_raises': { id: 'ex_lat_raises', name: 'Alzate Laterali Cavi', type: 'weight' },
  'ex_triceps_push': { id: 'ex_triceps_push', name: 'Pushdown Corda', type: 'weight' },
  'ex_lat_machine': { id: 'ex_lat_machine', name: 'Lat Machine Presa Neutra', type: 'weight' },
  'ex_cable_row': { id: 'ex_cable_row', name: 'Pulley Basso', type: 'weight' },
  'ex_biceps_curl': { id: 'ex_biceps_curl', name: 'Curl con Manubri', type: 'weight' },
  'ex_squat': { id: 'ex_squat', name: 'Squat con Bilanciere', type: 'weight' },
  'ex_leg_press': { id: 'ex_leg_press', name: 'Leg Press 45°', type: 'weight' },
  'ex_plank': { id: 'ex_plank', name: 'Plank Addominali', type: 'time' }
};

export const defaultWorkoutPlan: WorkoutTab[] = [
  { id: 'home', name: '🏠 Home', subtitle: 'Panoramica', isHome: true, exercises: [] },
  {
    id: 'scheda-push',
    name: 'Petto & Tricipiti',
    subtitle: 'Push Day - Forza & Ipertrofia',
    version: 1,
    exercises: [
      {
        id: 'bench-press',
        exerciseId: 'ex_bench_press',
        type: 'single',
        name: 'Panca Piana Bilanciere',
        sets: 4,
        reps: '8',
        pause: 120,
        metricType: 'weight',
        link: 'https://www.youtube.com/watch?v=rT7DgCr-3pg'
      },
      {
        id: 'incline-db-press',
        exerciseId: 'ex_incline_db',
        type: 'single',
        name: 'Spinte Manubri Panca Inclinata',
        sets: 3,
        reps: '10',
        pause: 90,
        metricType: 'weight',
        link: 'https://www.youtube.com/watch?v=8iPEnn-ltC8'
      },
      {
        id: 'circuit-arms',
        type: 'superset',
        structureType: 'classic',
        name: 'Superset Spalle & Braccia',
        rounds: 3,
        pause: 90,
        exercises: [
          {
            id: 'lateral-raises',
            exerciseId: 'ex_lat_raises',
            name: 'Alzate Laterali Cavi',
            reps: '12',
            pause: 30,
            metricType: 'weight'
          },
          {
            id: 'triceps-pushdown',
            exerciseId: 'ex_triceps_push',
            name: 'Pushdown Corda',
            reps: '12',
            pause: 60,
            metricType: 'weight'
          }
        ]
      }
    ]
  },
  {
    id: 'scheda-pull',
    name: 'Dorso & Bicipiti',
    subtitle: 'Pull Day',
    version: 1,
    exercises: [
      {
        id: 'lat-machine',
        exerciseId: 'ex_lat_machine',
        type: 'single',
        name: 'Lat Machine Presa Neutra',
        sets: 4,
        reps: '8-10',
        pause: 90,
        metricType: 'weight'
      },
      {
        id: 'cable-row',
        exerciseId: 'ex_cable_row',
        type: 'single',
        name: 'Pulley Basso',
        sets: 3,
        reps: '10-12',
        pause: 90,
        metricType: 'weight'
      },
      {
        id: 'biceps-curl',
        exerciseId: 'ex_biceps_curl',
        type: 'single',
        name: 'Curl con Manubri',
        sets: 3,
        reps: '10',
        pause: 60,
        metricType: 'weight'
      }
    ]
  },
  {
    id: 'scheda-legs',
    name: 'Gambe & Core',
    subtitle: 'Leg Day',
    version: 1,
    exercises: [
      {
        id: 'squat',
        exerciseId: 'ex_squat',
        type: 'single',
        name: 'Squat con Bilanciere',
        sets: 4,
        reps: '6-8',
        pause: 150,
        metricType: 'weight'
      },
      {
        id: 'leg-press',
        exerciseId: 'ex_leg_press',
        type: 'single',
        name: 'Leg Press 45°',
        sets: 3,
        reps: '10-12',
        pause: 90,
        metricType: 'weight'
      },
      {
        id: 'plank',
        exerciseId: 'ex_plank',
        type: 'single',
        name: 'Plank Addominali',
        sets: 3,
        reps: '60',
        pause: 60,
        metricType: 'time',
        workSec: 60
      }
    ]
  }
];

export const initialDefaultState: AppState = {
  schemaVersion: 2,
  revision: 1,
  profileName: '',
  plan: defaultWorkoutPlan,
  activeTab: 'home',
  isEditMode: false,
  weights: {},
  setWeights: {},
  checkedSets: {},
  setRir: {},
  setReps: {},
  setDurations: {},
  setRpe: {},
  setCustomFields: {},
  prs: [],
  activeWorkouts: {},
  bodyMetrics: { weight: '', height: '', fm: '', ffm: '' },
  bodyMetricsHistory: [],
  favoriteTabs: {},
  amrapRounds: {},
  bodyGoal: 'recomp',
  deloadActive: false,
  deloadDates: [],
  currentEffortSelection: null,
  lastBackupDate: null,

  // 🔴 CANONICAL V2 ENGINE
  registryV2: initialRegistry,
  sessionsV2: []
};

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// -------------------------------------------------------------
// GESTIONE STATO PERSISTENZA & CONCORRENZA MULTI-TAB
// -------------------------------------------------------------
let currentPersistenceStatus: PersistenceStatus = 'CLEAN';
const persistenceListeners: Array<(status: PersistenceStatus) => void> = [];

export function getPersistenceStatus(): PersistenceStatus {
  return currentPersistenceStatus;
}

export function setPersistenceStatus(status: PersistenceStatus): void {
  currentPersistenceStatus = status;
  persistenceListeners.forEach((l) => l(status));
}

export function subscribePersistenceStatus(listener: (status: PersistenceStatus) => void): () => void {
  persistenceListeners.push(listener);
  return () => {
    const idx = persistenceListeners.indexOf(listener);
    if (idx >= 0) persistenceListeners.splice(idx, 1);
  };
}

// BroadcastChannel per sincronizzazione multi-tab e prevenzione sovrascritture
const tabChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('mygym_tab_channel')
  : null;

export function onExternalTabUpdate(callback: (event: { revision: number; timestamp: number }) => void): () => void {
  if (!tabChannel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'STATE_SAVED') {
      callback({ revision: e.data.revision, timestamp: e.data.timestamp });
    }
  };
  tabChannel.addEventListener('message', handler);
  return () => tabChannel.removeEventListener('message', handler);
}

// -------------------------------------------------------------
// INDEXEDDB V3 PERSISTENCE ENGINE
// -------------------------------------------------------------
let idbDatabase: IDBDatabase | null = null;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB non supportato'));
    }
    if (idbDatabase) return resolve(idbDatabase);
    
    // Versione 3: Architettura V2 consolidata con cassetti isolati
    const req = indexedDB.open('MyGymDB', 3);
    
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('store')) db.createObjectStore('store');
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions');
      if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups');
    };
    
    req.onsuccess = (e) => {
      idbDatabase = (e.target as IDBOpenDBRequest).result;
      resolve(idbDatabase);
    };
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

/**
 * Salva uno snapshot automatico di sicurezza nel cassetto 'backups' prima di importazioni o migrazioni.
 */
export async function createSafetyBackup(state: AppState, reason: string): Promise<string> {
  try {
    const db = await initDB();
    const backupId = `backup_${Date.now()}_${generateId()}`;
    const record = {
      id: backupId,
      timestamp: Date.now(),
      reason,
      state
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['backups'], 'readwrite');
      tx.objectStore('backups').put(record, backupId);
      tx.oncomplete = () => resolve();
      tx.onerror = (err) => reject(err);
    });
    return backupId;
  } catch (err) {
    console.warn('Impossibile creare snapshot di sicurezza', err);
    return '';
  }
}

/**
 * Carica l'intero stato canonico V2 combinando lo stato leggero con lo storico immutabile.
 */
export async function saveGymState(state: AppState): Promise<void> {
  if (typeof window === 'undefined') return;
  setPersistenceStatus('SAVING');

  // Creiamo una copia della radice e aggiorniamo i metadati senza mutare l'oggetto React
  const stateToSave = {
    ...state,
    revision: (state.revision || 0) + 1,
    lastSavedAt: Date.now()
  };

  // 1. IL PARACADUTE SINCRONO
  try {
    const hotState = { ...stateToSave };
    delete (hotState as any).sessionsV2; // Escludiamo lo storico pesante
    localStorage.setItem('mygym_state', JSON.stringify(hotState));
  } catch (e) {
    console.warn('Impossibile salvare su localStorage', e);
  }

  // 2. SALVATAGGIO ASINCRONO SU INDEXEDDB (via Worker o diretto)
  try {
    const worker = storageWorker;
    if (worker) {
      await new Promise<void>((resolve, reject) => {
        const reqId = Date.now();
        const handler = (msgEv: MessageEvent) => {
          if (msgEv.data && msgEv.data.id === reqId) {
            worker.removeEventListener('message', handler);
            if (msgEv.data.success) resolve();
            else reject(new Error(msgEv.data.error || 'Errore worker'));
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ action: 'save', payload: stateToSave, id: reqId });
      });
    } else {
      const db = await initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['store', 'sessions'], 'readwrite');
        const sessions = stateToSave.sessionsV2 || [];
        const hotState = { ...stateToSave };
        delete (hotState as any).sessionsV2;
        tx.objectStore('store').put(hotState, 'state');
        tx.objectStore('sessions').put(sessions, 'history');
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject((e.target as IDBRequest).error);
      });
    }
    setPersistenceStatus('SAVED');
    if (tabChannel) {
      tabChannel.postMessage({ type: 'STATE_SAVED', revision: stateToSave.revision, timestamp: stateToSave.lastSavedAt });
    }
  } catch (err) {
    setPersistenceStatus('ERROR');
    console.error('Salvataggio su IndexedDB fallito:', err);
    throw err;
  }
}

export async function loadGymState(): Promise<AppState> {
  let loadedData: Partial<AppState> | null = null;
  
  // 1. LETTURA SINCRONA DA LOCALSTORAGE (Dati caldi di emergenza)
  try {
    const local = localStorage.getItem('mygym_state');
    if (local) loadedData = JSON.parse(local);
  } catch (e) {
    console.warn('Errore lettura localStorage', e);
  }

  // 2. LETTURA DA INDEXEDDB
  try {
    const db = await initDB();
    const idbData = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(['store', 'sessions'], 'readonly');
      let stateData: any = null;
      let sessionsData: any = null;
      const reqState = tx.objectStore('store').get('state');
      reqState.onsuccess = () => stateData = reqState.result;
      const reqSessions = tx.objectStore('sessions').get('history');
      reqSessions.onsuccess = () => sessionsData = reqSessions.result;
      tx.oncomplete = () => {
        if (stateData) {
          stateData.sessionsV2 = Array.isArray(sessionsData) ? sessionsData : [];
          resolve(stateData);
        } else {
          resolve(null);
        }
      };
      tx.onerror = (e) => reject((e.target as IDBRequest).error);
    });
    
    if (idbData) {
      if (!loadedData || (idbData.revision || 0) >= (loadedData.revision || 0)) {
         loadedData = idbData;
      } else {
         loadedData.sessionsV2 = idbData.sessionsV2 || []; // Preserviamo sempre lo storico V2 da DB
      }
    }
  } catch (err) {
    console.warn('Lettura DB fallita', err);
  }

  if (!loadedData) return JSON.parse(JSON.stringify(initialDefaultState));
  return normalizeState(loadedData);
}

/**
 * Dogana e Normalizzatore di Stato.
 * Garantisce che ogni dato sia allineato al modello canonico V2.
 * Esegue la migrazione legacy V1 -> V2 se necessario e ripulisce il runtime da strutture duplicate.
 */
export function normalizeState(parsed: any): AppState {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Formato dati non valido');
  }

  // 1. Migrazione una-tantum se i dati provengono da una versione V1
  let registry = parsed.registryV2 || parsed.registry || {};
  let sessions: WorkoutSessionV2[] = Array.isArray(parsed.sessionsV2)
    ? parsed.sessionsV2
    : Array.isArray(parsed.sessions)
    ? parsed.sessions
    : [];

  const needsMigration = (!parsed.schemaVersion || parsed.schemaVersion < 2) ||
    (!parsed.sessionsV2 && parsed.workoutSessionsHistory && parsed.workoutSessionsHistory.length > 0);

  if (needsMigration) {
    try {
      const v2Data = migrateV1ToV2(parsed);
      registry = v2Data.registry;
      sessions = v2Data.sessions;
    } catch (e) {
      console.error("Errore critico durante la migrazione V1 -> V2", e);
    }
  }

  // Assicuriamo che gli esercizi nelle schede abbiano l'exerciseId permanente
  const plan: WorkoutTab[] = Array.isArray(parsed.plan) && parsed.plan.length > 0
    ? parsed.plan
    : defaultWorkoutPlan;

  plan.forEach(tab => {
    tab.exercises.forEach(ex => {
      if (ex.type === 'single') {
        if (!ex.exerciseId) {
          const matchKey = Object.keys(registry).find(
            k => registry[k].name.trim().toLowerCase() === ex.name.trim().toLowerCase()
          );
          if (matchKey) {
            ex.exerciseId = matchKey;
          } else {
            const newId = generateId();
            registry[newId] = { id: newId, name: ex.name.trim(), type: (ex.metricType as any) || 'weight' };
            ex.exerciseId = newId;
          }
        }
      } else {
        ex.exercises.forEach(sub => {
          if (!sub.exerciseId) {
            const matchKey = Object.keys(registry).find(
              k => registry[k].name.trim().toLowerCase() === sub.name.trim().toLowerCase()
            );
            if (matchKey) {
              sub.exerciseId = matchKey;
            } else {
              const newId = generateId();
              registry[newId] = { id: newId, name: sub.name.trim(), type: (sub.metricType as any) || 'weight' };
              sub.exerciseId = newId;
            }
          }
        });
      }
    });
  });

  const normalized: AppState = {
    schemaVersion: 2,
    revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
    profileName: typeof parsed.profileName === 'string' ? parsed.profileName : '',
    plan,
    activeTab: typeof parsed.activeTab === 'string' ? parsed.activeTab : 'home',
    isEditMode: false,
    weights: parsed.weights || {},
    setWeights: parsed.setWeights || {},
    checkedSets: parsed.checkedSets || {},
    setRir: parsed.setRir || {},
    setReps: parsed.setReps || {},
    setDurations: parsed.setDurations || {},
    setRpe: parsed.setRpe || {},
    setCustomFields: parsed.setCustomFields || {},
    prs: Array.isArray(parsed.prs) ? parsed.prs : [],
    activeWorkouts: parsed.activeWorkouts || {},
    bodyMetrics: { ...initialDefaultState.bodyMetrics, ...(parsed.bodyMetrics || {}) },
    bodyMetricsHistory: Array.isArray(parsed.bodyMetricsHistory) ? parsed.bodyMetricsHistory : [],
    favoriteTabs: parsed.favoriteTabs || {},
    amrapRounds: parsed.amrapRounds || {},
    bodyGoal: parsed.bodyGoal || 'recomp',
    deloadActive: !!parsed.deloadActive,
    deloadDates: Array.isArray(parsed.deloadDates) ? parsed.deloadDates : [],
    currentEffortSelection: parsed.currentEffortSelection || null,
    lastBackupDate: parsed.lastBackupDate || null,

    // CANONICAL V2
    registryV2: registry,
    sessionsV2: sessions
  };

  return normalized;
}

/**
 * Esporta un backup compresso, versionato e provvisto di metadati di integrità.
 */
export function exportBackupString(state: AppState): string {
  // Prepariamo il payload canonico escludendo chiavi ridondanti
  const exportPayload = {
    format: 'MYGYM_CANONICAL_V2',
    appVersion: '2.0.0',
    schemaVersion: 2,
    exportedAt: Date.now(),
    state: {
      ...state,
      // Ci assicuriamo che lo stato esportato contenga la V2 canonica
      schemaVersion: 2,
      revision: state.revision || 1
    }
  };
  const plain = JSON.stringify(exportPayload);
  const compressed = LZString.compressToBase64(plain);
  return `GYM2::${compressed}`;
}

/**
 * Importa e ripristina un backup con protezione e validazione completa.
 * Supporta formati vecchi (V1) convertendoli in modo trasparente e sicuro.
 */
export function importBackupString(input: string, currentState?: AppState): AppState {
  const trimmed = input.trim();
  let parsed: any;
  
  if (trimmed.startsWith('GYM2::')) {
    const decompressed = LZString.decompressFromBase64(trimmed.substring(6));
    if (!decompressed) throw new Error('Dati compressi non validi');
    parsed = JSON.parse(decompressed);
  } else if (trimmed.startsWith('{')) {
    parsed = JSON.parse(trimmed);
  } else {
    throw new Error('Formato backup non riconosciuto');
  }

  // Estraiamo lo stato interno se il backup è nel nuovo formato container
  const rawState = parsed.format === 'MYGYM_CANONICAL_V2' && parsed.state ? parsed.state : parsed;

  // Normalizzazione e migrazione
  const normalized = normalizeState(rawState);

  // Eseguiamo il controllo di integrità prima di approvare il commit
  const audit = runDataIntegrityCheck(normalized);
  if (!audit.isHealthy) {
    const criticalErrors = audit.issues.filter(i => i.severity === 'error');
    if (criticalErrors.length > 0) {
      console.error('Errori critici di integrità nei dati importati:', criticalErrors);
      throw new Error(`Ripristino bloccato: riscontrati ${criticalErrors.length} errori critici nel backup.`);
    }
  }

  return normalized;
}

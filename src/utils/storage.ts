import LZString from 'lz-string';
import { AppState, WorkoutTab } from '../types/gym';
import { storageWorker } from './storageWorker';

export const TIME_VOLUME_DIVISOR = 10;

export const defaultWorkoutPlan: WorkoutTab[] = [
  { id: 'home', name: '🏠 Home', subtitle: 'Panoramica', isHome: true, exercises: [] },
  {
    id: 'scheda-push',
    name: 'Petto & Tricipiti',
    subtitle: 'Push Day - Forza & Ipertrofia',
    exercises: [
      {
        id: 'bench-press',
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
            name: 'Alzate Laterali Cavi',
            reps: '12',
            pause: 30,
            metricType: 'weight'
          },
          {
            id: 'triceps-pushdown',
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
    exercises: [
      {
        id: 'lat-machine',
        type: 'single',
        name: 'Lat Machine Presa Neutra',
        sets: 4,
        reps: '8-10',
        pause: 90,
        metricType: 'weight'
      },
      {
        id: 'cable-row',
        type: 'single',
        name: 'Pulley Basso',
        sets: 3,
        reps: '10-12',
        pause: 90,
        metricType: 'weight'
      },
      {
        id: 'biceps-curl',
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
    exercises: [
      {
        id: 'squat',
        type: 'single',
        name: 'Squat con Bilanciere',
        sets: 4,
        reps: '6-8',
        pause: 150,
        metricType: 'weight'
      },
      {
        id: 'leg-press',
        type: 'single',
        name: 'Leg Press 45°',
        sets: 3,
        reps: '10-12',
        pause: 90,
        metricType: 'weight'
      },
      {
        id: 'plank',
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
  profileName: '',
  plan: defaultWorkoutPlan,
  activeTab: 'home',
  isEditMode: false,
  weights: {},
  setWeights: {},
  weightHistory: {},
  checkedSets: {},
  setRir: {},
  setReps: {},
  setDurations: {},
  setRpe: {},
  setCustomFields: {},
  prs: [], // 🔴 Nessun record finto
  activeWorkouts: {},
  bodyMetrics: { weight: '', height: '', fm: '', ffm: '' },
  bodyMetricsHistory: [], // 🔴 Nessuno storico finto
  favoriteTabs: {},
  scheduleHistoryDates: {},
  streakDates: [],
  volumeLog: {},
  sessionLoadLog: {},
  allWorkoutDates: [],
  schedaCompletions: {},
  currentEffortSelection: null,
  exerciseNameRegistry: {},
  lastBackupDate: null,
  workoutSessionsHistory: [], // 🔴 Nessun allenamento di prova
  lastSessionDate: {},
  amrapRounds: {},
  bodyGoal: 'recomp',
  deloadActive: false,
  deloadDates: []
};

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  // Sottraiamo i giorni usando direttamente i metodi di calendario nativi di JavaScript.
  // In questo modo evitiamo qualsiasi problema legato all'ora legale o ai millisecondi sballati.
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

// IndexedDB Helper
let idbDatabase: IDBDatabase | null = null;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB non supportato'));
    }
    if (idbDatabase) return resolve(idbDatabase);
    
    // 🔴 Versione 2: allineata con il Web Worker
    const req = indexedDB.open('MyGymDB', 2);
    
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('store')) db.createObjectStore('store');
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions');
      if (!db.objectStoreNames.contains('weightsHistory')) db.createObjectStore('weightsHistory');
    };
    
    req.onsuccess = (e) => {
      idbDatabase = (e.target as IDBOpenDBRequest).result;
      resolve(idbDatabase);
    };
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function loadGymState(): Promise<AppState> {
  let loadedData: Partial<AppState> | null = null;
  try {
    const db = await initDB();
    loadedData = await new Promise((resolve, reject) => {
      const tx = db.transaction(['store', 'sessions', 'weightsHistory'], 'readonly');
      
      let stateData: any = null;
      let sessionsData: any = null;
      let weightsData: any = null;

      // Leggiamo i dati spezzati dai tre cassetti
      const reqState = tx.objectStore('store').get('state');
      reqState.onsuccess = () => stateData = reqState.result;

      const reqSessions = tx.objectStore('sessions').get('history');
      reqSessions.onsuccess = () => sessionsData = reqSessions.result;

      const reqWeights = tx.objectStore('weightsHistory').get('history');
      reqWeights.onsuccess = () => weightsData = reqWeights.result;

      tx.oncomplete = () => {
        if (stateData) {
            // Ricomponiamo il puzzle per l'app
            stateData.workoutSessionsHistory = sessionsData || [];
            stateData.weightHistory = weightsData || {};
            resolve(stateData);
        } else {
            resolve(null);
        }
      };
      tx.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch (err) {
    console.warn('Lettura DB fallita, avvio da zero o da cache', err);
  }

  // 🔴 Rimosso il localStorage mirror pesante su consiglio del report
  
  if (!loadedData) {
    return JSON.parse(JSON.stringify(initialDefaultState));
  }

  // Usiamo il normalizzatore anche per il caricamento iniziale!
  return normalizeState(loadedData);
}

export async function saveGymState(state: AppState): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (storageWorker) {
      // 🔴 Affidiamo il salvataggio al Worker. 
      // Zero lag visivo, il clone viene fatto in automatico dal browser in background!
      storageWorker.postMessage({ action: 'save', payload: state, id: Date.now() });
    } else {
      // Metodo di emergenza se il worker non fosse disponibile
      const plain = JSON.parse(JSON.stringify(state));
      const db = await initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['store', 'sessions', 'weightsHistory'], 'readwrite');
        
        const sessions = plain.workoutSessionsHistory || [];
        const weights = plain.weightHistory || {};
        
        delete plain.workoutSessionsHistory;
        delete plain.weightHistory;

        tx.objectStore('store').put(plain, 'state');
        tx.objectStore('sessions').put(sessions, 'history');
        tx.objectStore('weightsHistory').put(weights, 'history');
        
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject((e.target as IDBRequest).error);
      });
    }
  } catch (err) {
    console.error('Failed to save gym state', err);
  }
}

// 🔴 NUOVA FUNZIONE: "La Dogana". Controlla e ripara i dati in ingresso.
export function normalizeState(parsed: any): AppState {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Formato dati non valido');
  }

  // Forza la struttura unendo i dati caricati con i default.
  // Così, se nel backup vecchio manca "setWeights" o "setCustomFields", vengono creati vuoti senza crashare!
  const normalized: AppState = {
    ...initialDefaultState,
    ...parsed,
    setWeights: parsed.setWeights || {},
    setCustomFields: parsed.setCustomFields || {}, // Protezione per il cardio avanzato
    plan: parsed.plan && parsed.plan.length > 0 ? parsed.plan : initialDefaultState.plan,
    bodyMetrics: { ...initialDefaultState.bodyMetrics, ...(parsed.bodyMetrics || {}) },
    prs: parsed.prs || [],
    bodyMetricsHistory: parsed.bodyMetricsHistory || [],
    workoutSessionsHistory: parsed.workoutSessionsHistory || [],
    volumeLog: parsed.volumeLog || {},
    sessionLoadLog: parsed.sessionLoadLog || {},
    streakDates: parsed.streakDates || [],
    allWorkoutDates: parsed.allWorkoutDates || [],
    schedaCompletions: parsed.schedaCompletions || {},
    amrapRounds: parsed.amrapRounds || {},
    lastSessionDate: parsed.lastSessionDate || {},
    exerciseNameRegistry: parsed.exerciseNameRegistry || {},
    favoriteTabs: parsed.favoriteTabs || {},
    scheduleHistoryDates: parsed.scheduleHistoryDates || {},
    deloadDates: parsed.deloadDates || []
  };

  return normalized;
}

export function exportBackupString(state: AppState): string {
  const plain = JSON.stringify(state);
  const compressed = LZString.compressToBase64(plain);
  return `GYM2::${compressed}`;
}

export function importBackupString(input: string): AppState {
  const trimmed = input.trim();
  let parsed: unknown;
  
  if (trimmed.startsWith('GYM2::')) {
    const decompressed = LZString.decompressFromBase64(trimmed.substring(6));
    if (!decompressed) throw new Error('Dati compressi non validi');
    parsed = JSON.parse(decompressed);
  } else if (trimmed.startsWith('{')) {
    parsed = JSON.parse(trimmed);
  } else {
    throw new Error('Formato backup non riconosciuto');
  }
  
  // Applichiamo la normalizzazione prima di restituire i dati
  return normalizeState(parsed);
}

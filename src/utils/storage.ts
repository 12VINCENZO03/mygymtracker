import LZString from 'lz-string';
import { AppState, WorkoutTab } from '../types/gym';

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
  weights: {
    'bench-press': '75',
    'incline-db-press': '24',
    'lateral-raises': '8',
    'triceps-pushdown': '20',
    'lat-machine': '60',
    'cable-row': '55',
    'biceps-curl': '14',
    'squat': '90',
    'leg-press': '160'
  },
  setWeights: {}, // 🔴 NUOVO
  weightHistory: {
    'bench-press': [
      {
        date: getPastDateStr(3),
        weight: '75',
        reps: { '0': '8', '1': '8', '2': '8', '3': '8' },
        rirs: { '0': '2.5', '1': '2', '2': '1.5', '3': '1' },
        rpes: {}
      }
    ]
  },
  checkedSets: {},
  setRir: {},
  setReps: {},
  setDurations: {},
  setRpe: {},
  setCustomFields: {},
  prs: [
    { id: 'pr-1', name: 'Panca Piana Bilanciere', weight: '90', history: [{ date: getPastDateStr(14), weight: '90' }] },
    { id: 'pr-2', name: 'Squat', weight: '120', history: [{ date: getPastDateStr(21), weight: '120' }] }
  ],
  activeWorkouts: {},
  bodyMetrics: { weight: '76.5', height: '178', fm: '13.5', ffm: '66.2' },
  bodyMetricsHistory: [
    { date: getPastDateStr(30), weight: '78.0', height: '178', fm: '15.0', ffm: '66.3' },
    { date: getPastDateStr(1), weight: '76.5', height: '178', fm: '13.5', ffm: '66.2' }
  ],
  favoriteTabs: { 'scheda-push': true, 'scheda-pull': true },
  scheduleHistoryDates: { 'scheda-push': new Date(Date.now() - 3 * 86400000).toISOString() },
  streakDates: [getPastDateStr(3), getPastDateStr(1)],
  volumeLog: {
    [getPastDateStr(3)]: 6800,
    [getPastDateStr(1)]: 7200
  },
  sessionLoadLog: {
    [getPastDateStr(3)]: 480,
    [getPastDateStr(1)]: 510
  },
  allWorkoutDates: [getPastDateStr(3), getPastDateStr(1)],
  schedaCompletions: { 'scheda-push': 3, 'scheda-pull': 2 },
  currentEffortSelection: null,
  exerciseNameRegistry: {
    'bench-press': 'Panca Piana Bilanciere',
    'squat': 'Squat con Bilanciere'
  },
  lastBackupDate: getPastDateStr(2),
  workoutSessionsHistory: [
    {
      id: 'mock-session-1',
      date: getPastDateStr(3),
      time: '18:30',
      tabName: 'Petto & Tricipiti',
      tabSubtitle: 'Push Day',
      duration: '52m',
      totalSets: 10,
      exercises: [
        {
          type: 'single',
          name: 'Panca Piana Bilanciere',
          metricType: 'weight',
          targetSets: 4,
          targetReps: '8',
          pause: 120,
          sets: [
            { index: 1, reps: '8', weight: '75', rir: '2.5' },
            { index: 2, reps: '8', weight: '75', rir: '2' },
            { index: 3, reps: '8', weight: '75', rir: '1.5' },
            { index: 4, reps: '8', weight: '75', rir: '1' }
          ]
        }
      ]
    }
  ],
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
  const d = new Date(Date.now() - daysAgo * 86400000);
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
    const req = indexedDB.open('MyGymDB', 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
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
      const tx = db.transaction('store', 'readonly');
      const req = tx.objectStore('store').get('state');
      req.onsuccess = (e) => resolve((e.target as IDBRequest).result);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch (err) {
    console.warn('IDB get failed, falling back to localStorage', err);
  }

  if (!loadedData && typeof window !== 'undefined') {
    try {
      const localStr = localStorage.getItem('gymTrackerData');
      if (localStr) {
        loadedData = JSON.parse(localStr);
      }
    } catch {
      // ignore
    }
  }

  if (!loadedData) {
    return JSON.parse(JSON.stringify(initialDefaultState));
  }

  const merged: AppState = {
    ...initialDefaultState,
    ...loadedData,
    setWeights: loadedData.setWeights || {}, // 🔴 NUOVO
    plan: loadedData.plan && loadedData.plan.length > 0 ? loadedData.plan : initialDefaultState.plan,
    bodyMetrics: { ...initialDefaultState.bodyMetrics, ...(loadedData.bodyMetrics || {}) },
    prs: loadedData.prs || [],
    bodyMetricsHistory: loadedData.bodyMetricsHistory || [],
    workoutSessionsHistory: loadedData.workoutSessionsHistory || [],
    volumeLog: loadedData.volumeLog || {},
    sessionLoadLog: loadedData.sessionLoadLog || {},
    streakDates: loadedData.streakDates || [],
    allWorkoutDates: loadedData.allWorkoutDates || [],
    schedaCompletions: loadedData.schedaCompletions || {},
    amrapRounds: loadedData.amrapRounds || {},
    lastSessionDate: loadedData.lastSessionDate || {},
    exerciseNameRegistry: loadedData.exerciseNameRegistry || {},
    favoriteTabs: loadedData.favoriteTabs || {},
    scheduleHistoryDates: loadedData.scheduleHistoryDates || {},
    deloadDates: loadedData.deloadDates || []
  };

  return merged;
}

export async function saveGymState(state: AppState): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const plain = JSON.parse(JSON.stringify(state));
    try {
      localStorage.setItem('gymTrackerData', JSON.stringify(plain));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('store', 'readwrite');
      const req = tx.objectStore('store').put(plain, 'state');
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch (err) {
    console.error('Failed to save gym state', err);
  }
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

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Dati non validi');
  }

  return parsed as AppState;
}

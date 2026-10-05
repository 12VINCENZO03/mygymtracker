import { ExerciseDefV2, WorkoutSessionV2 } from './v2';

export type MetricType = 'weight' | 'bodyweight' | 'time' | 'cardio' | 'rest';

export type CircuitStructure = 'classic' | 'emom' | 'amrap';

export type BodyGoal = 'cut' | 'recomp' | 'bulk' | null;

export interface CardioField {
  id: string;
  label: string;
  unit: string;
}

export interface CardioBlock {
  id: string;
  durationSec: number;
  fields: Record<string, string>;
  triggerType: 'duration' | 'manual';
}

export interface SingleExercise {
  id: string;
  exerciseId?: string; // 🔴 CANONICAL V2: ID permanente collegato al Registro
  type: 'single';
  name: string;
  sets: number;
  reps: string;
  pause: number;
  metricType: MetricType;
  link?: string;
  videoUrl?: string;
  workSec?: number;
  cardioMachine?: string;
  repeatSequence?: number;
  cardioFields?: CardioField[];
  cardioBlocks?: CardioBlock[];
}

export interface SubExercise {
  id: string;
  exerciseId?: string; // 🔴 CANONICAL V2: ID permanente collegato al Registro
  name: string;
  reps?: string;
  pause?: number;
  metricType: MetricType;
  link?: string;
  videoUrl?: string;
  workSec?: number;
  restSeconds?: number;
  cardioMachine?: string;
  repeatSequence?: number;
  cardioFields?: CardioField[];
  cardioBlocks?: CardioBlock[];
}

export interface SupersetExercise {
  id: string;
  type: 'superset';
  structureType: CircuitStructure;
  name: string;
  rounds?: number;
  pause?: number;
  previousPause?: number;
  emomTotalMin?: number;
  emomIntervalSec?: number;
  amrapTotalMin?: number;
  exercises: SubExercise[];
}

export type ExerciseItem = SingleExercise | SupersetExercise;

export interface WorkoutTab {
  id: string;
  name: string;
  subtitle?: string;
  isHome?: boolean;
  version?: number; // 🔴 FASE E: Plan Versioning
  exercises: ExerciseItem[];
}

export interface WeightHistoryEntry {
  date: string;
  weight: string;
  weights?: Record<string, string>; // 🔴 NUOVO: Pesi per singola serie
  reps: Record<string, string>;
  rirs: Record<string, string>;
  rpes: Record<string, string>;
  durations?: Record<string, string>;
  customFields?: Record<string, Record<string, string>>;
}

export interface BodyMetrics {
  weight: string | number;
  height: string | number;
  fm: string | number;
  ffm: string | number;
}

export interface BodyMetricHistoryEntry {
  date: string;
  weight: string | number;
  height: string | number;
  fm: string | number;
  ffm: string | number;
  createdAt?: number;
}

export interface PRRecord {
  id: string;
  exerciseId?: string; // 🔴 MOTORE V2: ID permanente collegato al Registro
  name: string; // Usato solo come etichetta visiva
  weight: string;
  history: Array<{ date: string; weight: string }>;
}

export interface PersistentMasterTimer {
  circuitId: string;
  type: 'emom' | 'amrap';
  startTimestamp: number;
  durationSec: number;
  intervalSec?: number;
  pacingSec?: number;
}

export interface ActiveWorkoutState {
  active: boolean;
  startTime: number | null;
}

export interface AmrapCircuitState {
  currentRound: number;
  completedRounds: number;
}

export interface AppState {
  profileName: string;
  plan: WorkoutTab[];
  activeTab: string;
  isEditMode: boolean;
  
  // STATO TEMPORANEO DELLA UI (Si svuota a fine allenamento)
  weights: Record<string, string>;
  setWeights: Record<string, string>;
  checkedSets: Record<string, boolean>;
  setRir: Record<string, string>;
  setReps: Record<string, string>;
  setDurations: Record<string, string>;
  setRpe: Record<string, string>;
  setCustomFields: Record<string, Record<string, string>>;
  currentEffortSelection: { setId: string; targetId: string; isRpe: boolean } | null;
  activeMasterTimer: PersistentMasterTimer | null;
  activeInlineTimers: Record<string, { startTimestamp: number; durationSec: number; pauseSec: number; prefill: { weight: string; rir?: string; rpe?: string } }>;
  
  // DATI DI DOMINIO
  prs: PRRecord[];
  activeWorkouts: Record<string, ActiveWorkoutState>;
  bodyMetrics: BodyMetrics;
  bodyMetricsHistory: BodyMetricHistoryEntry[];
  favoriteTabs: Record<string, boolean>;
  amrapState: Record<string, AmrapCircuitState>;
  bodyGoal: BodyGoal;
  deloadActive: boolean;
  deloadDates: string[];
  lastBackupDate: string | null;
  
  // 🔴 CANONICAL V2 ENGINE (L'UNICA VERA CASA DEI DATI STORICI E REGISTRO)
  schemaVersion: number;
  revision: number;
  lastSavedAt?: number;
  registryV2: Record<string, ExerciseDefV2>;
  sessionsV2: WorkoutSessionV2[];
}

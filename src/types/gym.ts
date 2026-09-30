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
}

export interface PRRecord {
  id: string;
  exerciseId?: string; // 🔴 MOTORE V2: ID permanente collegato al Registro
  name: string; // Usato solo come etichetta visiva
  weight: string;
  history: Array<{ date: string; weight: string }>;
}

export interface SessionSetSnapshot {
  index: number;
  reps?: string;
  weight?: string | number;
  duration?: string | number;
  rir?: string;
  rpe?: string;
}

export interface SessionExerciseSnapshot {
  type: 'single';
  name: string;
  metricType: MetricType;
  targetSets?: number;
  targetReps?: string | number;
  pause?: number;
  sets: SessionSetSnapshot[];
}

export interface SessionSubSnapshot {
  name: string;
  metricType: MetricType;
  targetReps?: string | number;
  pause?: number;
  reps?: string;
  weight?: string | number;
  duration?: string | number;
  rir?: string;
  rpe?: string;
  isRest?: boolean;
}

export interface SessionRoundSnapshot {
  roundIndex: number;
  exercises: SessionSubSnapshot[];
}

export interface SessionCircuitSnapshot {
  type: 'superset';
  name: string;
  structureType: CircuitStructure;
  targetRounds?: number;
  emomTotalMin?: number;
  emomIntervalSec?: number;
  amrapTotalMin?: number;
  rounds: SessionRoundSnapshot[];
}

export interface WorkoutSessionSnapshot {
  id: string;
  date: string;
  time: string;
  tabName: string;
  tabSubtitle?: string;
  duration: string;
  totalSets: number;
  exercises: (SessionExerciseSnapshot | SessionCircuitSnapshot)[];
}

export interface ActiveWorkoutState {
  active: boolean;
  startTime: number | null;
}

export interface AppState {
  profileName: string;
  plan: WorkoutTab[];
  activeTab: string;
  isEditMode: boolean;
  weights: Record<string, string>;
  setWeights: Record<string, string>;
  checkedSets: Record<string, boolean>;
  setRir: Record<string, string>;
  setReps: Record<string, string>;
  setDurations: Record<string, string>;
  setRpe: Record<string, string>;
  setCustomFields: Record<string, Record<string, string>>;
  prs: PRRecord[];
  openHistories?: Record<string, boolean>;
  openPRHistories?: Record<string, boolean>;
  activeWorkouts: Record<string, ActiveWorkoutState>;
  bodyMetrics: BodyMetrics;
  bodyMetricsHistory: BodyMetricHistoryEntry[];
  favoriteTabs: Record<string, boolean>;
  amrapRounds: Record<string, number>;
  bodyGoal: BodyGoal;
  deloadActive: boolean;
  deloadDates: string[];
  currentEffortSelection: { setId: string; targetId: string; isRpe: boolean } | null;
  lastBackupDate: string | null;
  
  // 🔴 CANONICAL V2 ENGINE (L'UNICA CASA DEI DATI)
  schemaVersion: number;
  revision: number;
  lastSavedAt?: number;
  registryV2: Record<string, ExerciseDefV2>;
  sessionsV2: WorkoutSessionV2[];
}

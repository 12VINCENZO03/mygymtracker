// src/types/v2.ts

export type ExerciseTypeV2 = 'weight' | 'bodyweight' | 'time' | 'cardio' | 'rest';
export type PersistenceStatus = 'CLEAN' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR';

// --- NUOVE TASSONOMIE COACH 2.0 ---
export type MovementPattern = 
  | 'horizontal_push' | 'horizontal_pull' 
  | 'vertical_push' | 'vertical_pull' 
  | 'squat' | 'hinge' | 'lunge'
  | 'isolation_biceps' | 'isolation_triceps' 
  | 'isolation_shoulders' | 'isolation_core' 
  | 'isolation_calves' | 'isolation_legs'
  | 'cardio' | 'other';

export type EquipmentType = 
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' 
  | 'bodyweight' | 'smith_machine' | 'kettlebell' | 'other';

export type ProgressionModel = 
  | 'double_progression' // Standard: satura il range di reps, poi alza il peso
  | 'fixed_volume'       // Mantiene il carico, cerca di aumentare le serie/reps totali
  | 'time_under_tension' // Progressione sui secondi di isometria/esecuzione
  | 'distance_speed';    // Per il cardio

// 1. IL REGISTRO PERMANENTE (Identità univoca, mai duplicata)
export interface ExerciseDefV2 {
    id: string; // IMMUTABILE (es. "ex_123456")
    name: string; // MUTABILE (l'etichetta corrente, rinominabile senza spezzare la storia)
    type: ExerciseTypeV2;
    cardioMachine?: string; // es. 'treadmill', 'rower', 'bike'
    
    // --- NUOVI CAMPI COACH 2.0 (Opzionali per retrocompatibilità) ---
    movementPattern?: MovementPattern;
    equipment?: EquipmentType;
    progressionModel?: ProgressionModel;
    progressionIncrement?: number; // es. 2.5 (Bilanciere), 1.25 (Manubrio), 1 (Cavo)
    incrementUnit?: string; // 'kg', 'lbs', 'sec'

    createdAt?: number;
    updatedAt?: number;
}

// 2. IL SINGOLO SET CANONICO
export interface WorkoutSetV2 {
    id: string; // ID univoco per il set
    index: number;
    reps?: number;
    weight?: number; // Carico o zavorra per il corpo libero
    durationSec?: number;
    distance?: number;
    speed?: number;
    incline?: number;
    resistance?: number;
    cadence?: number;
    strokeRate?: number;
    pace?: string;
    rir?: number;
    isCed?: boolean; // Booleano semantico per il "CED" (cedimento)
    rpe?: number;
    customFields?: Record<string, string | number>;
}

// 3. SNAPSHOT DELL'ESERCIZIO (Copia congelata di quanto svolto nella sessione)
export interface ExerciseSnapshotV2 {
    exerciseId: string; // Riferimento permanente al Registro
    nameSnapshot: string; // Nome congelato al momento della sessione
    type: ExerciseTypeV2;
    sets: WorkoutSetV2[];
}

export interface CircuitRoundV2 {
    roundIndex: number;
    exercises: ExerciseSnapshotV2[];
}

export interface CircuitSnapshotV2 {
    id: string;
    nameSnapshot: string;
    structureType: 'classic' | 'emom' | 'amrap';
    rounds: CircuitRoundV2[];
}

export type BlockSnapshotV2 = ExerciseSnapshotV2 | CircuitSnapshotV2;

// 4. LA SESSIONE STORICA IMMUTABILE (Totalmente indipendente dalla scheda)
export interface WorkoutSessionV2 {
    id: string;
    planId?: string; // ID della scheda eseguita
    planVersion?: number; // Versione esatta in quel momento
    date: string; // YYYY-MM-DD
    startedAt: number; // Timestamp inizio
    completedAt: number; // Timestamp fine
    durationStr: string;
    tabNameSnapshot: string;
    tabSubtitleSnapshot?: string;
    bodyWeightAtSession: number; // Peso corporeo congelato in questa precisa data
    blocks: BlockSnapshotV2[];
}

// 5. IL DATABASE CANONICO V2
export interface AppDatabaseV2 {
    schemaVersion: 2;
    revision: number; // Incrementato ad ogni mutazione per concorrenza multi-tab
    lastSavedAt: number;
    registry: Record<string, ExerciseDefV2>;
    sessions: WorkoutSessionV2[];
}

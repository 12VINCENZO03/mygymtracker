// src/types/v2.ts

export type ExerciseTypeV2 = 'weight' | 'bodyweight' | 'time' | 'cardio' | 'rest';

// 1. IL REGISTRO (Gli esercizi non vengono mai cancellati o duplicati)
export interface ExerciseDefV2 {
    id: string; // IMMUTABILE (es. generato una volta sola)
    name: string; // MUTABILE (se domani lo rinomini "Back Squat", l'ID non cambia)
    type: ExerciseTypeV2;
    cardioMachine?: string; // es. 'treadmill', 'rower', 'bike'
}

// 2. IL SINGOLO SET (Una struttura universale che non perde mai dati)
export interface WorkoutSetV2 {
    id: string; // ID univoco per il set
    index: number;
    reps?: number;
    weight?: number; // Usato anche come zavorra per il corpo libero
    durationSec?: number;
    distance?: number;
    speed?: number;
    resistance?: number;
    rir?: number;
    isCed?: boolean; // Booleano semantico per il "CED" (cedimento)
    rpe?: number;
    customFields?: Record<string, string | number>;
}

// 3. SNAPSHOT DELL'ESERCIZIO (Copia congelata di quello che hai fatto oggi)
export interface ExerciseSnapshotV2 {
    exerciseId: string; // Riferimento al Registro
    nameSnapshot: string; // Il nome che l'esercizio aveva OGGI
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

// 4. LA SESSIONE STORICA (Totalmente indipendente dalla scheda)
export interface WorkoutSessionV2 {
    id: string;
    date: string; // YYYY-MM-DD
    startedAt: number; // Timestamp
    completedAt: number; // Timestamp
    durationStr: string;
    tabNameSnapshot: string;
    bodyWeightAtSession: number; // 🔴 REGOLA AUREA: Il peso corporeo in questa precisa data
    blocks: BlockSnapshotV2[];
}

// 5. IL NUOVO DATABASE COMPLETO
export interface AppDatabaseV2 {
    schemaVersion: 2;
    registry: Record<string, ExerciseDefV2>;
    sessions: WorkoutSessionV2[];
}

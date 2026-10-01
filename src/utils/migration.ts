// src/utils/migration.ts
import { AppState } from '../types/gym';
import { AppDatabaseV2, ExerciseDefV2, WorkoutSessionV2, BlockSnapshotV2, WorkoutSetV2, ExerciseSnapshotV2, CircuitRoundV2, ExerciseTypeV2 } from '../types/v2';
import { generateId } from './storage';
import { runDataIntegrityCheck } from './audit';
import { validateSetData } from './validation';

export interface LegacyV1Session {
    id?: string;
    date: string;
    time?: string;
    duration?: string;
    tabName?: string;
    exercises: Array<{
        type: 'single' | 'superset';
        name: string;
        metricType?: string;
        sets: Array<{ index: number; weight?: string | number; reps?: string | number; duration?: string | number; rir?: string; rpe?: string }>;
        structureType?: 'classic' | 'emom' | 'amrap';
        rounds: Array<{
            roundIndex: number;
            exercises: Array<{ name: string; metricType?: string; reps?: string | number; weight?: string | number; duration?: string | number; rir?: string; rpe?: string }>;
        }>;
    }>;
}

export interface LegacyV1State extends Partial<AppState> {
    workoutSessionsHistory?: LegacyV1Session[];
}

export interface MigrationResult {
    migratedDatabase: AppDatabaseV2;
    migratedState: AppState;
    report: ReturnType<typeof runDataIntegrityCheck>;
}

/**
 * Procedura canonica, deterministica e non distruttiva di migrazione da V1 a V2.
 * 1. Estrae e deduplica gli esercizi nel Registro Permanente.
 * 2. Assegna a tutti gli esercizi nelle schede attive (plan) un exerciseId permanente.
 * 3. Converte l'intero storico V1 congelando il peso corporeo storico calcolato.
 * 4. Aggancia gli ID permanenti ai Record Personali (PR).
 * 5. Esegue il controllo medico di integrità prima della validazione finale.
 */
export function migrateV1ToV2(v1State: LegacyV1State): AppDatabaseV2 {
    const registry: Record<string, ExerciseDefV2> = { ...(v1State.registryV2 || {}) };
    const sessions: WorkoutSessionV2[] = [...(v1State.sessionsV2 || [])];
    const existingSessionIds = new Set(sessions.map(s => s.id));

    // Helper per registrare o agganciare l'esercizio nel registro
    const registerExercise = (name: string, type: ExerciseTypeV2 = 'weight', cardioMachine?: string): string => {
        const cleanName = name.trim();
        const existingKey = Object.keys(registry).find(
            k => registry[k].name.trim().toLowerCase() === cleanName.toLowerCase()
        );
        if (existingKey) {
            return existingKey;
        }
        const id = generateId();
        registry[id] = {
            id,
            name: cleanName,
            type,
            cardioMachine,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        return id;
    };

    // 1. Scansioniamo e registriamo tutti gli esercizi delle schede attuali
    if (v1State.plan && Array.isArray(v1State.plan)) {
        v1State.plan.forEach(tab => {
            tab.exercises.forEach(ex => {
                if (ex.type === 'single') {
                    const regId = registerExercise(ex.name, (ex.metricType as ExerciseTypeV2) || 'weight', ex.cardioMachine);
                    ex.exerciseId = regId;
                } else {
                    ex.exercises.forEach(sub => {
                        const regId = registerExercise(sub.name, (sub.metricType as ExerciseTypeV2) || 'weight', sub.cardioMachine);
                        sub.exerciseId = regId;
                    });
                }
            });
        });
    }

    // 2. Convertiamo lo storico legacy se presente
    const oldHistory: LegacyV1Session[] = v1State.workoutSessionsHistory || [];
    oldHistory.forEach((oldSession: LegacyV1Session) => {
        if (oldSession.id && existingSessionIds.has(oldSession.id)) {
            // Già migrata in precedenza, evita duplicazioni
            return;
        }

        // Calcolo del peso corporeo al momento della sessione
        let bwAtTime = 0;
        const targetDate = new Date(oldSession.date).getTime();
        const historyMetrics = v1State.bodyMetricsHistory || [];
        const sortedMetrics = [...historyMetrics].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const closestMetric = sortedMetrics.find(m => new Date(m.date).getTime() <= targetDate);

        if (closestMetric) {
            bwAtTime = parseFloat(String(closestMetric.weight)) || 0;
        } else if (v1State.bodyMetrics?.weight) {
            bwAtTime = parseFloat(String(v1State.bodyMetrics.weight)) || 0;
        }

        const newBlocks: BlockSnapshotV2[] = [];

        oldSession.exercises.forEach(oldEx => {
            if (oldEx.type === 'single') {
                const regId = registerExercise(oldEx.name, (oldEx.metricType as ExerciseTypeV2) || 'weight');
                const sets: WorkoutSetV2[] = oldEx.sets.map(s => {
                    const valid = validateSetData(
                        parseInt(String(s.reps)) || undefined,
                        parseFloat(String(s.weight)) || undefined,
                        parseFloat(String(s.duration)) || undefined,
                        s.rir === '-1' || s.rir === 'CED' ? undefined : parseFloat(String(s.rir)),
                        parseFloat(String(s.rpe)) || undefined
                    );
                    return {
                        id: generateId(),
                        index: s.index,
                        ...valid,
                        isCed: s.rir === '-1' || s.rir === 'CED'
                    };
                });

                newBlocks.push({
                    exerciseId: regId,
                    nameSnapshot: oldEx.name,
                    type: (oldEx.metricType as ExerciseTypeV2) || 'weight',
                    sets
                } as ExerciseSnapshotV2);

            } else if (oldEx.type === 'superset') {
                const rounds: CircuitRoundV2[] = oldEx.rounds.map(r => {
                    const exercises: ExerciseSnapshotV2[] = r.exercises.map(sub => {
                        const regId = registerExercise(sub.name, (sub.metricType as ExerciseTypeV2) || 'weight');
                        const valid = validateSetData(
                            parseInt(String(sub.reps)) || undefined,
                            parseFloat(String(sub.weight)) || undefined,
                            parseFloat(String(sub.duration)) || undefined,
                            sub.rir === '-1' || sub.rir === 'CED' ? undefined : parseFloat(String(sub.rir)),
                            parseFloat(String(sub.rpe)) || undefined
                        );
                        return {
                            exerciseId: regId,
                            nameSnapshot: sub.name,
                            type: (sub.metricType as ExerciseTypeV2) || 'weight',
                            sets: [{
                                id: generateId(),
                                index: 1,
                                ...valid,
                                isCed: sub.rir === '-1' || sub.rir === 'CED'
                            }]
                        };
                    });
                    return { roundIndex: r.roundIndex, exercises };
                });

                newBlocks.push({
                    id: generateId(),
                    nameSnapshot: oldEx.name,
                    structureType: oldEx.structureType || 'classic',
                    rounds
                });
            }
        });

        const startedAt = oldSession.date && oldSession.time
            ? new Date(`${oldSession.date}T${oldSession.time}`).getTime() - 3600000
            : Date.now();
        const completedAt = oldSession.date && oldSession.time
            ? new Date(`${oldSession.date}T${oldSession.time}`).getTime()
            : Date.now();

        sessions.push({
            id: oldSession.id || generateId(),
            date: oldSession.date,
            startedAt: isNaN(startedAt) ? Date.now() : startedAt,
            completedAt: isNaN(completedAt) ? Date.now() : completedAt,
            durationStr: oldSession.duration || '00:00:00',
            tabNameSnapshot: oldSession.tabName || 'Allenamento',
            bodyWeightAtSession: bwAtTime,
            blocks: newBlocks
        });
    });

    // 3. Colleghiamo i PR al registro permanente
    if (v1State.prs && Array.isArray(v1State.prs)) {
        v1State.prs.forEach(pr => {
            if (!pr.exerciseId) {
                const regId = registerExercise(pr.name, 'weight');
                pr.exerciseId = regId;
            }
        });
    }

    const canonicalDb: AppDatabaseV2 = {
        schemaVersion: 2,
        revision: (v1State.revision || 0) + 1,
        lastSavedAt: Date.now(),
        registry,
        sessions
    };

    return canonicalDb;
}

// src/utils/migration.ts
import { AppState } from '../types/gym';
import { AppDatabaseV2, ExerciseDefV2, WorkoutSessionV2, BlockSnapshotV2, WorkoutSetV2, ExerciseSnapshotV2, CircuitRoundV2, ExerciseTypeV2 } from '../types/v2';
import { generateId } from './storage';

export function migrateV1ToV2(v1State: AppState): AppDatabaseV2 {
    const registry: Record<string, ExerciseDefV2> = {};
    const sessions: WorkoutSessionV2[] = [];

    // 1. COSTRUIAMO IL REGISTRO (Estraiamo gli esercizi unici)
    const registerExercise = (id: string, name: string, type: ExerciseTypeV2 = 'weight') => {
        if (!registry[id]) {
            registry[id] = { id, name, type };
        }
    };

    // Scansioniamo le schede attuali
    v1State.plan.forEach(tab => {
        tab.exercises.forEach(ex => {
            if (ex.type === 'single') {
                registerExercise(ex.id, ex.name, ex.metricType as ExerciseTypeV2 || 'weight');
            } else {
                ex.exercises.forEach(sub => {
                    registerExercise(sub.id, sub.name, sub.metricType as ExerciseTypeV2 || 'weight');
                });
            }
        });
    });

    // 2. CONVERTIAMO LO STORICO (La parte più delicata)
    v1State.workoutSessionsHistory.forEach(oldSession => {
        
        // 🔴 Recupero Storico del Peso Corporeo
        let bwAtTime = 0;
        const targetDate = new Date(oldSession.date).getTime();
        // Ordiniamo la storia del peso dal più recente al più vecchio
        const sortedMetrics = [...v1State.bodyMetricsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        // Troviamo il peso registrato prima o durante quel giorno
        const closestMetric = sortedMetrics.find(m => new Date(m.date).getTime() <= targetDate);
        
        if (closestMetric) {
            bwAtTime = parseFloat(String(closestMetric.weight)) || 0;
        } else if (v1State.bodyMetrics.weight) {
            bwAtTime = parseFloat(String(v1State.bodyMetrics.weight)) || 0;
        }

        const newBlocks: BlockSnapshotV2[] = [];

        oldSession.exercises.forEach(oldEx => {
            if (oldEx.type === 'single') {
                // Siccome nel V1 non salvavamo l'ID negli snapshot storici, lo cerchiamo per nome
                let regId = Object.keys(registry).find(k => registry[k].name === oldEx.name);
                if (!regId) {
                    regId = generateId(); // Esercizio orfano, lo aggiungiamo al registro!
                    registerExercise(regId, oldEx.name, oldEx.metricType as ExerciseTypeV2 || 'weight');
                }

                const sets: WorkoutSetV2[] = oldEx.sets.map(s => ({
                    id: generateId(),
                    index: s.index,
                    reps: parseInt(String(s.reps)) || undefined,
                    weight: parseFloat(String(s.weight)) || undefined,
                    durationSec: parseFloat(String(s.duration)) || undefined,
                    rir: s.rir === '-1' || s.rir === 'CED' ? undefined : parseFloat(String(s.rir)),
                    isCed: s.rir === '-1' || s.rir === 'CED',
                    rpe: parseFloat(String(s.rpe)) || undefined,
                }));

                newBlocks.push({
                    exerciseId: regId,
                    nameSnapshot: oldEx.name,
                    type: oldEx.metricType as ExerciseTypeV2 || 'weight',
                    sets
                } as ExerciseSnapshotV2);

            } else if (oldEx.type === 'superset') {
                const rounds: CircuitRoundV2[] = oldEx.rounds.map(r => {
                    const exercises: ExerciseSnapshotV2[] = r.exercises.map(sub => {
                        let regId = Object.keys(registry).find(k => registry[k].name === sub.name);
                        if (!regId) {
                            regId = generateId();
                            registerExercise(regId, sub.name, sub.metricType as ExerciseTypeV2 || 'weight');
                        }
                        return {
                            exerciseId: regId,
                            nameSnapshot: sub.name,
                            type: sub.metricType as ExerciseTypeV2 || 'weight',
                            sets: [{
                                id: generateId(),
                                index: 1,
                                reps: parseInt(String(sub.reps)) || undefined,
                                weight: parseFloat(String(sub.weight)) || undefined,
                                durationSec: parseFloat(String(sub.duration)) || undefined,
                                rir: sub.rir === '-1' || sub.rir === 'CED' ? undefined : parseFloat(String(sub.rir)),
                                isCed: sub.rir === '-1' || sub.rir === 'CED',
                                rpe: parseFloat(String(sub.rpe)) || undefined,
                            }]
                        };
                    });
                    return { roundIndex: r.roundIndex, exercises };
                });

                newBlocks.push({
                    id: generateId(),
                    nameSnapshot: oldEx.name,
                    structureType: oldEx.structureType,
                    rounds
                });
            }
        });

        sessions.push({
            id: oldSession.id,
            date: oldSession.date,
            startedAt: new Date(`${oldSession.date}T${oldSession.time}`).getTime() - 3600000, // Stima
            completedAt: new Date(`${oldSession.date}T${oldSession.time}`).getTime(),
            durationStr: oldSession.duration,
            tabNameSnapshot: oldSession.tabName,
            bodyWeightAtSession: bwAtTime, // 🔴 Qui congeliamo il peso per lo storico!
            blocks: newBlocks
        });
    });

    return {
        schemaVersion: 2,
        registry,
        sessions
    };
}

// src/utils/validation.ts

/**
 * Funzione di validazione centralizzata.
 * Si assicura che nessun dato impossibile venga mai salvato nel database V2.
 */
export function validateSetData(
    reps?: number,
    weight?: number,
    durationSec?: number,
    rir?: number,
    rpe?: number
) {
    return {
        // Limita le ripetizioni tra 0 e 1000
        reps: reps !== undefined ? Math.min(Math.max(0, reps), 1000) : undefined,
        // Limita il peso tra 0 e 2000 kg
        weight: weight !== undefined ? Math.min(Math.max(0, weight), 2000) : undefined,
        // Limita la durata tra 0 e 36000 secondi (10 ore max)
        durationSec: durationSec !== undefined ? Math.min(Math.max(0, durationSec), 36000) : undefined,
        // RIR massimo sensato è 10
        rir: rir !== undefined ? Math.min(Math.max(0, rir), 10) : undefined,
        // RPE è una scala da 1 a 10
        rpe: rpe !== undefined ? Math.min(Math.max(1, rpe), 10) : undefined,
    };
}

// src/utils/audit.ts
import { AppDatabaseV2 } from '../types/v2';
import { AppState } from '../types/gym';

export interface AuditIssue {
    severity: 'warning' | 'error';
    message: string;
    sessionId?: string;
    exerciseId?: string;
}

export interface AuditReport {
    totalSessions: number;
    totalExercises: number;
    totalPRs: number;
    issues: AuditIssue[];
    isHealthy: boolean;
}

/**
 * Esegue una scansione approfondita del database canonico V2.
 * Verifica referenziale, semantica, formati temporali e congruità numerica.
 * Operazione in sola lettura, totalmente non-distruttiva.
 */
export function runDataIntegrityCheck(input: AppDatabaseV2 | AppState): AuditReport {
    const issues: AuditIssue[] = [];

    // Supporta sia AppDatabaseV2 che AppState
    const registry = 'registry' in input ? input.registry : (input.registryV2 || {});
    const sessions = 'sessions' in input ? input.sessions : (input.sessionsV2 || []);
    const prs = 'prs' in input ? input.prs : [];
    const plan = 'plan' in input ? input.plan : [];

    // 1. Controllo del Registro Esercizi
    const registryKeys = Object.keys(registry);
    if (registryKeys.length === 0 && sessions.length > 0) {
        issues.push({ severity: 'error', message: 'Il Registro Esercizi è vuoto ma sono presenti sessioni storiche.' });
    }

    // Verifica unicità chiavi / coerenza ID interno
    const seenIds = new Set<string>();
    registryKeys.forEach((key) => {
        const item = registry[key];
        if (!item.name || item.name.trim() === '') {
            issues.push({ severity: 'warning', message: `Esercizio ID ${key} ha un nome vuoto.`, exerciseId: key });
        }
        if (item.id !== key) {
            issues.push({ severity: 'error', message: `Discrepanza tra chiave registro (${key}) e id interno (${item.id}).`, exerciseId: key });
        }
        if (seenIds.has(item.id)) {
            issues.push({ severity: 'error', message: `ID esercizio duplicato nel registro: ${item.id}`, exerciseId: key });
        }
        seenIds.add(item.id);
    });

    // 2. Controllo Referenziale della Scheda Attiva (Plan)
    plan.forEach(tab => {
        tab.exercises.forEach(ex => {
            if (ex.type === 'single') {
                if (ex.exerciseId && !registry[ex.exerciseId]) {
                    issues.push({ severity: 'warning', message: `Scheda "${tab.name}": esercizio "${ex.name}" punta a ID orfano ${ex.exerciseId}`, exerciseId: ex.exerciseId });
                }
            } else {
                ex.exercises.forEach(sub => {
                    if (sub.exerciseId && !registry[sub.exerciseId]) {
                        issues.push({ severity: 'warning', message: `Scheda "${tab.name}": circuito "${ex.name}" - esercizio "${sub.name}" punta a ID orfano ${sub.exerciseId}`, exerciseId: sub.exerciseId });
                    }
                });
            }
        });
    });

    // 3. Controllo delle Sessioni Storiche Immutabili
    sessions.forEach(session => {
        // Verifica del formato della data (YYYY-MM-DD)
        if (!session.date || !session.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            issues.push({ severity: 'error', message: `Data non valida trovata: ${session.date}`, sessionId: session.id });
        }

        // Verifica del peso corporeo al momento della sessione
        if (session.bodyWeightAtSession !== undefined && (session.bodyWeightAtSession < 0 || session.bodyWeightAtSession > 350)) {
            issues.push({ severity: 'warning', message: `Peso corporeo anomalo registrato: ${session.bodyWeightAtSession}kg`, sessionId: session.id });
        }

        // Verifica dell'integrità referenziale dei blocchi
        session.blocks.forEach(block => {
            if ('rounds' in block) {
                // Circuito / Superset
                block.rounds.forEach(r => r.exercises.forEach(ex => {
                    if (!registry[ex.exerciseId]) {
                        issues.push({ severity: 'error', message: `Esercizio orfano (Circuito): ID ${ex.exerciseId} ("${ex.nameSnapshot}") assente dal registro.`, sessionId: session.id, exerciseId: ex.exerciseId });
                    }
                    // Validazione sets
                    ex.sets.forEach(s => {
                        if (s.weight !== undefined && (s.weight < 0 || s.weight > 2000)) {
                            issues.push({ severity: 'warning', message: `Carico non realistico (${s.weight}kg) in "${ex.nameSnapshot}".`, sessionId: session.id });
                        }
                        if (s.reps !== undefined && (s.reps < 0 || s.reps > 1000)) {
                            issues.push({ severity: 'warning', message: `Ripetizioni anomale (${s.reps}) in "${ex.nameSnapshot}".`, sessionId: session.id });
                        }
                    });
                }));
            } else {
                // Esercizio singolo
                if (!registry[block.exerciseId]) {
                    issues.push({ severity: 'error', message: `Esercizio orfano (Singolo): ID ${block.exerciseId} ("${block.nameSnapshot}") assente dal registro.`, sessionId: session.id, exerciseId: block.exerciseId });
                }
                block.sets.forEach(s => {
                    if (s.weight !== undefined && (s.weight < 0 || s.weight > 2000)) {
                        issues.push({ severity: 'warning', message: `Carico non realistico (${s.weight}kg) in "${block.nameSnapshot}".`, sessionId: session.id });
                    }
                    if (s.reps !== undefined && (s.reps < 0 || s.reps > 1000)) {
                        issues.push({ severity: 'warning', message: `Ripetizioni anomale (${s.reps}) in "${block.nameSnapshot}".`, sessionId: session.id });
                    }
                });
            }
        });
    });

    // 4. Controllo dei Record Personali (PR)
    prs.forEach(pr => {
        if (pr.exerciseId && !registry[pr.exerciseId]) {
            issues.push({ severity: 'warning', message: `Record PR "${pr.name}" punta ad un ID non più presente nel registro (${pr.exerciseId}).`, exerciseId: pr.exerciseId });
        }
    });

    return {
        totalSessions: sessions.length,
        totalExercises: registryKeys.length,
        totalPRs: prs.length,
        issues,
        isHealthy: issues.filter(i => i.severity === 'error').length === 0
    };
}

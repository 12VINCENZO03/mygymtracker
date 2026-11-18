import type { AppState, BodyGoal, BodyMetricHistoryEntry, BodyMetrics, PRRecord, WorkoutTab } from '../types/gym';
import type { ExerciseDefV2, WorkoutSessionV2 } from '../types/v2';
import { defaultWorkoutPlan, normalizeState } from './storage';
import { supabase } from './supabase';

export interface SyncedGymPayload {
  schemaVersion: number;
  profileName: string;
  plan: WorkoutTab[];
  prs: PRRecord[];
  bodyMetrics: BodyMetrics;
  bodyMetricsHistory: BodyMetricHistoryEntry[];
  favoriteTabs: Record<string, boolean>;
  bodyGoal: BodyGoal;
  deloadActive: boolean;
  deloadDates: string[];
  registryV2: Record<string, ExerciseDefV2>;
  sessionsV2: WorkoutSessionV2[];
  lastSavedAt?: number;
}

export interface CloudGymRow {
  user_id: string;
  state: Partial<SyncedGymPayload> | null;
  revision: number | null;
  updated_at: string | null;
}

export interface CloudMetaSnapshot {
  revision: number;
  updatedAt: string | null;
}

export interface CloudComparisonSummary {
  sessionsCount: number;
  lastSavedLabel: string;
  latestWeightLabel: string;
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export class CloudSyncError extends Error {
  isAuthError: boolean;
  isRetryable: boolean;

  constructor(message: string, options?: { isAuthError?: boolean; isRetryable?: boolean }) {
    super(message);
    this.name = 'CloudSyncError';
    this.isAuthError = Boolean(options?.isAuthError);
    this.isRetryable = Boolean(options?.isRetryable);
  }
}

const CLOUD_META_STORAGE_PREFIX = 'mygym_cloud_last_seen_';

export const getLastSeenCloudMeta = (userId: string): CloudMetaSnapshot | null => {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = localStorage.getItem(`${CLOUD_META_STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.revision === 'number') {
      return {
        revision: parsed.revision,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const setLastSeenCloudMeta = (userId: string, meta: CloudMetaSnapshot): void => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`${CLOUD_META_STORAGE_PREFIX}${userId}`, JSON.stringify(meta));
  } catch (e) {
    console.warn('Impossibile salvare metadati cloud su localStorage:', e);
  }
};

export const getEffectiveLocalLastSavedAt = (state: AppState): number => {
  let storedSavedAt = 0;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('mygym_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.lastSavedAt === 'number') {
          storedSavedAt = parsed.lastSavedAt;
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  const stateSavedAt = typeof state.lastSavedAt === 'number' ? state.lastSavedAt : 0;
  return Math.max(stateSavedAt, storedSavedAt);
};

export const extractSyncedPayload = (state: AppState): SyncedGymPayload => {
  const effectiveSavedAt = getEffectiveLocalLastSavedAt(state);
  return {
    schemaVersion: typeof state.schemaVersion === 'number' ? state.schemaVersion : 2,
    profileName: state.profileName || '',
    plan: Array.isArray(state.plan) ? state.plan : [],
    prs: Array.isArray(state.prs) ? state.prs : [],
    bodyMetrics: state.bodyMetrics || { weight: '', height: '', fm: '', ffm: '' },
    bodyMetricsHistory: Array.isArray(state.bodyMetricsHistory) ? state.bodyMetricsHistory : [],
    favoriteTabs: state.favoriteTabs || {},
    bodyGoal: state.bodyGoal !== undefined ? state.bodyGoal : 'recomp',
    deloadActive: Boolean(state.deloadActive),
    deloadDates: Array.isArray(state.deloadDates) ? state.deloadDates : [],
    registryV2: state.registryV2 || {},
    sessionsV2: Array.isArray(state.sessionsV2) ? state.sessionsV2 : [],
    ...(effectiveSavedAt > 0 ? { lastSavedAt: effectiveSavedAt } : {})
  };
};

/**
 * Serializzazione canonica dei soli dati duraturi (esclude lastSavedAt e campi UI temporanei)
 * per confronti deterministici di uguaglianza e rilevamento modifiche reali.
 */
const stableSortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableSortKeys);
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) {
        sorted[k] = stableSortKeys(v);
      }
    }
    return sorted;
  }
  return value;
};

export const computeSyncedPayloadHash = (payload: Partial<SyncedGymPayload>): string => {
  const comparable = {
    schemaVersion: typeof payload.schemaVersion === 'number' ? payload.schemaVersion : 2,
    profileName: payload.profileName || '',
    plan: Array.isArray(payload.plan) ? payload.plan : [],
    prs: Array.isArray(payload.prs) ? payload.prs : [],
    bodyMetrics: {
      weight: payload.bodyMetrics?.weight ?? '',
      height: payload.bodyMetrics?.height ?? '',
      fm: payload.bodyMetrics?.fm ?? '',
      ffm: payload.bodyMetrics?.ffm ?? ''
    },
    bodyMetricsHistory: Array.isArray(payload.bodyMetricsHistory) ? payload.bodyMetricsHistory : [],
    favoriteTabs: payload.favoriteTabs || {},
    bodyGoal: payload.bodyGoal !== undefined ? payload.bodyGoal : 'recomp',
    deloadActive: Boolean(payload.deloadActive),
    deloadDates: Array.isArray(payload.deloadDates) ? payload.deloadDates : [],
    registryV2: payload.registryV2 || {},
    sessionsV2: Array.isArray(payload.sessionsV2) ? payload.sessionsV2 : []
  };
  return JSON.stringify(stableSortKeys(comparable));
};

export const areSyncedPayloadsEqual = (
  a: Partial<SyncedGymPayload> | null | undefined,
  b: Partial<SyncedGymPayload> | null | undefined
): boolean => {
  if (!a || !b) return false;
  return computeSyncedPayloadHash(a) === computeSyncedPayloadHash(b);
};

const DEFAULT_PLAN_HASH = JSON.stringify(stableSortKeys(defaultWorkoutPlan));

/**
 * Riconosce se uno stato è vuoto o equivalente allo stato di default iniziale (initialDefaultState senza sessionsV2).
 */
export const isGymStateEmptyOrDefault = (data: Partial<SyncedGymPayload> | null | undefined): boolean => {
  if (!data) return true;

  const hasSessions = Array.isArray(data.sessionsV2) && data.sessionsV2.length > 0;
  if (hasSessions) return false;

  const hasPrs = Array.isArray(data.prs) && data.prs.length > 0;
  if (hasPrs) return false;

  const hasBodyHistory = Array.isArray(data.bodyMetricsHistory) && data.bodyMetricsHistory.length > 0;
  if (hasBodyHistory) return false;

  const hasProfileName = typeof data.profileName === 'string' && data.profileName.trim().length > 0;
  if (hasProfileName) return false;

  const bm = data.bodyMetrics;
  const hasBodyMetrics = Boolean(
    bm &&
      (String(bm.weight ?? '').trim() !== '' ||
        String(bm.height ?? '').trim() !== '' ||
        String(bm.fm ?? '').trim() !== '' ||
        String(bm.ffm ?? '').trim() !== '')
  );
  if (hasBodyMetrics) return false;

  const hasDeload = Boolean(data.deloadActive) || (Array.isArray(data.deloadDates) && data.deloadDates.length > 0);
  if (hasDeload) return false;

  const hasFavorites = Boolean(data.favoriteTabs && Object.values(data.favoriteTabs).some(Boolean));
  if (hasFavorites) return false;

  if (Array.isArray(data.plan) && data.plan.length > 0) {
    const planHash = JSON.stringify(stableSortKeys(data.plan));
    if (planHash !== DEFAULT_PLAN_HASH) return false;
  }

  return true;
};

export const isCloudMetaNewerThanSeen = (
  remoteRevision: number | null | undefined,
  remoteUpdatedAt: string | null | undefined,
  lastSeen: CloudMetaSnapshot | null
): boolean => {
  const rev = typeof remoteRevision === 'number' ? remoteRevision : 0;
  const updatedMs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;

  if (!lastSeen) {
    return rev > 0 || updatedMs > 0;
  }

  if (rev > lastSeen.revision) {
    return true;
  }

  const lastSeenMs = lastSeen.updatedAt ? new Date(lastSeen.updatedAt).getTime() : 0;
  if (updatedMs > 0 && lastSeenMs > 0 && updatedMs > lastSeenMs) {
    return true;
  }
  if (updatedMs > 0 && lastSeenMs === 0) {
    return true;
  }

  return false;
};

export const formatCloudDateTime = (timestampMsOrIso?: number | string | null): string => {
  if (!timestampMsOrIso) return 'Non disponibile';
  const date = typeof timestampMsOrIso === 'number' ? new Date(timestampMsOrIso) : new Date(timestampMsOrIso);
  if (Number.isNaN(date.getTime())) return 'Non disponibile';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCloudTimeShort = (timestampMsOrIso?: number | string | null): string => {
  if (!timestampMsOrIso) return 'Mai';
  const date = typeof timestampMsOrIso === 'number' ? new Date(timestampMsOrIso) : new Date(timestampMsOrIso);
  if (Number.isNaN(date.getTime())) return 'Mai';
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const buildComparisonSummary = (
  data: Partial<SyncedGymPayload> | null | undefined,
  fallbackTimestamp?: string | number | null
): CloudComparisonSummary => {
  const sessionsCount = Array.isArray(data?.sessionsV2) ? data.sessionsV2.length : 0;
  const savedAt = data?.lastSavedAt || fallbackTimestamp || null;
  const lastSavedLabel = formatCloudDateTime(savedAt);

  let latestWeightStr = '';
  if (Array.isArray(data?.bodyMetricsHistory) && data.bodyMetricsHistory.length > 0) {
    const sorted = [...data.bodyMetricsHistory].sort((a, b) => {
      const ta = a.createdAt || (a.date ? new Date(a.date).getTime() : 0) || 0;
      const tb = b.createdAt || (b.date ? new Date(b.date).getTime() : 0) || 0;
      return tb - ta;
    });
    const entryWithWeight = sorted.find((h) => String(h.weight ?? '').trim() !== '');
    if (entryWithWeight) {
      latestWeightStr = String(entryWithWeight.weight).trim();
    }
  }
  if (!latestWeightStr && data?.bodyMetrics?.weight !== undefined && String(data.bodyMetrics.weight).trim() !== '') {
    latestWeightStr = String(data.bodyMetrics.weight).trim();
  }

  return {
    sessionsCount,
    lastSavedLabel,
    latestWeightLabel: latestWeightStr ? `${latestWeightStr} kg` : '-'
  };
};

/**
 * Applica i soli campi duraturi cloud sopra lo stato locale, passando da normalizeState
 * e preservando lo stato temporaneo della UI locale (senza perdita dati UI in corso).
 */
export const applyCloudPayloadToLocalState = (
  localState: AppState,
  cloudPayload: Partial<SyncedGymPayload>
): { nextState: AppState; deletedSessionIds: string[] } => {
  const rawMergedInput: Record<string, unknown> = {
    schemaVersion: cloudPayload.schemaVersion ?? 2,
    revision: localState.revision || 1,
    lastSavedAt: cloudPayload.lastSavedAt || Date.now(),
    profileName: cloudPayload.profileName ?? '',
    plan: Array.isArray(cloudPayload.plan) ? cloudPayload.plan : localState.plan,
    prs: Array.isArray(cloudPayload.prs) ? cloudPayload.prs : [],
    bodyMetrics: cloudPayload.bodyMetrics ?? { weight: '', height: '', fm: '', ffm: '' },
    bodyMetricsHistory: Array.isArray(cloudPayload.bodyMetricsHistory) ? cloudPayload.bodyMetricsHistory : [],
    favoriteTabs: cloudPayload.favoriteTabs ?? {},
    bodyGoal: cloudPayload.bodyGoal !== undefined ? cloudPayload.bodyGoal : 'recomp',
    deloadActive: Boolean(cloudPayload.deloadActive),
    deloadDates: Array.isArray(cloudPayload.deloadDates) ? cloudPayload.deloadDates : [],
    registryV2: cloudPayload.registryV2 ?? {},
    sessionsV2: Array.isArray(cloudPayload.sessionsV2) ? cloudPayload.sessionsV2 : [],
    // Preserviamo stato UI locale e preferenze di navigazione locali
    activeTab: localState.activeTab,
    isEditMode: localState.isEditMode,
    weights: localState.weights,
    setWeights: localState.setWeights,
    checkedSets: localState.checkedSets,
    setRir: localState.setRir,
    setReps: localState.setReps,
    setDurations: localState.setDurations,
    setRpe: localState.setRpe,
    setCustomFields: localState.setCustomFields,
    currentEffortSelection: localState.currentEffortSelection,
    activeMasterTimer: localState.activeMasterTimer,
    activeInlineTimers: localState.activeInlineTimers,
    activeWorkouts: localState.activeWorkouts,
    amrapState: localState.amrapState,
    lastBackupDate: localState.lastBackupDate
  };

  const normalized = normalizeState(rawMergedInput);

  // Se la tab attiva locale non esiste più nella scheda scaricata dal cloud, torniamo alla home
  const tabStillExists = normalized.plan.some((t) => t.id === normalized.activeTab);
  if (!tabStillExists) {
    normalized.activeTab = 'home';
  }

  const nextSessionIds = new Set((normalized.sessionsV2 || []).map((s) => s.id));
  const deletedSessionIds = (localState.sessionsV2 || [])
    .map((s) => s.id)
    .filter((id) => id && !nextSessionIds.has(id));

  return { nextState: normalized, deletedSessionIds };
};

/**
 * Unione intelligente tra stato locale e stato cloud:
 * - sessionsV2 unito per id senza duplicati (snapshot immutabili)
 * - registryV2 unito per id
 * - tutti gli altri campi presi dalla versione con lastSavedAt più recente
 */
export const mergeLocalAndCloudStates = (
  localState: AppState,
  cloudPayload: Partial<SyncedGymPayload>,
  cloudUpdatedAt?: string | null
): { nextState: AppState; deletedSessionIds: string[] } => {
  const localSavedAt = getEffectiveLocalLastSavedAt(localState);
  const cloudUpdatedMs = cloudUpdatedAt ? new Date(cloudUpdatedAt).getTime() : 0;
  const cloudSavedAt =
    typeof cloudPayload.lastSavedAt === 'number'
      ? cloudPayload.lastSavedAt
      : Number.isNaN(cloudUpdatedMs)
      ? 0
      : cloudUpdatedMs;

  const preferLocal = localSavedAt >= cloudSavedAt;
  const primary = preferLocal ? extractSyncedPayload(localState) : cloudPayload;

  // 1. Unione sessionsV2 per id (nessun duplicato)
  const sessionsMap = new Map<string, WorkoutSessionV2>();
  const cloudSessions = Array.isArray(cloudPayload.sessionsV2) ? cloudPayload.sessionsV2 : [];
  const localSessions = Array.isArray(localState.sessionsV2) ? localState.sessionsV2 : [];

  for (const s of cloudSessions) {
    if (s && s.id) sessionsMap.set(s.id, s);
  }
  for (const s of localSessions) {
    if (s && s.id && !sessionsMap.has(s.id)) {
      sessionsMap.set(s.id, s);
    }
  }

  const mergedSessions = Array.from(sessionsMap.values()).sort((a, b) => {
    const timeA = a.completedAt || a.startedAt || (a.date ? new Date(a.date).getTime() : 0) || 0;
    const timeB = b.completedAt || b.startedAt || (b.date ? new Date(b.date).getTime() : 0) || 0;
    return timeB - timeA;
  });

  // 2. Unione registryV2 per id
  const mergedRegistry: Record<string, ExerciseDefV2> = {};
  const cloudReg = cloudPayload.registryV2 || {};
  const localReg = localState.registryV2 || {};
  const allRegIds = new Set([...Object.keys(cloudReg), ...Object.keys(localReg)]);

  for (const id of allRegIds) {
    const cDef = cloudReg[id];
    const lDef = localReg[id];
    if (cDef && !lDef) {
      mergedRegistry[id] = cDef;
    } else if (lDef && !cDef) {
      mergedRegistry[id] = lDef;
    } else if (cDef && lDef) {
      const cUpd = cDef.updatedAt || 0;
      const lUpd = lDef.updatedAt || 0;
      if (lUpd !== cUpd) {
        mergedRegistry[id] = lUpd >= cUpd ? lDef : cDef;
      } else {
        mergedRegistry[id] = preferLocal ? lDef : cDef;
      }
    }
  }

  // 3. Tutti gli altri campi dalla versione con lastSavedAt più recente
  const mergedPayload: Partial<SyncedGymPayload> = {
    schemaVersion: primary.schemaVersion ?? 2,
    profileName: primary.profileName ?? '',
    plan: Array.isArray(primary.plan) ? primary.plan : localState.plan,
    prs: Array.isArray(primary.prs) ? primary.prs : [],
    bodyMetrics: primary.bodyMetrics ?? { weight: '', height: '', fm: '', ffm: '' },
    bodyMetricsHistory: Array.isArray(primary.bodyMetricsHistory) ? primary.bodyMetricsHistory : [],
    favoriteTabs: primary.favoriteTabs ?? {},
    bodyGoal: primary.bodyGoal !== undefined ? primary.bodyGoal : 'recomp',
    deloadActive: Boolean(primary.deloadActive),
    deloadDates: Array.isArray(primary.deloadDates) ? primary.deloadDates : [],
    registryV2: mergedRegistry,
    sessionsV2: mergedSessions,
    lastSavedAt: Math.max(localSavedAt, cloudSavedAt, Date.now())
  };

  return applyCloudPayloadToLocalState(localState, mergedPayload);
};

const classifySupabaseError = (error: unknown): CloudSyncError => {
  if (!error || typeof error !== 'object') {
    return new CloudSyncError('Errore di sincronizzazione sconosciuto.', { isRetryable: true });
  }

  const errObj = error as { code?: string; message?: string; status?: number };
  const code = (errObj.code || '').toUpperCase();
  const msg = (errObj.message || '').toLowerCase();
  const status = errObj.status;

  if (
    status === 401 ||
    status === 403 ||
    code === 'PGRST301' ||
    code === 'PGRST302' ||
    msg.includes('jwt') ||
    msg.includes('expired') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid token') ||
    msg.includes('not authenticated')
  ) {
    return new CloudSyncError('Sessione scaduta. Effettua nuovamente il login.', {
      isAuthError: true,
      isRetryable: false
    });
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('load failed') ||
    status === 0 ||
    (typeof status === 'number' && status >= 500) ||
    status === 429
  ) {
    return new CloudSyncError('Errore di rete o server temporaneamente non disponibile.', {
      isRetryable: true
    });
  }

  return new CloudSyncError(errObj.message || 'Errore durante la sincronizzazione cloud.', {
    isRetryable: false
  });
};

export const fetchCloudGymMeta = async (
  userId: string
): Promise<{ exists: boolean; revision: number; updatedAt: string | null }> => {
  if (!supabase) {
    throw new CloudSyncError('Client Supabase non disponibile.', { isRetryable: false });
  }

  const { data, error } = await supabase
    .from('gym_state')
    .select('revision, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw classifySupabaseError(error);
  }

  if (!data) {
    return { exists: false, revision: 0, updatedAt: null };
  }

  return {
    exists: true,
    revision: typeof data.revision === 'number' ? data.revision : 0,
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null
  };
};

export const fetchCloudGymRow = async (userId: string): Promise<CloudGymRow | null> => {
  if (!supabase) {
    throw new CloudSyncError('Client Supabase non disponibile.', { isRetryable: false });
  }

  const { data, error } = await supabase
    .from('gym_state')
    .select('user_id, state, revision, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw classifySupabaseError(error);
  }

  if (!data) return null;

  return {
    user_id: data.user_id,
    state: (data.state && typeof data.state === 'object' ? data.state : null) as Partial<SyncedGymPayload> | null,
    revision: typeof data.revision === 'number' ? data.revision : null,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null
  };
};

export const upsertCloudGymRow = async (
  userId: string,
  payload: SyncedGymPayload,
  nextRevision: number
): Promise<CloudMetaSnapshot> => {
  if (!supabase) {
    throw new CloudSyncError('Client Supabase non disponibile.', { isRetryable: false });
  }

  const nowIso = new Date().toISOString();
  const payloadWithTimestamp: SyncedGymPayload = {
    ...payload,
    lastSavedAt: payload.lastSavedAt || Date.now()
  };

  const { data, error } = await supabase
    .from('gym_state')
    .upsert(
      {
        user_id: userId,
        state: payloadWithTimestamp,
        revision: Math.max(1, Math.floor(nextRevision)),
        updated_at: nowIso
      },
      { onConflict: 'user_id' }
    )
    .select('revision, updated_at')
    .single();

  if (error) {
    throw classifySupabaseError(error);
  }

  return {
    revision: typeof data?.revision === 'number' ? data.revision : nextRevision,
    updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : nowIso
  };
};

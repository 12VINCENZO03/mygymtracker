import { useState, useEffect, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppState } from '../types/gym';
import { createSafetyBackup, subscribePersistenceStatus } from '../utils/storage';
import { supabase } from '../utils/supabase';
import {
  CloudGymRow,
  CloudSyncError,
  CloudSyncStatus,
  CloudComparisonSummary,
  applyCloudPayloadToLocalState,
  areSyncedPayloadsEqual,
  buildComparisonSummary,
  computeSyncedPayloadHash,
  extractSyncedPayload,
  fetchCloudGymMeta,
  fetchCloudGymRow,
  getLastSeenCloudMeta,
  isCloudMetaNewerThanSeen,
  isGymStateEmptyOrDefault,
  mergeLocalAndCloudStates,
  setLastSeenCloudMeta,
  upsertCloudGymRow
} from '../utils/cloudSync';

export interface CloudConflictState {
  userId: string;
  cloudRow: CloudGymRow;
  localSummary: CloudComparisonSummary;
  cloudSummary: CloudComparisonSummary;
}

export type CloudConflictChoice = 'local' | 'cloud' | 'merge';

interface UseCloudSyncOptions {
  user: User | null;
  isAuthLoading: boolean;
  state: AppState | null;
  stateRef: MutableRefObject<AppState | null>;
  onApplyState: (nextState: AppState, deletedSessionIds?: string[]) => Promise<void>;
}

const UPLOAD_DEBOUNCE_MS = 5000;
const MAX_RETRY_ATTEMPTS = 5;

export const useCloudSync = ({
  user,
  isAuthLoading,
  state,
  stateRef,
  onApplyState
}: UseCloudSyncOptions) => {
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState<number | string | null>(null);
  const [conflict, setConflict] = useState<CloudConflictState | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const userRef = useRef<User | null>(user);
  const conflictRef = useRef<CloudConflictState | null>(conflict);
  const reconciledUserIdRef = useRef<string | null>(null);
  const lastSyncedHashRef = useRef<string | null>(null);
  const pendingUploadRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef<number>(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict]);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const isAnyWorkoutActive = Boolean(
    state && Object.values(state.activeWorkouts || {}).some((w) => w.active)
  );

  const openConflictModal = useCallback((userId: string, localState: AppState, cloudRow: CloudGymRow) => {
    const localPayload = extractSyncedPayload(localState);
    const localSummary = buildComparisonSummary(localPayload, localPayload.lastSavedAt);
    const cloudSummary = buildComparisonSummary(cloudRow.state, cloudRow.updated_at);
    setConflict({
      userId,
      cloudRow,
      localSummary,
      cloudSummary
    });
    setSyncStatus('idle');
    setSyncError(null);
  }, []);

  const handleSyncFailure = useCallback(
    async (err: unknown, retryAction: () => void) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
        setSyncError(null);
        return;
      }

      if (err instanceof CloudSyncError && err.isAuthError) {
        if (supabase) {
          try {
            const { data } = await supabase.auth.refreshSession();
            if (data?.session && retryAttemptRef.current === 0) {
              retryAttemptRef.current = 1;
              retryAction();
              return;
            }
          } catch {
            // refresh fallito: mostra errore chiaro senza bloccare l'app
          }
        }
        setSyncStatus('error');
        setSyncError('Sessione scaduta. Effettua nuovamente il login.');
        return;
      }

      if (err instanceof CloudSyncError && err.isRetryable) {
        if (retryAttemptRef.current < MAX_RETRY_ATTEMPTS) {
          retryAttemptRef.current += 1;
          const attempt = retryAttemptRef.current;
          const delayMs = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
          setSyncStatus('error');
          setSyncError(`Connessione instabile, nuovo tentativo (${attempt}/${MAX_RETRY_ATTEMPTS})...`);
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            if (userRef.current && (typeof navigator === 'undefined' || navigator.onLine)) {
              retryAction();
            }
          }, delayMs);
          return;
        }
        setSyncStatus('error');
        setSyncError('Server cloud non raggiungibile dopo 5 tentativi.');
        return;
      }

      const message =
        err instanceof Error && err.message ? err.message : 'Errore imprevisto durante la sincronizzazione.';
      setSyncStatus('error');
      setSyncError(message);
    },
    []
  );

  const performUpload = useCallback(
    async (userId: string, localState: AppState, knownRemoteRevision = 0): Promise<boolean> => {
      const payload = extractSyncedPayload(localState);
      if (isGymStateEmptyOrDefault(payload)) {
        pendingUploadRef.current = false;
        return false;
      }
      const uploadPayload = {
        ...payload,
        lastSavedAt: Date.now()
      };

      const lastSeen = getLastSeenCloudMeta(userId);
      const nextRevision = Math.max(knownRemoteRevision, lastSeen?.revision || 0, 0) + 1;
      const savedMeta = await upsertCloudGymRow(userId, uploadPayload, nextRevision);

      setLastSeenCloudMeta(userId, savedMeta);
      lastSyncedHashRef.current = computeSyncedPayloadHash(uploadPayload);
      pendingUploadRef.current = false;
      retryAttemptRef.current = 0;
      setLastCloudSavedAt(savedMeta.updatedAt || uploadPayload.lastSavedAt);
      setSyncStatus('synced');
      setSyncError(null);
      return true;
    },
    []
  );

  const reconcileWithCloud = useCallback(
    async (targetUserId?: string) => {
      const uid = targetUserId || userRef.current?.id;
      const localState = stateRef.current;
      if (!uid || !localState || !supabase) return;
      if (isSyncingRef.current) return;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
        setSyncError(null);
        return;
      }

      isSyncingRef.current = true;
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const cloudRow = await fetchCloudGymRow(uid);
        if (userRef.current?.id !== uid) return;

        const currentLocalState = stateRef.current || localState;
        const localPayload = extractSyncedPayload(currentLocalState);
        const localEmpty = isGymStateEmptyOrDefault(localPayload);
        const cloudEmpty = !cloudRow || !cloudRow.state || isGymStateEmptyOrDefault(cloudRow.state);

        if (cloudEmpty) {
          reconciledUserIdRef.current = uid;
          if (localEmpty) {
            lastSyncedHashRef.current = computeSyncedPayloadHash(localPayload);
            pendingUploadRef.current = false;
            retryAttemptRef.current = 0;
            setLastCloudSavedAt(cloudRow?.updated_at || null);
            setSyncStatus('synced');
            setSyncError(null);
          } else {
            await performUpload(uid, currentLocalState, cloudRow?.revision || 0);
          }
          return;
        }

        // Il cloud ha dati validi
        const cloudPayload = cloudRow.state!;
        const cloudMeta = {
          revision: cloudRow.revision || 1,
          updatedAt: cloudRow.updated_at
        };

        if (localEmpty) {
          await createSafetyBackup(currentLocalState, 'pre-cloud-restore');
          const { nextState, deletedSessionIds } = applyCloudPayloadToLocalState(currentLocalState, cloudPayload);
          lastSyncedHashRef.current = computeSyncedPayloadHash(extractSyncedPayload(nextState));
          await onApplyState(nextState, deletedSessionIds);

          setLastSeenCloudMeta(uid, cloudMeta);
          reconciledUserIdRef.current = uid;
          pendingUploadRef.current = false;
          retryAttemptRef.current = 0;
          setLastCloudSavedAt(cloudRow.updated_at || cloudPayload.lastSavedAt || Date.now());
          setSyncStatus('synced');
          setSyncError(null);
          return;
        }

        // Entrambi hanno dati
        if (areSyncedPayloadsEqual(localPayload, cloudPayload)) {
          setLastSeenCloudMeta(uid, cloudMeta);
          lastSyncedHashRef.current = computeSyncedPayloadHash(localPayload);
          reconciledUserIdRef.current = uid;
          pendingUploadRef.current = false;
          retryAttemptRef.current = 0;
          setLastCloudSavedAt(cloudRow.updated_at || cloudPayload.lastSavedAt || Date.now());
          setSyncStatus('synced');
          setSyncError(null);
          return;
        }

        const lastSeen = getLastSeenCloudMeta(uid);
        const cloudIsUnseenOrNewer = isCloudMetaNewerThanSeen(cloudRow.revision, cloudRow.updated_at, lastSeen);

        reconciledUserIdRef.current = uid;
        if (cloudIsUnseenOrNewer) {
          openConflictModal(uid, currentLocalState, cloudRow);
        } else {
          await performUpload(uid, currentLocalState, cloudRow.revision || 0);
        }
      } catch (err) {
        await handleSyncFailure(err, () => {
          reconcileWithCloud(uid);
        });
      } finally {
        isSyncingRef.current = false;
      }
    },
    [stateRef, onApplyState, performUpload, openConflictModal, handleSyncFailure]
  );

  const attemptDebouncedUpload = useCallback(
    async (targetUserId?: string) => {
      const uid = targetUserId || userRef.current?.id;
      const localState = stateRef.current;
      if (!uid || !localState || !supabase) return;
      if (conflictRef.current) return;
      if (isSyncingRef.current) return;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        pendingUploadRef.current = true;
        setSyncStatus('offline');
        setSyncError(null);
        return;
      }

      const localPayload = extractSyncedPayload(localState);
      if (isGymStateEmptyOrDefault(localPayload)) {
        pendingUploadRef.current = false;
        return;
      }

      isSyncingRef.current = true;
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const remoteMeta = await fetchCloudGymMeta(uid);
        if (userRef.current?.id !== uid) return;

        const lastSeen = getLastSeenCloudMeta(uid);
        if (remoteMeta.exists && isCloudMetaNewerThanSeen(remoteMeta.revision, remoteMeta.updatedAt, lastSeen)) {
          // Il cloud ha una revision/updated_at più recente: NON sovrascrivere automaticamente!
          const cloudRow = await fetchCloudGymRow(uid);
          if (userRef.current?.id !== uid) return;

          if (cloudRow && cloudRow.state && !isGymStateEmptyOrDefault(cloudRow.state)) {
            const latestLocalState = stateRef.current || localState;
            const latestLocalPayload = extractSyncedPayload(latestLocalState);

            if (areSyncedPayloadsEqual(latestLocalPayload, cloudRow.state)) {
              setLastSeenCloudMeta(uid, {
                revision: cloudRow.revision || 1,
                updatedAt: cloudRow.updated_at
              });
              lastSyncedHashRef.current = computeSyncedPayloadHash(latestLocalPayload);
              pendingUploadRef.current = false;
              retryAttemptRef.current = 0;
              setLastCloudSavedAt(cloudRow.updated_at || cloudRow.state.lastSavedAt || Date.now());
              setSyncStatus('synced');
              return;
            }

            openConflictModal(uid, latestLocalState, cloudRow);
            return;
          }
        }

        const latestLocalState = stateRef.current || localState;
        await performUpload(uid, latestLocalState, remoteMeta.exists ? remoteMeta.revision : 0);
      } catch (err) {
        pendingUploadRef.current = true;
        await handleSyncFailure(err, () => {
          attemptDebouncedUpload(uid);
        });
      } finally {
        isSyncingRef.current = false;
      }
    },
    [stateRef, openConflictModal, performUpload, handleSyncFailure]
  );

  const scheduleDebouncedUpload = useCallback(
    (uid: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        attemptDebouncedUpload(uid);
      }, UPLOAD_DEBOUNCE_MS);
    },
    [attemptDebouncedUpload]
  );

  // 1. Reconciliazione al login / avvio con sessione attiva, e reset pulito al logout
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      clearTimers();
      reconciledUserIdRef.current = null;
      lastSyncedHashRef.current = null;
      pendingUploadRef.current = false;
      retryAttemptRef.current = 0;
      setConflict(null);
      setSyncError(null);
      setLastCloudSavedAt(null);
      setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle');
      return;
    }

    if (!state) return;

    if (reconciledUserIdRef.current !== user.id) {
      retryAttemptRef.current = 0;
      reconcileWithCloud(user.id);
    }
  }, [user, isAuthLoading, state, clearTimers, reconcileWithCloud]);

  // 2. Ascolta ogni salvataggio locale riuscito (subscribePersistenceStatus) senza modificare storage.ts
  useEffect(() => {
    const unsubscribe = subscribePersistenceStatus((status) => {
      if (status !== 'SAVED') return;

      const currentUser = userRef.current;
      const currentState = stateRef.current;
      if (!currentUser || !currentState) return;
      if (reconciledUserIdRef.current !== currentUser.id) return;
      if (conflictRef.current) return;

      const payload = extractSyncedPayload(currentState);
      if (isGymStateEmptyOrDefault(payload)) return;

      const currentHash = computeSyncedPayloadHash(payload);
      if (currentHash === lastSyncedHashRef.current) return;

      pendingUploadRef.current = true;
      retryAttemptRef.current = 0;

      const workoutActive = Object.values(currentState.activeWorkouts || {}).some((w) => w.active);
      if (workoutActive) {
        // Raggruppa le modifiche durante l'allenamento attivo senza fare upload frequenti
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        return;
      }

      scheduleDebouncedUpload(currentUser.id);
    });

    return () => {
      unsubscribe();
    };
  }, [stateRef, scheduleDebouncedUpload]);

  // 3. Quando termina un allenamento attivo, invia le modifiche raggruppate con debounce di 5s
  useEffect(() => {
    if (!user || !state) return;
    if (reconciledUserIdRef.current !== user.id) return;
    if (conflictRef.current) return;

    if (!isAnyWorkoutActive && pendingUploadRef.current) {
      scheduleDebouncedUpload(user.id);
    }
  }, [isAnyWorkoutActive, user, state, scheduleDebouncedUpload]);

  // 4. Gestione eventi online / offline
  useEffect(() => {
    const handleOffline = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setSyncStatus('offline');
      setSyncError(null);
    };

    const handleOnline = () => {
      const uid = userRef.current?.id;
      if (!uid) {
        setSyncStatus('idle');
        return;
      }
      retryAttemptRef.current = 0;
      if (reconciledUserIdRef.current !== uid) {
        reconcileWithCloud(uid);
      } else if (pendingUploadRef.current) {
        attemptDebouncedUpload(uid);
      } else {
        setSyncStatus('synced');
        setSyncError(null);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [reconcileWithCloud, attemptDebouncedUpload]);

  // Cleanup timer al dismount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // 5. Azioni manuali (Sincronizza ora / Scarica dal cloud)
  const syncNow = useCallback(async () => {
    if (!userRef.current) return;
    clearTimers();
    retryAttemptRef.current = 0;
    await reconcileWithCloud(userRef.current.id);
  }, [clearTimers, reconcileWithCloud]);

  const downloadFromCloud = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const uid = userRef.current?.id;
    const localState = stateRef.current;
    if (!uid || !localState || !supabase) {
      return { ok: false, error: 'Account non connesso.' };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return { ok: false, error: 'Dispositivo offline. Riprova quando sei connesso.' };
    }

    clearTimers();
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const cloudRow = await fetchCloudGymRow(uid);
      if (!cloudRow || !cloudRow.state || isGymStateEmptyOrDefault(cloudRow.state)) {
        setSyncStatus('synced');
        return { ok: false, error: 'Nessun dato salvato nel cloud per questo account.' };
      }

      await createSafetyBackup(localState, 'pre-cloud-restore');
      const { nextState, deletedSessionIds } = applyCloudPayloadToLocalState(localState, cloudRow.state);
      lastSyncedHashRef.current = computeSyncedPayloadHash(extractSyncedPayload(nextState));
      await onApplyState(nextState, deletedSessionIds);

      setLastSeenCloudMeta(uid, {
        revision: cloudRow.revision || 1,
        updatedAt: cloudRow.updated_at
      });
      reconciledUserIdRef.current = uid;
      pendingUploadRef.current = false;
      retryAttemptRef.current = 0;
      setConflict(null);
      setLastCloudSavedAt(cloudRow.updated_at || cloudRow.state.lastSavedAt || Date.now());
      setSyncStatus('synced');
      setSyncError(null);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore durante il download dal cloud.';
      setSyncStatus('error');
      setSyncError(msg);
      return { ok: false, error: msg };
    } finally {
      isSyncingRef.current = false;
    }
  }, [stateRef, clearTimers, onApplyState]);

  // 6. Risoluzione conflitto (3 scelte)
  const resolveConflict = useCallback(
    async (choice: CloudConflictChoice) => {
      const activeConflict = conflictRef.current;
      const localState = stateRef.current;
      if (!activeConflict || !localState || isResolvingConflict) return;

      const { userId, cloudRow } = activeConflict;
      setIsResolvingConflict(true);
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        if (choice === 'local') {
          await performUpload(userId, localState, cloudRow.revision || 0);
          setConflict(null);
        } else if (choice === 'cloud') {
          await createSafetyBackup(localState, 'pre-cloud-restore');
          const { nextState, deletedSessionIds } = applyCloudPayloadToLocalState(
            localState,
            cloudRow.state || {}
          );
          lastSyncedHashRef.current = computeSyncedPayloadHash(extractSyncedPayload(nextState));
          await onApplyState(nextState, deletedSessionIds);

          setLastSeenCloudMeta(userId, {
            revision: cloudRow.revision || 1,
            updatedAt: cloudRow.updated_at
          });
          pendingUploadRef.current = false;
          retryAttemptRef.current = 0;
          setLastCloudSavedAt(cloudRow.updated_at || cloudRow.state?.lastSavedAt || Date.now());
          setSyncStatus('synced');
          setConflict(null);
        } else if (choice === 'merge') {
          await createSafetyBackup(localState, 'pre-cloud-restore');
          const { nextState, deletedSessionIds } = mergeLocalAndCloudStates(
            localState,
            cloudRow.state || {},
            cloudRow.updated_at
          );
          lastSyncedHashRef.current = computeSyncedPayloadHash(extractSyncedPayload(nextState));
          await onApplyState(nextState, deletedSessionIds);
          await performUpload(userId, nextState, cloudRow.revision || 0);
          setConflict(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Errore durante la risoluzione del conflitto.';
        setSyncStatus('error');
        setSyncError(msg);
      } finally {
        setIsResolvingConflict(false);
      }
    },
    [stateRef, isResolvingConflict, performUpload, onApplyState]
  );

  return {
    syncStatus,
    syncError,
    lastCloudSavedAt,
    conflict,
    isResolvingConflict,
    syncNow,
    downloadFromCloud,
    resolveConflict
  };
};

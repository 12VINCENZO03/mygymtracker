// src/utils/storageWorker.ts

const workerCode = `
  let db = null;
  
  function initDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      // DB Versione 3: Architettura Canonica V2
      const req = indexedDB.open('MyGymDB', 3);
      
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('store')) database.createObjectStore('store');
        if (!database.objectStoreNames.contains('sessions')) database.createObjectStore('sessions');
        if (!database.objectStoreNames.contains('backups')) database.createObjectStore('backups');
      };
      
      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      
      req.onerror = (e) => reject(e.target.error);
    });
  }

  self.onmessage = async function(e) {
    if (e.data.action === 'save') {
      try {
        const database = await initDB();
        const tx = database.transaction(['store', 'sessions'], 'readwrite');
        
        const fullState = e.data.payload;
        
        // Estraiamo la lista delle sessioni V2 per salvarla nel cassetto isolato
        const sessions = fullState.sessionsV2 || [];
        
        // Creiamo lo stato leggero "hotState" (escludendo le sessioni pesanti)
        const hotState = { ...fullState };
        delete hotState.sessionsV2;
        
        // Pulizia definitiva campi legacy
        delete hotState.workoutSessionsHistory;
        delete hotState.weightHistory;
        delete hotState.volumeLog;
        delete hotState.sessionLoadLog;
        delete hotState.allWorkoutDates;
        delete hotState.streakDates;
        delete hotState.scheduleHistoryDates;
        delete hotState.schedaCompletions;
        delete hotState.lastSessionDate;
        delete hotState.exerciseNameRegistry;

        tx.objectStore('store').put(hotState, 'state');
        tx.objectStore('sessions').put(sessions, 'history');
        
        tx.oncomplete = () => self.postMessage({ success: true, id: e.data.id, revision: fullState.revision });
        tx.onerror = (err) => self.postMessage({ success: false, error: 'Transaction error: ' + err, id: e.data.id });
      } catch (err) {
        self.postMessage({ success: false, error: err.message, id: e.data.id });
      }
    }
  };
`;

const blob = typeof Blob !== 'undefined' ? new Blob([workerCode], { type: 'application/javascript' }) : null;

export const storageWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined' && blob
  ? new Worker(URL.createObjectURL(blob))
  : null;

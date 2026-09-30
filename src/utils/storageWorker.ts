// src/utils/storageWorker.ts

const workerCode = `
  let db = null;
  
  function initDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      // Passiamo alla Versione 2 del database per supportare i record separati
      const req = indexedDB.open('MyGymDB', 2);
      
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        // Creiamo le tre "scatole" separate per i dati
        if (!database.objectStoreNames.contains('store')) database.createObjectStore('store');
        if (!database.objectStoreNames.contains('sessions')) database.createObjectStore('sessions');
        if (!database.objectStoreNames.contains('weightsHistory')) database.createObjectStore('weightsHistory');
      };
      
      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Questo codice ascolta i messaggi inviati dall'app principale
  self.onmessage = async function(e) {
    if (e.data.action === 'save') {
      try {
        const database = await initDB();
        const tx = database.transaction(['store', 'sessions', 'weightsHistory'], 'readwrite');
        
        const fullState = e.data.payload;
        
        // Estraiamo i dati molto pesanti dallo stato
        const sessions = fullState.workoutSessionsHistory || [];
        const weights = fullState.weightHistory || {};
        
        // Creiamo uno stato "leggero" rimuovendo le liste giganti
        const hotState = { ...fullState };
        delete hotState.workoutSessionsHistory;
        delete hotState.weightHistory;

        // Salviamo ogni pezzo nel suo cassetto dedicato in background
        tx.objectStore('store').put(hotState, 'state');
        tx.objectStore('sessions').put(sessions, 'history');
        tx.objectStore('weightsHistory').put(weights, 'history');
        
        tx.oncomplete = () => self.postMessage({ success: true, id: e.data.id });
      } catch (err) {
        self.postMessage({ success: false, error: err.message, id: e.data.id });
      }
    }
  };
`;

// Impacchettiamo il worker in modo che Vite lo digerisca senza problemi
const blob = typeof Blob !== 'undefined' ? new Blob([workerCode], { type: 'application/javascript' }) : null;

export const storageWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined' && blob
  ? new Worker(URL.createObjectURL(blob))
  : null;

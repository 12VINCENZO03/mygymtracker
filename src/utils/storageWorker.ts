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
        const payload = e.data.payload;
        const hasSessions = Boolean(payload && Array.isArray(payload.sessionsV2));
        
        const storeNames = hasSessions ? ['store', 'sessions'] : ['store'];
        const tx = database.transaction(storeNames, 'readwrite');
        
        const hotState = { ...payload };
        delete hotState.sessionsV2;
        tx.objectStore('store').put(hotState, 'state');
        
        if (hasSessions) {
          const sessions = payload.sessionsV2 || [];
          const sessionStore = tx.objectStore('sessions');
          // Rimuoviamo l'eventuale chiave monolitica legacy 'history'
          try { sessionStore.delete('history'); } catch (err) {}
          
          // Salviamo ciascuna sessione V2 come record singolo indicizzato con il proprio id
          for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            if (session && session.id) {
              sessionStore.put(session, session.id);
            }
          }
        }
        
        tx.oncomplete = () => self.postMessage({ success: true, id: e.data.id, revision: payload.revision });
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

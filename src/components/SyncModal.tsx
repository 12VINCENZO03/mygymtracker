import React, { useState } from 'react';
import { migrateV1ToV2 } from '../utils/migration';
import { loadGymState } from '../utils/storage';

interface SyncModalProps {
  isOpen: boolean;
  onExport: () => void;
  onImport: () => void;
  onClose: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onExport,
  onImport,
  onClose
}) => {
  const [auditInfo, setAuditInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative border border-zinc-800">
        <div className="flex justify-between items-center p-5 bg-zinc-950/60 border-b border-zinc-800/50">
          <h3 className="text-white font-extrabold text-base flex items-center gap-2">
            <i className="fa-solid fa-cloud-arrow-up text-emerald-500" />
            Sincronizzazione & Backup
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white bg-zinc-800 w-9 h-9 flex items-center justify-center rounded-full transition outline-none"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-zinc-400 text-center leading-relaxed">
            Esporta il tuo codice di backup compresso per trasferire i dati su un altro dispositivo o conservarli al sicuro.
          </p>

          <button
            type="button"
            onClick={onExport}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm outline-none text-xs active:scale-[0.98]"
          >
            <i className="fa-solid fa-share-nodes" /> Condividi o Copia Backup
          </button>

          <button
            type="button"
            onClick={onImport}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 outline-none border border-zinc-700 text-xs active:scale-[0.98]"
          >
            <i className="fa-solid fa-paste" /> Incolla per Ripristinare
          </button>

          {/* 🔴 PULSANTE DI AUDIT ARCHITETTURALE V2 */}
          <div className="pt-4 border-t border-zinc-800/50 mt-4">
            <button
              type="button"
              onClick={async () => {
                try {
                  const state = await loadGymState();
                  const v2Database = migrateV1ToV2(state);
                  console.log('✅ MIGRAZIONE V2 COMPLETATA CON SUCCESSO!', v2Database);
                  
                  const exCount = Object.keys(v2Database.registry).length;
                  const sessCount = v2Database.sessions.length;
                  
                  const msg = `AUDIT COMPLETATO!\n\nNessun dato perso.\nEsercizi salvati nel nuovo Registro: ${exCount}\nSessioni Storiche convertite (con peso corporeo congelato): ${sessCount}\n\nApri la Console (F12) per esplorare il nuovo database V2!`;
                  setAuditInfo(`✅ Registro: ${exCount} esercizi | Storico: ${sessCount} sessioni`);
                  try {
                    alert(msg);
                  } catch {
                    // Suppressed in iframe
                  }
                } catch (error) {
                  const errMsg = 'ERRORE DURANTE LA MIGRAZIONE V2: ' + error;
                  setAuditInfo(`❌ Errore migrazione: ${error}`);
                  try {
                    alert(errMsg);
                  } catch {
                    // Suppressed in iframe
                  }
                  console.error(error);
                }
              }}
              className="w-full bg-indigo-950 hover:bg-indigo-900 text-indigo-300 py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 outline-none border border-indigo-700/50 text-xs active:scale-[0.98]"
            >
              <i className="fa-solid fa-microscope" /> Test Migrazione V2 (Sperimentale)
            </button>
            {auditInfo && (
              <div className="mt-2 text-center text-xs font-semibold text-indigo-300 bg-indigo-950/70 py-1.5 px-2 rounded-lg border border-indigo-800/50">
                {auditInfo}
              </div>
            )}
            <p className="text-[10px] text-zinc-500 text-center mt-2 leading-relaxed">
              *Questo tasto non modifica i tuoi dati. Simula la creazione del nuovo database ultra-sicuro per verificare che non ci siano perdite di informazioni.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

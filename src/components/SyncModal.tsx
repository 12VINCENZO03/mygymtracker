import React from 'react';

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
  if (!isOpen) return null;

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative border border-zinc-800">
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
        </div>
      </div>
    </div>
  );
};

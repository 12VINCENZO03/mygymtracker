import React, { useState } from 'react';
import { PRRecord } from '../types/gym';
import { generateId, getTodayStr } from '../utils/storage';

interface PRModalProps {
  isOpen: boolean;
  prs: PRRecord[];
  onAddPR: (newPR: PRRecord) => void;
  onUpdatePR: (id: string, newWeight: string) => void;
  onDeletePR: (id: string) => void;
  onClose: () => void;
}

export const PRModal: React.FC<PRModalProps> = ({
  isOpen,
  prs,
  onAddPR,
  onUpdatePR,
  onDeletePR,
  onClose
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');

  if (!isOpen) return null;

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newWeight.trim()) return;
    const item: PRRecord = {
      id: generateId(),
      name: newName.trim(),
      weight: newWeight.trim(),
      history: [{ date: getTodayStr(), weight: newWeight.trim() }]
    };
    onAddPR(item);
    setNewName('');
    setNewWeight('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] border border-zinc-800">
        <div className="flex justify-between items-center p-5 bg-zinc-950/60 border-b border-zinc-800/50">
          <h3 className="text-white font-black text-base flex items-center gap-2">
            <i className="fa-solid fa-trophy text-amber-400" />
            I Miei Record Personali (PR)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white bg-zinc-800 w-9 h-9 flex items-center justify-center rounded-full transition outline-none"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3 hide-scrollbar">
          {prs.length === 0 ? (
            <div className="text-zinc-500 text-center py-10 text-xs">
              Nessun PR registrato finora. Aggiungi il tuo primo massimale!
            </div>
          ) : (
            prs.map((pr) => (
              <div key={pr.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/60 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-extrabold text-white text-sm">{pr.name}</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Eliminare il PR per ${pr.name}?`)) onDeletePR(pr.id);
                    }}
                    className="text-zinc-600 hover:text-rose-400 p-1"
                  >
                    <i className="fa-solid fa-trash text-xs" />
                  </button>
                </div>

                <div className="flex justify-between items-baseline mb-3">
                  <div className="text-2xl font-black text-emerald-400">
                    {pr.weight} <span className="text-xs text-zinc-500 font-normal">kg</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const input = prompt(`Nuovo record per ${pr.name} (kg):`, pr.weight);
                      if (input && input.trim()) onUpdatePR(pr.id, input.trim());
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 font-bold transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-pen text-[10px]" /> Aggiorna PR
                  </button>
                </div>

                {pr.history && pr.history.length > 1 && (
                  <div className="pt-2.5 border-t border-zinc-800/50">
                    <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5">
                      Storico Precedente
                    </div>
                    <div className="space-y-1">
                      {pr.history.slice(1).map((h, hIdx) => (
                        <div key={hIdx} className="flex justify-between text-xs text-zinc-400">
                          <span>
                            <i className="fa-regular fa-calendar mr-1 opacity-70" /> {h.date}
                          </span>
                          <span className="font-bold text-zinc-300">{h.weight} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {isAdding && (
            <form onSubmit={handleAddNew} className="bg-zinc-950 p-4 rounded-2xl border border-emerald-500/40 space-y-3">
              <div className="text-xs font-bold text-emerald-400 mb-1">Nuovo Esercizio PR</div>
              <input
                type="text"
                required
                placeholder="Nome esercizio (es. Stacco da terra)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-zinc-900 text-white text-xs p-3 rounded-xl border border-zinc-800 outline-none"
              />
              <input
                type="number"
                step="0.5"
                required
                placeholder="Carico massimale (kg)"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="w-full bg-zinc-900 text-white text-xs p-3 rounded-xl border border-zinc-800 outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold py-2.5 rounded-xl transition"
                >
                  Salva PR
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="bg-zinc-800 text-zinc-400 text-xs font-bold px-4 py-2.5 rounded-xl"
                >
                  Annulla
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="p-4 bg-zinc-950/60 border-t border-zinc-800/50">
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 outline-none border border-zinc-700 text-xs"
            >
              <i className="fa-solid fa-plus text-xs" /> Aggiungi Nuovo Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

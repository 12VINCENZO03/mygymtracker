import React, { useState, useEffect } from 'react';
import { ExtractedBiaData } from '../utils/pdfExtractor';

interface BiaModalProps {
  isOpen: boolean;
  data: ExtractedBiaData | null;
  onConfirm: (data: { date: string; weight: string; height: string; fm: string; ffm: string }) => void;
  onClose: () => void;
}

export const BiaModal: React.FC<BiaModalProps> = ({
  isOpen,
  data,
  onConfirm,
  onClose
}) => {
  const [date, setDate] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [fm, setFm] = useState('');
  const [ffm, setFfm] = useState('');

  useEffect(() => {
    if (data) {
      setDate(data.date || '');
      setWeight(data.weight || '');
      setHeight(data.height || '');
      setFm(data.fm || '');
      setFfm(data.ffm || '');
    }
  }, [data]);

  if (!isOpen) return null;

  const handleCalc = (source: 'weight' | 'fm' | 'ffm') => {
    const w = parseFloat(weight);
    const curFm = parseFloat(fm);
    const curFfm = parseFloat(ffm);

    if (source === 'weight' || source === 'fm') {
      if (!isNaN(w) && !isNaN(curFm)) {
        const calculatedFfm = w * (1 - curFm / 100);
        setFfm(calculatedFfm.toFixed(1));
      }
    } else if (source === 'ffm') {
      if (!isNaN(w) && !isNaN(curFfm) && w > 0) {
        const calculatedFm = (1 - curFfm / w) * 100;
        setFm(calculatedFm.toFixed(1));
      }
    }
  };

  const handleSave = () => {
    onConfirm({ date, weight, height, fm, ffm });
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] transition-opacity animate-in fade-in"
      />
      <div className="fixed bottom-0 left-0 w-full max-w-xl mx-auto right-0 bg-zinc-900 rounded-t-3xl z-[120] p-6 shadow-2xl border-t border-zinc-800 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mb-4" />
        <h3 className="text-white font-black text-lg text-center mb-1">Referto Composizione Corporea (BIA)</h3>
        <p className="text-xs text-zinc-400 text-center mb-5">
          {data && data.foundCount > 0
            ? `Trovati ${data.foundCount} parametri nel referto. Verifica e correggi se necessario:`
            : 'Compila o correggi i valori del tuo test BIA:'}
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Data Referto
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-950 text-white font-bold p-3 rounded-xl border border-zinc-800 outline-none text-sm focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Peso (kg)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="es. 75.5"
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  setTimeout(() => handleCalc('weight'), 50);
                }}
                className="w-full bg-zinc-950 text-white font-bold p-3 rounded-xl border border-zinc-800 outline-none text-center text-sm focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Altezza (cm)
              </label>
              <input
                type="number"
                placeholder="es. 178"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full bg-zinc-950 text-white font-bold p-3 rounded-xl border border-zinc-800 outline-none text-center text-sm focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Massa Grassa (FM %)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="es. 14.2"
                value={fm}
                onChange={(e) => {
                  setFm(e.target.value);
                  setTimeout(() => handleCalc('fm'), 50);
                }}
                className="w-full bg-zinc-950 text-white font-bold p-3 rounded-xl border border-zinc-800 outline-none text-center text-sm focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Massa Magra (FFM kg)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="es. 64.8"
                value={ffm}
                onChange={(e) => {
                  setFm(e.target.value);
                  setTimeout(() => handleCalc('ffm'), 50);
                }}
                className="w-full bg-zinc-950 text-white font-bold p-3 rounded-xl border border-zinc-800 outline-none text-center text-sm focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 outline-none shadow-sm text-sm active:scale-[0.98]"
        >
          <i className="fa-solid fa-check" /> Conferma e Salva
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-transparent hover:bg-zinc-800 text-zinc-400 py-3 rounded-xl mt-2 font-semibold text-xs transition outline-none"
        >
          Annulla
        </button>
      </div>
    </>
  );
};

import React from 'react';

interface EffortModalProps {
  isOpen: boolean;
  isRpe: boolean;
  currentValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export const EffortModal: React.FC<EffortModalProps> = ({
  isOpen,
  isRpe,
  currentValue,
  onSelect,
  onClose
}) => {
  if (!isOpen) return null;

  const rirOptions = [
    {
      value: '3',
      label: '3+',
      sublabel: 'Ampio',
      bgClass: 'bg-emerald-950/30 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/40',
      activeClass: 'bg-emerald-500 text-zinc-950 border-emerald-400 ring-2 ring-emerald-400/60 font-black shadow-lg'
    },
    {
      value: '2',
      label: '2',
      sublabel: 'Target',
      bgClass: 'bg-emerald-950/25 border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/40',
      activeClass: 'bg-emerald-400 text-zinc-950 border-emerald-300 ring-2 ring-emerald-300/60 font-black shadow-lg'
    },
    {
      value: '1',
      label: '1',
      sublabel: 'Duro',
      bgClass: 'bg-amber-950/30 border-amber-600/50 text-amber-300 hover:bg-amber-900/40',
      activeClass: 'bg-amber-400 text-zinc-950 border-amber-300 ring-2 ring-amber-300/60 font-black shadow-lg'
    },
    {
      value: '0',
      label: '0',
      sublabel: 'Limite',
      bgClass: 'bg-rose-950/30 border-rose-600/50 text-rose-300 hover:bg-rose-900/40',
      activeClass: 'bg-rose-400 text-zinc-950 border-rose-300 ring-2 ring-rose-300/60 font-black shadow-lg'
    },
    {
      value: '-1',
      label: 'CED',
      sublabel: 'Cedimento',
      bgClass: 'bg-rose-950/60 border-rose-500/70 text-rose-300 hover:bg-rose-900/60 font-black',
      activeClass: 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/60 font-black shadow-lg'
    }
  ];

  const rpeOptions = [
    { value: '1', label: '1', tier: 'low' },
    { value: '2', label: '2', tier: 'low' },
    { value: '3', label: '3', tier: 'low' },
    { value: '4', label: '4', tier: 'low' },
    { value: '5', label: '5', tier: 'mid' },
    { value: '6', label: '6', tier: 'mid' },
    { value: '7', label: '7', tier: 'mid' },
    { value: '8', label: '8', tier: 'high' },
    { value: '9', label: '9', tier: 'max' },
    { value: '10', label: '10', tier: 'max' }
  ];

  const getRpeStyle = (tier: string, isSelected: boolean) => {
    if (isSelected) {
      if (tier === 'low') return 'bg-zinc-100 text-zinc-950 border-white ring-2 ring-zinc-400 font-black shadow-lg';
      if (tier === 'mid') return 'bg-emerald-500 text-zinc-950 border-emerald-400 ring-2 ring-emerald-400/60 font-black shadow-lg';
      if (tier === 'high') return 'bg-amber-400 text-zinc-950 border-amber-300 ring-2 ring-amber-300/60 font-black shadow-lg';
      return 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/60 font-black shadow-lg';
    }

    if (tier === 'low') return 'bg-zinc-900/90 border-zinc-750 text-zinc-300 hover:bg-zinc-800';
    if (tier === 'mid') return 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/40';
    if (tier === 'high') return 'bg-amber-950/30 border-amber-600/50 text-amber-300 hover:bg-amber-900/40';
    return 'bg-rose-950/40 border-rose-600/60 text-rose-300 hover:bg-rose-900/50';
  };

  const isRirSelected = (val: string) => {
    if (val === '-1') return currentValue === '-1' || currentValue.toLowerCase() === 'ced';
    if (val === '0') return currentValue === '0' || currentValue === '0.5';
    if (val === '1') return currentValue === '1' || currentValue === '1.5';
    if (val === '2') return currentValue === '2' || currentValue === '2.5';
    if (val === '3') return currentValue === '3' || currentValue === '4' || currentValue === '3+';
    return currentValue === val;
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] transition-opacity animate-in fade-in"
      />
      <div className="fixed bottom-0 left-0 w-full max-w-xl mx-auto right-0 bg-zinc-900 rounded-t-3xl z-[100] px-4 py-3.5 shadow-2xl border-t border-zinc-800 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
        <div className="w-10 h-1 bg-zinc-700/60 rounded-full mx-auto mb-2" />

        <div className="flex items-center justify-between mb-2.5 px-1">
          <div>
            <h3 className="text-white font-extrabold text-sm leading-tight">
              {isRpe ? 'Sforzo Percepito (RPE)' : 'Ripetizioni di Riserva (RIR)'}
            </h3>
            <p className="text-[10px] text-zinc-400">
              {isRpe ? 'Scala 1-10: 1-4 Leggero • 5-7 Medio • 8-10 Duro' : 'Ripetizioni che potevi ancora fare'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Non-Cardio: RIR Single Horizontal Row (5 Buttons) */}
        {!isRpe ? (
          <div className="flex gap-1.5 w-full">
            {rirOptions.map((opt) => {
              const selected = isRirSelected(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSelect(opt.value)}
                  className={`flex-1 py-2.5 px-1 rounded-xl border flex flex-col items-center justify-center transition active:scale-95 outline-none min-h-[52px] ${
                    selected ? opt.activeClass : opt.bgClass
                  }`}
                >
                  <span className="text-sm font-black tracking-tight">{opt.label}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${selected ? 'opacity-90' : 'opacity-70'}`}>
                    {opt.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Cardio: RPE 2 Rows of 5 Buttons */
          <div className="grid grid-cols-5 gap-1.5 w-full">
            {rpeOptions.map((opt) => {
              const selected = currentValue === opt.value;
              const style = getRpeStyle(opt.tier, selected);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSelect(opt.value)}
                  className={`py-2 rounded-xl border flex flex-col items-center justify-center transition active:scale-95 outline-none min-h-[44px] ${style}`}
                >
                  <span className="text-xs font-black">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full text-zinc-400 hover:text-zinc-200 py-1.5 mt-2 font-bold text-[11px] transition outline-none text-center"
        >
          Chiudi
        </button>
      </div>
    </>
  );
};

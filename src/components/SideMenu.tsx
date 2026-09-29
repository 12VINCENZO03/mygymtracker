import React, { useState } from 'react';
import { AppState, BodyGoal } from '../types/gym';
import { calculateAllVolumeStats } from '../utils/coach';
import { getTodayStr } from '../utils/storage';

interface SideMenuProps {
  isOpen: boolean;
  state: AppState;
  onClose: () => void;
  onToggleEditMode: () => void;
  onUpdateProfileName: (name: string) => void;
  onSetBodyGoal: (goal: BodyGoal) => void;
  onToggleDeload: () => void;
  onUpdateBodyMetrics: (metrics: Partial<AppState['bodyMetrics']>) => void;
  onUploadPdf: (file: File) => void;
  onOpenHistoryModal: () => void;
  onOpenPRModal: () => void;
  onOpenSyncModal: () => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  state,
  onClose,
  onToggleEditMode,
  onUpdateProfileName,
  onSetBodyGoal,
  onToggleDeload,
  onUpdateBodyMetrics,
  onUploadPdf,
  onOpenHistoryModal,
  onOpenPRModal,
  onOpenSyncModal
}) => {
  const [profileOpen, setProfileOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [biaHistoryOpen, setBiaHistoryOpen] = useState(false);

  if (!isOpen) return null;

  const stats = calculateAllVolumeStats(state.volumeLog || {});
  const maxVol = Math.max(stats.month, stats.lastMonth, 1);
  const hCur = Math.min(100, Math.round((stats.month / maxVol) * 100));
  const hPrev = Math.min(100, Math.round((stats.lastMonth / maxVol) * 100));

  // Calendar for current month
  const d = new Date();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset === -1) startOffset = 6;
  const todayStr = getTodayStr();

  // BMI Calculation
  const w = parseFloat(String(state.bodyMetrics.weight)) || 0;
  const h = parseFloat(String(state.bodyMetrics.height)) || 0;
  const bmi = w > 0 && h > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : '-';

  // Backup reminder
  let backupBanner: React.ReactNode = null;
  if (!state.lastBackupDate) {
    backupBanner = (
      <div className="bg-amber-950/30 border border-amber-900/50 p-3 rounded-2xl">
        <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
          <i className="fa-solid fa-triangle-exclamation" /> Backup Consigliato
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">Non hai ancora esportato una copia dei tuoi dati.</p>
      </div>
    );
  } else {
    const diffDays = Math.ceil(
      Math.abs(new Date().getTime() - new Date(state.lastBackupDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 10) {
      backupBanner = (
        <div className="bg-amber-950/30 border border-amber-900/50 p-3 rounded-2xl">
          <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
            <i className="fa-solid fa-clock" /> Backup Datato ({diffDays}g fa)
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Salva una copia aggiornata per sicurezza.</p>
        </div>
      );
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 z-[80] backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      <div className="fixed top-0 right-0 h-full w-84 max-w-[90vw] bg-zinc-950 z-[90] flex flex-col shadow-2xl border-l border-zinc-800/60 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="header-safe-top p-5 flex justify-between items-center shrink-0 bg-zinc-950/90 backdrop-blur-md z-10 border-b border-zinc-800/40">
          <h2 className="text-white font-extrabold text-base tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-dumbbell text-emerald-500" />
            MyGym Menu
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition outline-none"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-4 pb-12">
          {/* Edit Mode Toggle Card */}
          <div
            onClick={onToggleEditMode}
            role="button"
            tabIndex={0}
            className="bg-zinc-900/60 rounded-2xl p-4 flex justify-between items-center cursor-pointer border border-zinc-800/60 hover:bg-zinc-800/80 transition shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <i className="fa-solid fa-pen-to-square text-emerald-400 text-xs" />
              </div>
              <span className="text-xs font-bold text-zinc-200 tracking-wide">Modalità Modifica</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className={`text-[10px] font-black uppercase tracking-wider ${state.isEditMode ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {state.isEditMode ? 'ATTIVA' : 'OFF'}
              </span>
              <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${state.isEditMode ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${state.isEditMode ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>

          {/* Accordion 1: Profilo Utente & BIA */}
          <div className="bg-zinc-900/60 rounded-3xl overflow-hidden border border-zinc-800/50">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full p-4 flex justify-between items-center hover:bg-zinc-800/40 transition text-left outline-none"
            >
              <span className="text-xs font-extrabold text-zinc-200 tracking-wide flex items-center gap-2.5">
                <i className="fa-solid fa-user text-emerald-400 text-sm" />
                Profilo Utente & BIA
              </span>
              <i className={`fa-solid fa-chevron-down text-xs text-zinc-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="p-4 pt-0 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                    Il tuo Nome
                  </label>
                  <input
                    type="text"
                    value={state.profileName}
                    onChange={(e) => onUpdateProfileName(e.target.value)}
                    placeholder="es. Vincenzo"
                    className="w-full bg-zinc-950 text-white font-bold p-3 rounded-xl outline-none border border-zinc-800 text-xs focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 border-t border-zinc-800/50">
                  <label className="text-[10px] font-bold text-zinc-400 block mb-2 uppercase tracking-wider">
                    Obiettivo & Coach
                  </label>
                  <div className="flex gap-2 mb-3">
                    {(['cut', 'recomp', 'bulk'] as BodyGoal[]).map((goal) => {
                      const isSel = state.bodyGoal === goal;
                      return (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => onSetBodyGoal(isSel ? null : goal)}
                          className={`flex-1 p-2 rounded-xl text-[11px] font-black uppercase transition border ${
                            isSel
                              ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {goal}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                    <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-2">
                      <i className="fa-solid fa-battery-quarter text-amber-500" /> Settimana di scarico
                    </span>
                    <button
                      type="button"
                      onClick={onToggleDeload}
                      className={`w-10 h-5 rounded-full relative transition p-0.5 ${
                        state.deloadActive ? 'bg-amber-500' : 'bg-zinc-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          state.deloadActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* BIA Metrics */}
                <div className="pt-2 border-t border-zinc-800/50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Composizione Corporea (BIA)
                    </label>
                  </div>

                  <label className="w-full bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition mb-3">
                    <i className="fa-solid fa-file-pdf text-rose-500" />
                    <span>Importa Referto PDF</span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUploadPdf(file);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl flex items-center">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase w-12 pl-1">Peso</span>
                      <input
                        type="number"
                        step="0.1"
                        value={state.bodyMetrics.weight}
                        onChange={(e) => onUpdateBodyMetrics({ weight: e.target.value })}
                        placeholder="kg"
                        className="bg-transparent text-white font-bold w-full text-right outline-none text-xs"
                      />
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl flex items-center">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase w-12 pl-1">Alt.</span>
                      <input
                        type="number"
                        value={state.bodyMetrics.height}
                        onChange={(e) => onUpdateBodyMetrics({ height: e.target.value })}
                        placeholder="cm"
                        className="bg-transparent text-white font-bold w-full text-right outline-none text-xs"
                      />
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl flex items-center">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase w-12 pl-1 leading-tight">FM %</span>
                      <input
                        type="number"
                        step="0.1"
                        value={state.bodyMetrics.fm}
                        onChange={(e) => onUpdateBodyMetrics({ fm: e.target.value })}
                        placeholder="%"
                        className="bg-transparent text-white font-bold w-full text-right outline-none text-xs"
                      />
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl flex items-center">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase w-12 pl-1 leading-tight">MM kg</span>
                      <input
                        type="number"
                        step="0.1"
                        value={state.bodyMetrics.ffm}
                        onChange={(e) => onUpdateBodyMetrics({ ffm: e.target.value })}
                        placeholder="kg"
                        className="bg-transparent text-white font-bold w-full text-right outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">BMI Calcolato</span>
                    <span className="text-xs font-black text-emerald-400">{bmi}</span>
                  </div>

                  {/* Storico BIA accordion */}
                  <div className="mt-3 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setBiaHistoryOpen(!biaHistoryOpen)}
                      className="w-full p-2.5 flex justify-between items-center hover:bg-zinc-900 transition text-left outline-none"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Storico BIA ({state.bodyMetricsHistory.length})
                      </span>
                      <i className={`fa-solid fa-chevron-down text-[10px] text-zinc-500 transition-transform ${biaHistoryOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {biaHistoryOpen && (
                      <div className="p-3 pt-0 space-y-2 max-h-48 overflow-y-auto hide-scrollbar">
                        {state.bodyMetricsHistory.length === 0 ? (
                          <div className="text-[11px] text-zinc-500 italic py-2">Nessun referto archiviato.</div>
                        ) : (
                          state.bodyMetricsHistory.map((hEntry, hIdx) => {
                            const prev = hIdx < state.bodyMetricsHistory.length - 1 ? state.bodyMetricsHistory[hIdx + 1] : null;
                            const curW = parseFloat(String(hEntry.weight));
                            const prevW = prev ? parseFloat(String(prev.weight)) : NaN;
                            const diffW = !isNaN(curW) && !isNaN(prevW) ? (curW - prevW).toFixed(1) : null;

                            return (
                              <div key={hIdx} className="flex justify-between items-center py-1.5 border-b border-zinc-900 last:border-0 text-xs">
                                <span className="font-bold text-zinc-400 text-[11px]">{hEntry.date}</span>
                                <div className="text-right text-[11px] space-x-2">
                                  {hEntry.weight && (
                                    <span className="text-white">
                                      {hEntry.weight}kg{' '}
                                      {diffW && (
                                        <span className={parseFloat(diffW) > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                          ({parseFloat(diffW) > 0 ? `+${diffW}` : diffW})
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {hEntry.fm && <span className="text-zinc-400">FM: {hEntry.fm}%</span>}
                                  {hEntry.ffm && <span className="text-emerald-400">MM: {hEntry.ffm}kg</span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 2: Progressi & Cronologia */}
          <div className="bg-zinc-900/60 rounded-3xl overflow-hidden border border-zinc-800/50">
            <button
              type="button"
              onClick={() => setProgressOpen(!progressOpen)}
              className="w-full p-4 flex justify-between items-center hover:bg-zinc-800/40 transition text-left outline-none"
            >
              <span className="text-xs font-extrabold text-zinc-200 tracking-wide flex items-center gap-2.5">
                <i className="fa-solid fa-chart-simple text-emerald-400 text-sm" />
                Progressi & Cronologia
              </span>
              <i className={`fa-solid fa-chevron-down text-xs text-zinc-500 transition-transform ${progressOpen ? 'rotate-180' : ''}`} />
            </button>

            {progressOpen && (
              <div className="p-4 pt-0 space-y-4">
                {/* Volume Bar Comparison */}
                <div className="flex items-end gap-3 h-24 border-b border-zinc-800/60 pb-2">
                  <div className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div
                      className="w-full bg-zinc-800 rounded-t-md relative flex flex-col justify-end"
                      style={{ height: `${hPrev}%` }}
                    >
                      <span className="text-[9px] text-zinc-400 font-bold text-center w-full absolute -top-4">
                        {(stats.lastMonth / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-bold">Mese Scorso</span>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div
                      className="w-full bg-emerald-500 rounded-t-md relative flex flex-col justify-end"
                      style={{ height: `${hCur}%` }}
                    >
                      <span className="text-[9px] text-emerald-300 font-bold text-center w-full absolute -top-4">
                        {(stats.month / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-200 font-bold">Questo Mese</span>
                  </div>
                </div>

                {/* Monthly Workout Attendance Calendar */}
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/60">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 mb-2 flex items-center gap-1.5">
                    <i className="fa-regular fa-calendar-check text-emerald-500" /> Frequenza Mensile
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, idx) => (
                      <div key={idx} className="text-center text-[9px] text-zinc-500 font-bold mb-1">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const isWorkout = state.allWorkoutDates?.includes(dateStr);
                      const isToday = dateStr === todayStr;

                      return (
                        <div
                          key={dayNum}
                          className={`aspect-square rounded-full flex items-center justify-center text-[9px] font-bold mx-auto w-5 h-5 ${
                            isWorkout && isToday
                              ? 'bg-emerald-500 text-zinc-950 ring-2 ring-emerald-300'
                              : isWorkout
                              ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                              : isToday
                              ? 'ring-1 ring-zinc-500 text-white'
                              : 'text-zinc-600'
                          }`}
                        >
                          {dayNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onOpenHistoryModal();
                    onClose();
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800/60 hover:bg-zinc-800 text-zinc-300 p-3.5 rounded-2xl font-bold transition flex items-center justify-between outline-none text-xs"
                >
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-clock-rotate-left text-zinc-400" />
                    <span>Cronologia Allenamenti ({state.workoutSessionsHistory.length})</span>
                  </div>
                  <i className="fa-solid fa-chevron-right text-xs text-zinc-600" />
                </button>
              </div>
            )}
          </div>

          {/* Accordion 3: Strumenti & Backup */}
          <div className="bg-zinc-900/60 rounded-3xl overflow-hidden border border-zinc-800/50">
            <button
              type="button"
              onClick={() => setToolsOpen(!toolsOpen)}
              className="w-full p-4 flex justify-between items-center hover:bg-zinc-800/40 transition text-left outline-none"
            >
              <span className="text-xs font-extrabold text-zinc-200 tracking-wide flex items-center gap-2.5">
                <i className="fa-solid fa-toolbox text-emerald-400 text-sm" />
                Strumenti & Backup
              </span>
              <i className={`fa-solid fa-chevron-down text-xs text-zinc-500 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>

            {toolsOpen && (
              <div className="p-4 pt-0 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    onOpenPRModal();
                    onClose();
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800/60 hover:bg-zinc-800 text-zinc-300 p-3.5 rounded-2xl font-bold transition flex justify-between items-center outline-none text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <i className="fa-solid fa-trophy text-amber-400" />
                    <span>Record PR ({state.prs.length})</span>
                  </div>
                  <i className="fa-solid fa-chevron-right text-xs text-zinc-600" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenSyncModal();
                    onClose();
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800/60 hover:bg-zinc-800 text-zinc-300 p-3.5 rounded-2xl font-bold transition flex justify-between items-center outline-none text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <i className="fa-solid fa-cloud-arrow-up text-emerald-400" />
                    <span>Sincronizzazione Codice</span>
                  </div>
                  <i className="fa-solid fa-chevron-right text-xs text-zinc-600" />
                </button>
              </div>
            )}
          </div>

          {backupBanner}
        </div>
      </div>
    </>
  );
};

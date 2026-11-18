import React, { useRef, useEffect } from 'react';
import { WorkoutTab } from '../types/gym';
import { formatTime } from '../utils/storage';

interface HeaderProps {
  profileName: string;
  streakCount: number;
  tabs: WorkoutTab[];
  activeTabId: string;
  favoriteTabs: Record<string, boolean>;
  isEditMode: boolean;
  onSelectTab: (tabId: string) => void;
  onToggleSideMenu: () => void;
  onMoveTab: (tabId: string, dir: number) => void;
  onDeleteTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onAddTab: () => void;
  isRestTimerActive?: boolean;
  restTimerSeconds?: number;
  isStopwatchMode?: boolean;
  onSkipTimer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profileName,
  streakCount,
  tabs,
  activeTabId,
  favoriteTabs,
  isEditMode,
  onSelectTab,
  onToggleSideMenu,
  onMoveTab,
  onDeleteTab,
  onRenameTab,
  onAddTab,
  isRestTimerActive,
  restTimerSeconds,
  isStopwatchMode,
  onSkipTimer
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Motore di scroll robusto: calcola la posizione esatta in pixel
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    
    // Usiamo setTimeout per aggirare il problema di rendering istantaneo di WebKit su iOS al reload
    const timer = setTimeout(() => {
      const activeBtn = document.getElementById(`tab-btn-${activeTabId}`);
      if (activeBtn) {
        // Calcola il centro esatto per posizionare la tab in mezzo allo schermo
        const scrollPosition = activeBtn.offsetLeft - (container.clientWidth / 2) + (activeBtn.clientWidth / 2);
        container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activeTabId, tabs.length]);

  return (
    <header className="header-safe-top shrink-0 bg-zinc-950/80 backdrop-blur-xl z-40 border-b border-zinc-800/50">
      <div className="px-4 sm:px-6 py-3.5 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
          {isRestTimerActive && restTimerSeconds !== undefined ? (
            <button
              type="button"
              onClick={onSkipTimer}
              aria-label={isStopwatchMode ? 'Ferma cronometro e prosegui' : 'Salta timer di recupero'}
              className="flex items-center gap-3 cursor-pointer group min-h-11 text-left outline-none"
            >
              <div className={`flex items-center justify-center w-11 h-11 min-w-11 min-h-11 rounded-full ${
                isStopwatchMode 
                  ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30' 
                  : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
              } group-active:scale-95 transition-transform`}>
                <i className="fa-solid fa-stopwatch text-lg animate-pulse" aria-hidden="true" />
              </div>
              <div className="flex flex-col justify-center mt-0.5">
                <span className={`text-[26px] font-mono font-black ${isStopwatchMode ? 'text-amber-400' : 'text-white'} leading-none tracking-tight`}>
                  {isStopwatchMode ? `+${formatTime(restTimerSeconds)}` : formatTime(restTimerSeconds)}
                </span>
                <span className={`text-[11px] font-black ${isStopwatchMode ? 'text-amber-400' : 'text-emerald-400'} uppercase tracking-widest mt-1`}>
                  {isStopwatchMode ? (
                    <>Ferma e Prosegui <i className="fa-solid fa-check ml-0.5" aria-hidden="true" /></>
                  ) : (
                    <>Salta Recupero <i className="fa-solid fa-forward-step ml-0.5" aria-hidden="true" /></>
                  )}
                </span>
              </div>
            </button>
          ) : (
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-emerald-400 flex items-center gap-1.5">
              <span>Ciao, </span>{profileName.trim() ? profileName.trim() : 'Atleta'}!{' '}
              <span className="animate-wave" aria-hidden="true">👋</span>
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 border border-emerald-500/20 shadow-inner min-h-11">
            <span aria-hidden="true">🔥</span>
            <span>{streakCount}</span>
          </div>
          <button
            type="button"
            onClick={onToggleSideMenu}
            aria-label="Apri menu laterale"
            className="text-zinc-300 hover:text-white transition bg-zinc-900 hover:bg-zinc-800 rounded-full w-11 h-11 min-w-11 min-h-11 flex items-center justify-center outline-none border border-zinc-800/80"
          >
            <i className="fa-solid fa-bars text-base" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div ref={scrollContainerRef} className="flex overflow-x-auto hide-scrollbar px-4 py-2 gap-2">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const isFav = Boolean(favoriteTabs[tab.id]);
          const isHome = Boolean(tab.isHome);
          const isFirstTab = idx === 1;
          const isLastTab = idx === tabs.length - 1;

          if (isHome) {
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`px-4 py-2.5 min-h-11 min-w-11 whitespace-nowrap text-xs font-bold transition-all rounded-full flex items-center gap-2 outline-none shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <span aria-hidden="true">🏠</span> Home
              </button>
            );
          }

          if (isEditMode) {
            return (
              <div
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                className={`px-2 py-1.5 flex items-center gap-2 shrink-0 relative rounded-2xl transition-all ${
                  isActive ? 'bg-emerald-950/30 ring-1 ring-emerald-500/40 shadow-sm' : 'bg-zinc-900/60 ring-1 ring-zinc-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isFirstTab}
                    onClick={() => onMoveTab(tab.id, -1)}
                    aria-label={`Sposta scheda ${tab.name} a sinistra`}
                    className="min-w-11 min-h-11 bg-emerald-500 text-zinc-950 rounded-xl hover:bg-emerald-400 disabled:opacity-30 flex items-center justify-center text-xs font-black"
                  >
                    <i className="fa-solid fa-chevron-left" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isLastTab}
                    onClick={() => onMoveTab(tab.id, 1)}
                    aria-label={`Sposta scheda ${tab.name} a destra`}
                    className="min-w-11 min-h-11 bg-emerald-500 text-zinc-950 rounded-xl hover:bg-emerald-400 disabled:opacity-30 flex items-center justify-center text-xs font-black"
                  >
                    <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                  </button>
                </div>
                <input
                  type="text"
                  value={tab.name}
                  onChange={(e) => onRenameTab(tab.id, e.target.value)}
                  onClick={() => onSelectTab(tab.id)}
                  aria-label={`Nome scheda ${tab.name}`}
                  className="bg-zinc-800 text-white font-bold py-2 px-2.5 text-base min-h-11 w-32 rounded-xl outline-none border border-zinc-700 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => onDeleteTab(tab.id)}
                  aria-label={`Elimina scheda ${tab.name}`}
                  className="text-rose-400 min-w-11 min-h-11 flex items-center justify-center hover:bg-rose-950/40 rounded-xl transition"
                >
                  <i className="fa-solid fa-trash text-sm" aria-hidden="true" />
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-4 py-2.5 min-h-11 min-w-11 whitespace-nowrap text-xs font-bold transition-all rounded-full flex items-center gap-1.5 outline-none shrink-0 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              {isFav && <i className="fa-solid fa-star text-[11px] text-amber-400 mr-0.5" aria-hidden="true" />}
              {tab.name}
            </button>
          );
        })}

        {isEditMode && (
          <button
            type="button"
            onClick={onAddTab}
            className="px-4 py-2.5 min-h-11 text-emerald-400 font-extrabold text-xs whitespace-nowrap rounded-full shrink-0 outline-none flex items-center gap-1.5 hover:bg-emerald-500/10 transition-colors"
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Nuova Scheda
          </button>
        )}
      </div>
    </header>
  );
};

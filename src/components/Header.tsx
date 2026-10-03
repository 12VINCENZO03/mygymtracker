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
            <div 
              onClick={onSkipTimer} 
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30 group-active:scale-95 transition-transform">
                <i className="fa-solid fa-stopwatch text-lg animate-pulse" />
              </div>
              <div className="flex flex-col justify-center mt-1">
                <span className="text-[26px] font-mono font-black text-white leading-none tracking-tight">
                  {formatTime(restTimerSeconds)}
                </span>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">
                  Salta Recupero <i className="fa-solid fa-forward-step ml-0.5" />
                </span>
              </div>
            </div>
          ) : (
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-emerald-400 flex items-center gap-1.5">
              <span>Ciao, </span>{profileName.trim() ? profileName.trim() : 'Atleta'}!{' '}
              <span className="animate-wave">👋</span>
            </h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 border border-emerald-500/20 shadow-inner">
            <span>🔥</span>
            <span>{streakCount}</span>
          </div>
          <button
            type="button"
            onClick={onToggleSideMenu}
            aria-label="Apri menu laterale"
            className="text-zinc-300 hover:text-white transition bg-zinc-900 hover:bg-zinc-800 rounded-full w-10 h-10 flex items-center justify-center outline-none border border-zinc-800/80"
          >
            <i className="fa-solid fa-bars text-sm" />
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
                className={`px-4 py-2.5 whitespace-nowrap text-xs font-bold transition-all rounded-full flex items-center gap-2 outline-none shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <span>🏠</span> Home
              </button>
            );
          }

          if (isEditMode) {
            return (
              <div
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                className={`px-2 py-1.5 flex items-center gap-1.5 shrink-0 relative rounded-2xl transition-all ${
                  isActive ? 'bg-emerald-950/30 ring-1 ring-emerald-500/40 shadow-sm' : 'bg-zinc-900/60 ring-1 ring-zinc-800/80'
                }`}
              >
                <div className="flex items-center gap-0.5 bg-emerald-500 text-zinc-950 rounded-md overflow-hidden text-[9px] font-black mr-1">
                  <button
                    type="button"
                    disabled={isFirstTab}
                    onClick={() => onMoveTab(tab.id, -1)}
                    className="px-1.5 py-0.5 hover:bg-emerald-400 disabled:opacity-30"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <button
                    type="button"
                    disabled={isLastTab}
                    onClick={() => onMoveTab(tab.id, 1)}
                    className="px-1.5 py-0.5 hover:bg-emerald-400 disabled:opacity-30"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </div>
                <input
                  type="text"
                  value={tab.name}
                  onChange={(e) => onRenameTab(tab.id, e.target.value)}
                  onClick={() => onSelectTab(tab.id)}
                  className="bg-zinc-800 text-white font-bold py-1 px-2 text-xs w-28 rounded-lg outline-none border border-zinc-700 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => onDeleteTab(tab.id)}
                  className="text-rose-400 p-1.5 hover:bg-rose-950/40 rounded-lg transition"
                >
                  <i className="fa-solid fa-trash text-xs" />
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
              className={`px-4 py-2.5 whitespace-nowrap text-xs font-bold transition-all rounded-full flex items-center gap-1.5 outline-none shrink-0 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              {isFav && <i className="fa-solid fa-star text-[10px] text-amber-400 mr-0.5" />}
              {tab.name}
            </button>
          );
        })}

        {isEditMode && (
          <button
            type="button"
            onClick={onAddTab}
            className="px-4 py-2.5 text-emerald-400 font-extrabold text-xs whitespace-nowrap rounded-full shrink-0 outline-none flex items-center gap-1.5 hover:bg-emerald-500/10 transition-colors"
          >
            <i className="fa-solid fa-plus" /> Nuova Scheda
          </button>
        )}
      </div>
    </header>
  );
};

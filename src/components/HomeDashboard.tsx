import React from 'react';
import { AppState, WorkoutTab } from '../types/gym';
import { calculateAllVolumeStatsV2, getGoalCrossInsight } from '../utils/coach';
import { computeStreakFromSessions, getTabCompletionStats } from '../utils/domain';
import { getTodayStr } from '../utils/storage';

interface HomeDashboardProps {
  state: AppState;
  onSelectTab: (tabId: string) => void;
  onAddFirstTab: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  state,
  onSelectTab,
  onAddFirstTab
}) => {
  // 🔴 MOTORE V2: Statistiche incrollabili
  const stats = calculateAllVolumeStatsV2(state.sessionsV2 || []);
  const loadOggi = state.sessionLoadLog ? state.sessionLoadLog[getTodayStr()] || 0 : 0;
  const nonHomeTabs = state.plan.filter((t) => !t.isHome);

  if (nonHomeTabs.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-emerald-950/20 border border-emerald-900/40 p-8 rounded-3xl text-center shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-3 text-emerald-400 text-2xl">
            <i className="fa-solid fa-dumbbell" />
          </div>
          <div className="font-extrabold text-white text-base mb-1">Nessuna scheda ancora</div>
          <p className="text-xs text-zinc-400 mb-5 max-w-sm mx-auto leading-relaxed">
            Crea la tua prima scheda per organizzare i tuoi esercizi e iniziare a monitorare i progressi.
          </p>
          <button
            type="button"
            onClick={onAddFirstTab}
            className="bg-emerald-500 hover:bg-emerald-400 transition text-zinc-950 px-6 py-3 rounded-xl text-xs font-bold outline-none shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-plus mr-1.5" /> Crea la tua prima scheda
          </button>
        </div>
      </div>
    );
  }

  // Trova l'ultima scheda eseguita per consigliare dinamicamente la successiva
  let recommendedTabId = nonHomeTabs[0]?.id;
  
  if (nonHomeTabs.length > 0) {
    let mostRecentTabId: string | null = null;
    let maxTime = 0;

    nonHomeTabs.forEach(tab => {
      const completion = getTabCompletionStats(state.sessionsV2, tab.id);
      const time = completion.lastCompletedAt || 0;
      if (time > maxTime) {
        maxTime = time;
        mostRecentTabId = tab.id;
      }
    });

    // Se c'è uno storico, suggeriamo la scheda successiva nell'elenco (in modo ciclico)
    if (mostRecentTabId) {
      const currentIndex = nonHomeTabs.findIndex(t => t.id === mostRecentTabId);
      const nextIndex = (currentIndex + 1) % nonHomeTabs.length;
      recommendedTabId = nonHomeTabs[nextIndex].id;
    }
  }

  // 🔴 CANONICAL V2: Streak calcolato dallo storico immutabile (filtrato su preferite se presenti)
  const favoriteTabIds = Object.keys(state.favoriteTabs || {}).filter(k => state.favoriteTabs[k]);
  const streak = computeStreakFromSessions(state.sessionsV2, favoriteTabIds.length > 0 ? favoriteTabIds : undefined);
  const goalInsight = getGoalCrossInsight(state, stats);
  const lastBia = state.bodyMetricsHistory && state.bodyMetricsHistory[0] ? state.bodyMetricsHistory[0] : null;
  const lastBiaText = lastBia ? `${lastBia.date}` : 'Nessuna';

  const renderDiffBadge = (current: number, previous: number, hasPrevious: boolean) => {
    if (!hasPrevious) {
      return <span className="text-[9px] font-normal text-zinc-500 ml-1">primo periodo</span>;
    }
    if (previous === 0) {
      return current > 0 ? (
        <span className="text-[10px] font-bold text-emerald-400 ml-1 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/50">
          +100%
        </span>
      ) : null;
    }
    const diff = ((current - previous) / previous) * 100;
    if (diff > 0) {
      return (
        <span className="text-[10px] font-bold text-emerald-400 ml-1 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/50">
          +{diff.toFixed(1)}%
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="text-[10px] font-bold text-rose-400 ml-1 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/50">
          {diff.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-zinc-400 ml-1 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50">
        uguale
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Coach Cross Insight */}
      {goalInsight && (
        <div className="bg-amber-950/30 border border-amber-900/50 text-amber-400 text-xs p-4 rounded-2xl flex items-start gap-2.5 shadow-sm">
          <i className="fa-solid fa-triangle-exclamation mt-0.5 text-sm" />
          <div>
            <b>Coach Insight:</b> {goalInsight}
          </div>
        </div>
      )}

      {/* Carousel Schede */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-white font-extrabold text-sm flex items-center gap-2">
            <i className="fa-solid fa-layer-group text-emerald-500" /> Le tue Schede
          </h2>
        </div>
        
        {/* Contenitore scorrevole in orizzontale */}
        <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar snap-x px-1">
          {nonHomeTabs.map((tab) => {
            const isRecommended = tab.id === recommendedTabId;
            const completion = getTabCompletionStats(state.sessionsV2, tab.id);
            const lastDone = completion.lastCompletedAt ? new Date(completion.lastCompletedAt) : null;
            
            let timeText = 'Mai eseguita';
            if (lastDone) {
               const diffDays = Math.floor((Date.now() - lastDone.getTime()) / (1000 * 60 * 60 * 24));
               if (diffDays === 0) timeText = 'Oggi';
               else if (diffDays === 1) timeText = 'Ieri';
               else timeText = `${diffDays} giorni fa`;
            }

            return (
              <div 
                key={tab.id} 
                className={`shrink-0 w-64 snap-center rounded-3xl p-5 border shadow-sm relative overflow-hidden transition-all ${
                  isRecommended 
                    ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/20' 
                    : 'bg-zinc-900/60 border-zinc-800/60'
                }`}
              >
                {/* Effetto luce superiore per la consigliata */}
                {isRecommended && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                )}
                
                <div className="flex justify-between items-start mb-3">
                  <div className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                    isRecommended ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {isRecommended ? '🔥 Consigliata Oggi' : 'Scheda'}
                  </div>
                </div>
                
                <h3 className="text-white font-black text-lg leading-tight mb-1 truncate">{tab.name}</h3>
                <p className="text-zinc-400 text-xs truncate mb-4">{tab.subtitle || 'Nessun sottotitolo'}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-medium">
                    <i className="fa-regular fa-clock" /> {timeText}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 outline-none ${
                      isRecommended 
                        ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400' 
                        : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                    }`}
                  >
                    Apri
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Streak & BIA Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-500 text-lg shrink-0">
            🔥
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Streak Attuale</div>
            <div className="text-base font-black text-white">
              {streak} {streak === 1 ? 'giorno' : 'giorni'}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/60 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg shrink-0">
            <i className="fa-solid fa-weight-scale" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Ultima BIA</div>
            <div className="text-base font-black text-white truncate max-w-[120px]">{lastBiaText}</div>
          </div>
        </div>
      </div>

      {/* Volume Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/60 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Volume Oggi</div>
          <div className="text-xl font-black text-white">
            {stats.today.toLocaleString()} <span className="text-xs text-zinc-500 font-normal">kg</span>
          </div>
        </div>

        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/60 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Questa Settimana</div>
          <div className="text-xl font-black text-white flex items-baseline">
            {stats.week.toLocaleString()} <span className="text-xs text-zinc-500 font-normal ml-1 mr-1">kg</span>
            {renderDiffBadge(stats.week, stats.lastWeek, stats.hasLastWeek)}
          </div>
        </div>

        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/60 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Questo Mese</div>
          <div className="text-xl font-black text-white flex items-baseline">
            {stats.month.toLocaleString()} <span className="text-xs text-zinc-500 font-normal ml-1 mr-1">kg</span>
            {renderDiffBadge(stats.month, stats.lastMonth, stats.hasLastMonth)}
          </div>
        </div>

        <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/60 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Quest&apos;Anno</div>
          <div className="text-xl font-black text-white flex items-baseline">
            {stats.year.toLocaleString()} <span className="text-xs text-zinc-500 font-normal ml-1 mr-1">kg</span>
            {renderDiffBadge(stats.year, stats.lastYear, stats.hasLastYear)}
          </div>
        </div>
      </div>

      {/* Effort Load */}
      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/60 shadow-sm flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            <i className="fa-solid fa-battery-half text-amber-400" /> Carico di Sforzo Odierno
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Indice cumulativo di fatica (Tempo × RIR)</p>
        </div>
        <div className="text-xl font-black text-amber-400">{loadOggi.toLocaleString()}</div>
      </div>
    </div>
  );
};

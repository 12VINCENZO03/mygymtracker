import React from 'react';
import { AppState, WorkoutTab } from '../types/gym';
import { calculateAllVolumeStats, computeCurrentStreak, getGoalCrossInsight } from '../utils/coach';
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
  const stats = calculateAllVolumeStats(state.volumeLog || {});
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

  // Recommended routine: find oldest completed favorite
  let oldestFav: WorkoutTab | null = null;
  let oldestTime = Date.now();

  for (const tab of state.plan) {
    if (!tab.isHome && state.favoriteTabs && state.favoriteTabs[tab.id]) {
      const lastDone = state.scheduleHistoryDates && state.scheduleHistoryDates[tab.id]
        ? new Date(state.scheduleHistoryDates[tab.id]).getTime()
        : 0;
      if (lastDone <= oldestTime) {
        oldestTime = lastDone;
        oldestFav = tab;
      }
    }
  }

  const recommendedTab: WorkoutTab | null = oldestFav;

  let timeText = 'Mai eseguita';
  if (recommendedTab && oldestTime > 0) {
    const diffDays = Math.floor((Date.now() - oldestTime) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) timeText = 'Oggi';
    else if (diffDays === 1) timeText = 'Ieri';
    else timeText = `${diffDays} giorni fa`;
  }

  const streak = computeCurrentStreak(state.allWorkoutDates || []);
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

      {/* Recommended Routine Card */}
      {recommendedTab && (
        <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-2xl shadow-sm">
          <div className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider mb-2 flex items-center gap-1.5">
            <i className="fa-solid fa-rotate text-[10px]" /> Rotazione Consigliata
          </div>
          <div className="flex justify-between items-center gap-3">
            <div>
              <div className="font-extrabold text-white text-sm">
                {recommendedTab.name}{' '}
                {recommendedTab.subtitle && (
                  <span className="text-xs text-zinc-400 font-normal ml-1">({recommendedTab.subtitle})</span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
                <i className="fa-regular fa-clock text-zinc-500" />
                Ultima esecuzione:{' '}
                <span className="text-zinc-200 font-semibold">{timeText}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab(recommendedTab.id)}
              className="bg-emerald-500 hover:bg-emerald-400 transition text-zinc-950 px-5 py-2.5 rounded-xl text-xs font-bold outline-none shadow-sm active:scale-95 shrink-0"
            >
              Inizia
            </button>
          </div>
        </div>
      )}

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

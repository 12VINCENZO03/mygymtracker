import React from 'react';
import type { CloudConflictChoice, CloudConflictState } from '../hooks/useCloudSync';

interface CloudConflictModalProps {
  conflict: CloudConflictState | null;
  isResolving: boolean;
  error: string | null;
  onResolve: (choice: CloudConflictChoice) => void;
}

export const CloudConflictModal: React.FC<CloudConflictModalProps> = ({
  conflict,
  isResolving,
  error,
  onResolve
}) => {
  if (!conflict) return null;

  const { localSummary, cloudSummary } = conflict;

  return (
    <div className="fixed inset-0 bg-black/90 z-[120] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800">
        <div className="p-5 bg-zinc-950/70 border-b border-zinc-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-code-branch text-amber-400 text-sm" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-white font-extrabold text-sm tracking-tight">
              Conflitto Dati Cloud
            </h3>
            <p className="text-xs text-zinc-400">
              Questo dispositivo e il cloud contengono dati diversi. Scegli come procedere.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Tabella comparativa Dispositivo vs Cloud */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <i className="fa-solid fa-mobile-screen-button text-emerald-400" aria-hidden="true" />
                Questo dispositivo
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Sessioni:</span>
                  <span className="font-extrabold text-white">{localSummary.sessionsCount}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Peso recente:</span>
                  <span className="font-extrabold text-emerald-400">{localSummary.latestWeightLabel}</span>
                </div>
                <div className="pt-1 border-t border-zinc-900">
                  <span className="text-[11px] text-zinc-400 block">Ultimo salvataggio:</span>
                  <span className="text-[11px] font-bold text-zinc-300">{localSummary.lastSavedLabel}</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <i className="fa-solid fa-cloud text-sky-400" aria-hidden="true" />
                Cloud
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Sessioni:</span>
                  <span className="font-extrabold text-white">{cloudSummary.sessionsCount}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">Peso recente:</span>
                  <span className="font-extrabold text-sky-400">{cloudSummary.latestWeightLabel}</span>
                </div>
                <div className="pt-1 border-t border-zinc-900">
                  <span className="text-[11px] text-zinc-400 block">Ultimo salvataggio:</span>
                  <span className="text-[11px] font-bold text-zinc-300">{cloudSummary.lastSavedLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-semibold p-2.5 rounded-xl flex items-start gap-2">
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              disabled={isResolving}
              onClick={() => onResolve('merge')}
              className="w-full min-h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3 px-4 rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isResolving ? (
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-code-merge" aria-hidden="true" />
              )}
              <span>Unisci (consigliato)</span>
            </button>

            <button
              type="button"
              disabled={isResolving}
              onClick={() => onResolve('local')}
              className="w-full min-h-11 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-2xl font-bold text-xs transition border border-zinc-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <i className="fa-solid fa-mobile-screen-button text-emerald-400" aria-hidden="true" />
              <span>Tieni questo dispositivo</span>
            </button>

            <button
              type="button"
              disabled={isResolving}
              onClick={() => onResolve('cloud')}
              className="w-full min-h-11 bg-zinc-950 hover:bg-zinc-800 text-zinc-200 py-3 px-4 rounded-2xl font-bold text-xs transition border border-zinc-800 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <i className="fa-solid fa-cloud-arrow-down text-sky-400" aria-hidden="true" />
              <span>Tieni il cloud</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
            Prima di qualsiasi ripristino o unione viene creato automaticamente un backup di sicurezza locale.
          </p>
        </div>
      </div>
    </div>
  );
};

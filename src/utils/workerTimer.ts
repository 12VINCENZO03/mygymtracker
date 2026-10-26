// src/utils/workerTimer.ts


const workerCode = `
  const intervals = {};
  self.onmessage = function(e) {
    if (e.data.action === 'setInterval') {
      intervals[e.data.id] = setInterval(() => self.postMessage({ id: e.data.id }), e.data.delay);
    } else if (e.data.action === 'clearInterval') {
      clearInterval(intervals[e.data.id]);
      delete intervals[e.data.id];
    }
  };
`;

let timerWorker: Worker | null = null;
try {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    timerWorker = new Worker(URL.createObjectURL(blob));
  }
} catch {
  timerWorker = null;
}

const workerTimers: Record<number, () => void> = {};
let workerTimerIdCounter = 0;

if (timerWorker) {
  timerWorker.onmessage = function (e) {
    const fn = workerTimers[e.data.id];
    if (fn) fn();
  };
  timerWorker.onerror = function () {
    timerWorker = null;
  };
}

export function safeSetInterval(fn: () => void, delay: number): number {
  const id = ++workerTimerIdCounter;
  workerTimers[id] = fn;
  if (timerWorker) {
    try {
      timerWorker.postMessage({ action: 'setInterval', id, delay });
    } catch {
      const timer = window.setInterval(fn, delay);
      workerTimers[id] = () => window.clearInterval(timer);
    }
  } else {
    // Fallback if Web Workers are unavailable or failed
    const timer = window.setInterval(fn, delay);
    workerTimers[id] = () => window.clearInterval(timer);
  }
  return id;
}

export function safeClearInterval(id: number | null | undefined) {
  if (!id) return;
  if (timerWorker) {
    try {
      timerWorker.postMessage({ action: 'clearInterval', id });
    } catch {
      if (typeof workerTimers[id] === 'function') {
        workerTimers[id]();
      }
    }
  } else if (typeof workerTimers[id] === 'function') {
    workerTimers[id]();
  }
  delete workerTimers[id];
}


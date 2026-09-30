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

const blob = typeof Blob !== 'undefined' ? new Blob([workerCode], { type: 'application/javascript' }) : null;
const timerWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined' && blob
  ? new Worker(URL.createObjectURL(blob))
  : null;

const workerTimers: Record<number, () => void> = {};
let workerTimerIdCounter = 0;

if (timerWorker) {
  timerWorker.onmessage = function (e) {
    const fn = workerTimers[e.data.id];
    if (fn) fn();
  };
}

export function safeSetInterval(fn: () => void, delay: number): number {
  const id = ++workerTimerIdCounter;
  workerTimers[id] = fn;
  if (timerWorker) {
    timerWorker.postMessage({ action: 'setInterval', id, delay });
  } else {
    // Fallback if Web Workers are unavailable
    const timer = window.setInterval(fn, delay);
    workerTimers[id] = () => window.clearInterval(timer);
  }
  return id;
}

export function safeClearInterval(id: number | null | undefined) {
  if (!id) return;
  if (timerWorker) {
    timerWorker.postMessage({ action: 'clearInterval', id });
  } else if (workerTimers[id]) {
    workerTimers[id]();
  }
  delete workerTimers[id];
}

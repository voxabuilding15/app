import { useSyncExternalStore } from 'react';

const TICK_MS = 1000;

let snapshot = Date.now();
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    snapshot = Date.now();
    interval = setInterval(() => {
      snapshot = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };
}

const idle = () => () => undefined;
const read = () => snapshot;

/** The current time in epoch ms, refreshed every second while `active`; frozen otherwise. */
export function useSecondClock(active: boolean): number {
  return useSyncExternalStore(active ? subscribe : idle, read);
}

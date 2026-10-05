import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

const TICK_MS = 60_000;

let snapshot = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
const listeners = new Set<() => void>();

function refresh(): void {
  snapshot = Date.now();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    snapshot = Date.now();
    timer = setInterval(refresh, TICK_MS);
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer !== null) {
        clearInterval(timer);
      }
      appStateSubscription?.remove();
      timer = null;
      appStateSubscription = null;
    }
  };
}

/** Current time in epoch ms, refreshed every minute and when the app returns to the foreground. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => snapshot);
}

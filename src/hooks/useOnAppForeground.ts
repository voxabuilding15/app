import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Runs `callback` every time the app returns to the foreground. */
export function useOnAppForeground(callback: () => void): void {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        latest.current();
      }
    });
    return () => subscription.remove();
  }, []);
}

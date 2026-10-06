import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import type { NotificationResponse } from '@/core';
import { useNotificationResponses, useOnAppForeground } from '@/hooks';

import { usePomodoroSettings, useTimerState } from './queries';
import { useFocusAudio } from './use-focus-audio';
import { useTimerActions } from './use-timer-actions';

/** Lets the timer end a moment after its time, so the clock has certainly passed `endsAt`. */
const END_GRACE_MS = 50;

/**
 * Headless component that keeps the timer honest wherever the user is in the app: it catches up
 * after the app was closed, moves on when a running phase ends, applies the buttons on the timer
 * notification, and plays the ambient sounds and tick during focus.
 */
export function PomodoroBridge() {
  const actions = useTimerActions();
  const state = useTimerState();
  const settings = usePomodoroSettings();
  const router = useRouter();

  useEffect(() => {
    void actions.sync().catch(() => undefined);
  }, [actions]);
  useOnAppForeground(() => void actions.sync().catch(() => undefined));

  const endsAt = state.status === 'running' ? state.endsAt : null;
  useEffect(() => {
    if (endsAt === null) {
      return undefined;
    }
    const handle = setTimeout(
      () => void actions.sync(true).catch(() => undefined),
      Math.max(0, endsAt - Date.now()) + END_GRACE_MS,
    );
    return () => clearTimeout(handle);
  }, [endsAt, actions]);

  useNotificationResponses('pomodoro', async (response: NotificationResponse) => {
    if (response.data.pomodoro === undefined) {
      return;
    }
    switch (response.actionId) {
      case 'pause':
        await actions.pause();
        break;
      case 'resume':
        await actions.resume();
        break;
      case 'skip':
        await actions.skip();
        break;
      case 'stop':
        await actions.stop();
        break;
      default:
        await actions.sync();
        router.navigate('/pomodoro');
    }
  });

  useFocusAudio(
    settings.ambientSound,
    settings.tickSound,
    state.status === 'running' && state.kind === 'focus',
  );

  return null;
}

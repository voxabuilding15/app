import { remainingMs, type TimerState } from '../domain/timer';

import { usePomodoroSettings } from './queries';
import { useSecondClock } from './use-clock';
import { useTranslator } from '@/i18n';

/**
 * The time left and how far along the phase is. It lives next to the clock face, so only the
 * face redraws every second while the rest of the screen stays still.
 */
export function useCountdown(state: TimerState) {
  const { t } = useTranslator();
  const settings = usePomodoroSettings();
  const now = useSecondClock(state.status === 'running');
  const remaining = remainingMs(state, now, settings);
  const durationMs = state.status === 'idle' ? remaining : state.durationMs;
  const progress = state.status === 'idle' || durationMs <= 0 ? 0 : 1 - remaining / durationMs;

  const position =
    state.kind === 'focus'
      ? t('Session {value} of {value2}', {
          value: state.cycle + 1,
          value2: settings.sessionsUntilLongBreak,
        })
      : state.kind === 'long_break'
        ? t('You earned a long break')
        : t('Take a short breather');

  return { remaining, progress, position };
}

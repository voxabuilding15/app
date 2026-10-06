import { useMemo } from 'react';
import { Vibration } from 'react-native';

import type { TimerKind, SessionLinks } from '../domain/timer';
import type { TimerResult } from '../domain/timer-usecases';

import { usePomodoroModule } from './module';
import { useInvalidatePomodoro, useSetTimerState } from './queries';

/** Buzz, pause, buzz: the end of a phase. */
const PHASE_END_VIBRATION = [0, 400, 200, 400];

/** Everything that changes the timer, keeping the screens and the saved history in step with it. */
export function useTimerActions() {
  const { timer } = usePomodoroModule();
  const setTimer = useSetTimerState();
  const invalidate = useInvalidatePomodoro();

  return useMemo(() => {
    async function apply(result: TimerResult, live: boolean): Promise<TimerResult> {
      setTimer(result.state);
      if (result.saved > 0) {
        await invalidate();
      }
      // A buzz only makes sense for a phase that ended while the app was open, not one found later.
      if (live && result.completed.length > 0 && timer.settings().vibrate) {
        Vibration.vibrate(PHASE_END_VIBRATION);
      }
      return result;
    }

    return {
      /** Catches up with the clock; `live` is true when called as a running phase reaches its end. */
      sync: (live = false) => timer.sync().then((result) => apply(result, live)),
      start: (kind?: TimerKind) => timer.start(kind).then((result) => apply(result, false)),
      select: (kind: TimerKind) => timer.select(kind).then((result) => apply(result, false)),
      pause: () => timer.pause().then((result) => apply(result, false)),
      resume: () => timer.resume().then((result) => apply(result, false)),
      skip: () => timer.skip().then((result) => apply(result, false)),
      stop: () => timer.stop().then((result) => apply(result, false)),
      setLinks: (links: Partial<SessionLinks>) =>
        timer.setLinks(links).then((result) => apply(result, false)),
    };
  }, [timer, setTimer, invalidate]);
}

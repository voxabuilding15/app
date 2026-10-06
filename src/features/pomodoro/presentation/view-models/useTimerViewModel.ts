import { useCallback } from 'react';

import { useNotice } from '@/hooks';

import {
  remainingMs,
  type SessionLinks,
  type TimerKind,
  type TimerState,
} from '../../domain/timer';
import type { TimerResult } from '../../domain/timer-usecases';
import { useLinkTargets, usePomodoroSettings, useTags, useTimerState } from '../queries';
import { useSecondClock } from '../use-clock';
import { useTimerActions } from '../use-timer-actions';

export interface TimerViewModel {
  state: TimerState;
  /** Time left in the current or waiting phase. */
  remaining: number;
  /** Fraction of the phase that has passed, 0 to 1. */
  progress: number;
  /** "Session 2 of 4" for focus, otherwise what comes after the break. */
  position: string;
  links: SessionLinks;
  tasks: { id: string; title: string }[];
  habits: { id: string; title: string }[];
  tags: { id: string; name: string; color: string }[];
  notice: ReturnType<typeof useNotice>['notice'];
  dismissNotice: () => void;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skip: () => Promise<void>;
  stop: () => Promise<void>;
  select: (kind: TimerKind) => Promise<void>;
  setLinks: (changes: Partial<SessionLinks>) => Promise<void>;
}

export function useTimerViewModel(): TimerViewModel {
  const state = useTimerState();
  const settings = usePomodoroSettings();
  const actions = useTimerActions();
  const targets = useLinkTargets();
  const tags = useTags();
  const { notice, show, dismiss } = useNotice();

  const now = useSecondClock(state.status === 'running');
  const remaining = remainingMs(state, now, settings);
  const durationMs = state.status === 'idle' ? remaining : state.durationMs;
  const progress = state.status === 'idle' || durationMs <= 0 ? 0 : 1 - remaining / durationMs;

  // Actions are queued by the use cases, so there is no need to hold the buttons while one runs.
  const run = useCallback(
    async (action: () => Promise<TimerResult>) => {
      try {
        const result = await action();
        if (result.alerts === 'blocked') {
          show({
            message: 'Notifications are off, so the timer cannot alert you when a phase ends.',
          });
        }
      } catch {
        show({ message: "Couldn't update the timer. Try again." });
      }
    },
    [show],
  );

  const position =
    state.kind === 'focus'
      ? `Session ${state.cycle + 1} of ${settings.sessionsUntilLongBreak}`
      : state.kind === 'long_break'
        ? 'You earned a long break'
        : 'Take a short breather';

  return {
    state,
    remaining,
    progress,
    position,
    links: state.links,
    tasks: targets.data?.tasks ?? [],
    habits: targets.data?.habits ?? [],
    tags: tags.data ?? [],
    notice,
    dismissNotice: dismiss,
    start: () => run(() => actions.start()),
    pause: () => run(actions.pause),
    resume: () => run(actions.resume),
    skip: () => run(actions.skip),
    stop: () => run(actions.stop),
    select: (kind) => run(() => actions.select(kind)),
    setLinks: (changes) => run(() => actions.setLinks(changes)),
  };
}

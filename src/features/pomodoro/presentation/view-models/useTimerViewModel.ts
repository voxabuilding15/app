import { useCallback } from 'react';

import { useNotice } from '@/hooks';

import type { SessionLinks, TimerKind, TimerState } from '../../domain/timer';
import type { TimerResult } from '../../domain/timer-usecases';
import { useLinkTargets, useTags, useTimerState } from '../queries';
import { useTimerActions } from '../use-timer-actions';

export interface TimerViewModel {
  state: TimerState;
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
  const actions = useTimerActions();
  const targets = useLinkTargets();
  const tags = useTags();
  const { notice, show, dismiss } = useNotice();

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

  return {
    state,
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

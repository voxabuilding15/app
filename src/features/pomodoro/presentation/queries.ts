import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Category } from '@/core';

import type { HistoryQuery, LinkTarget, Session, SessionRecord } from '../domain/entities';
import type { PomodoroOverview } from '../domain/stats-usecases';
import type { PomodoroSettings } from '../domain/settings';
import type { TimerState } from '../domain/timer';

import { usePomodoroModule } from './module';

const ROOT = ['pomodoro'] as const;

const TIMER_KEY = [...ROOT, 'timer'] as const;
const SETTINGS_KEY = [...ROOT, 'settings'] as const;

const keys = {
  history: (query: HistoryQuery) => [...ROOT, 'history', query] as const,
  session: (id: string) => [...ROOT, 'session', id] as const,
  overview: (settings: PomodoroSettings) => [...ROOT, 'overview', settings] as const,
  targets: [...ROOT, 'targets'] as const,
  tags: [...ROOT, 'tags'] as const,
};

/** The timer as last saved. It is kept current by the actions and by the clock (see the bridge). */
export function useTimerState(): TimerState {
  const { timer } = usePomodoroModule();
  const { data } = useQuery({
    queryKey: TIMER_KEY,
    queryFn: () => timer.peek(),
    initialData: () => timer.peek(),
    staleTime: Infinity,
  });
  return data;
}

export function usePomodoroSettings(): PomodoroSettings {
  const { timer } = usePomodoroModule();
  const { data } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => timer.settings(),
    initialData: () => timer.settings(),
    staleTime: Infinity,
  });
  return data;
}

export function useHistory(query: HistoryQuery): UseQueryResult<Session[]> {
  const { sessions } = usePomodoroModule();
  return useQuery({
    queryKey: keys.history(query),
    queryFn: () => sessions.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useSession(id: string | null): UseQueryResult<SessionRecord | null> {
  const { sessions } = usePomodoroModule();
  return useQuery({
    queryKey: keys.session(id ?? ''),
    queryFn: () => (id === null ? null : sessions.get(id)),
    enabled: id !== null,
    gcTime: 0,
  });
}

export function useOverview(settings: PomodoroSettings): UseQueryResult<PomodoroOverview> {
  const { stats } = usePomodoroModule();
  return useQuery({
    queryKey: keys.overview(settings),
    queryFn: () => stats.overview(settings),
    placeholderData: keepPreviousData,
  });
}

export function useLinkTargets(): UseQueryResult<{ tasks: LinkTarget[]; habits: LinkTarget[] }> {
  const { sessions } = usePomodoroModule();
  return useQuery({ queryKey: keys.targets, queryFn: () => sessions.linkTargets() });
}

export function useTags(): UseQueryResult<Category[]> {
  const { tags } = usePomodoroModule();
  return useQuery({ queryKey: keys.tags, queryFn: () => tags.list() });
}

/** Refreshes the history, statistics and tags after a write. The timer itself is set directly. */
export function useInvalidatePomodoro(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(
    () =>
      client.invalidateQueries({
        queryKey: ROOT,
        predicate: (query) => query.queryKey[1] !== 'timer' && query.queryKey[1] !== 'settings',
      }),
    [client],
  );
}

export function useSetTimerState(): (state: TimerState) => void {
  const client = useQueryClient();
  return useCallback((state) => client.setQueryData(TIMER_KEY, state), [client]);
}

export function useSetSettings(): (settings: PomodoroSettings) => void {
  const client = useQueryClient();
  return useCallback((settings) => client.setQueryData(SETTINGS_KEY, settings), [client]);
}

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Category } from '@/core';

import type { HabitScope } from '../domain/filters';
import type { HabitSummary } from '../domain/progress';
import type { HabitDetail } from '../domain/usecases';

import { useHabitsModule } from './module';

const ROOT = ['habits'] as const;

const keys = {
  list: (scope: HabitScope) => [...ROOT, 'list', scope] as const,
  detail: (id: string) => [...ROOT, 'detail', id] as const,
  categories: [...ROOT, 'categories'] as const,
};

/** All habits in a scope. Search, filters and sort are applied in memory by the view model. */
export function useHabitList(scope: HabitScope): UseQueryResult<HabitSummary[]> {
  const { habits } = useHabitsModule();
  return useQuery({ queryKey: keys.list(scope), queryFn: () => habits.list(scope) });
}

export function useHabitDetail(id: string | null): UseQueryResult<HabitDetail | null> {
  const { habits } = useHabitsModule();
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => (id === null ? null : habits.detail(id)),
    enabled: id !== null,
    gcTime: 0,
  });
}

export function useHabitCategories(): UseQueryResult<Category[]> {
  const { habits } = useHabitsModule();
  return useQuery({ queryKey: keys.categories, queryFn: () => habits.categories.list() });
}

/** Refreshes every Habits query after a write. */
export function useInvalidateHabits(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ROOT }), [client]);
}

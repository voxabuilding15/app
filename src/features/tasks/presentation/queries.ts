import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Category, Label, Task, TaskDetail, TaskStats } from '../domain/entities';
import type { TaskFilter, TaskSort } from '../domain/filters';

import { useTasksModule } from './module';

const ROOT = ['tasks'] as const;

const keys = {
  list: (filter: TaskFilter, sort: TaskSort, limit: number) =>
    [...ROOT, 'list', filter, sort, limit] as const,
  stats: [...ROOT, 'stats'] as const,
  detail: (id: string) => [...ROOT, 'detail', id] as const,
  taxonomy: [...ROOT, 'taxonomy'] as const,
};

export function useTaskList(
  filter: TaskFilter,
  sort: TaskSort,
  limit: number,
): UseQueryResult<Task[]> {
  const { tasks } = useTasksModule();
  return useQuery({
    queryKey: keys.list(filter, sort, limit),
    queryFn: () => tasks.list(filter, sort, limit),
    placeholderData: keepPreviousData,
  });
}

export function useTaskStats(): UseQueryResult<TaskStats> {
  const { tasks } = useTasksModule();
  return useQuery({ queryKey: keys.stats, queryFn: () => tasks.stats() });
}

export function useTaskDetail(id: string | null): UseQueryResult<TaskDetail | null> {
  const { tasks } = useTasksModule();
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => (id === null ? null : tasks.get(id)),
    enabled: id !== null,
    // The form owns its own editable copy; never replace it while the user is typing.
    gcTime: 0,
  });
}

interface Taxonomy {
  categories: Category[];
  labels: Label[];
}

export function useTaxonomy(): UseQueryResult<Taxonomy> {
  const { taxonomy } = useTasksModule();
  return useQuery({
    queryKey: keys.taxonomy,
    queryFn: async () => {
      const [categories, labels] = await Promise.all([taxonomy.categories(), taxonomy.labels()]);
      return { categories, labels };
    },
  });
}

/** Refreshes every Tasks query after a write. */
export function useInvalidateTasks(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ROOT }), [client]);
}

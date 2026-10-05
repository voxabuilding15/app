import type { Priority } from './entities';

export type TaskScope = 'active' | 'completed' | 'archived';
export type DueFilter = 'any' | 'today' | 'overdue' | 'upcoming' | 'none';

export { NO_CATEGORY } from '@/core';

export interface TaskFilter {
  scope: TaskScope;
  search: string;
  priorities: Priority[];
  /** null = any category, NO_CATEGORY = uncategorized, otherwise a category id. */
  categoryId: string | null;
  labelIds: string[];
  due: DueFilter;
}

export type SortField = 'due' | 'priority' | 'created' | 'title' | 'completed';
type SortDirection = 'asc' | 'desc';

export interface TaskSort {
  field: SortField;
  direction: SortDirection;
}

export const DEFAULT_FILTER: TaskFilter = {
  scope: 'active',
  search: '',
  priorities: [],
  categoryId: null,
  labelIds: [],
  due: 'any',
};

export function defaultSortFor(scope: TaskScope): TaskSort {
  switch (scope) {
    case 'completed':
      return { field: 'completed', direction: 'desc' };
    case 'archived':
      return { field: 'created', direction: 'desc' };
    default:
      return { field: 'due', direction: 'asc' };
  }
}

/** Number of advanced filters in effect (search and scope are shown separately). */
export function countActiveFilters(filter: TaskFilter): number {
  return (
    (filter.priorities.length > 0 ? 1 : 0) +
    (filter.categoryId !== null ? 1 : 0) +
    (filter.labelIds.length > 0 ? 1 : 0) +
    (filter.due !== 'any' ? 1 : 0)
  );
}

import { NO_CATEGORY } from '@/core';

import type { HabitPeriod } from './entities';
import { progressFraction, type HabitSummary } from './progress';

export type HabitScope = 'active' | 'archived';

/**
 * - due: scheduled today and not finished yet (and not paused).
 * - done: the current period's goal is met.
 * - paused: currently paused.
 */
export type HabitStatusFilter = 'any' | 'due' | 'done' | 'paused';

export interface HabitFilter {
  search: string;
  period: HabitPeriod | null;
  /** null = any category, NO_CATEGORY = uncategorized, otherwise a category id. */
  categoryId: string | null;
  status: HabitStatusFilter;
}

export type HabitSortField = 'created' | 'name' | 'streak' | 'progress';
type SortDirection = 'asc' | 'desc';

export interface HabitSort {
  field: HabitSortField;
  direction: SortDirection;
}

export const DEFAULT_HABIT_FILTER: HabitFilter = {
  search: '',
  period: null,
  categoryId: null,
  status: 'any',
};

export const DEFAULT_HABIT_SORT: HabitSort = { field: 'created', direction: 'asc' };

/** Number of advanced filters in effect (search is shown separately). */
export function countActiveHabitFilters(filter: HabitFilter): number {
  return (
    (filter.period !== null ? 1 : 0) +
    (filter.categoryId !== null ? 1 : 0) +
    (filter.status !== 'any' ? 1 : 0)
  );
}

function matchesStatus(summary: HabitSummary, status: HabitStatusFilter): boolean {
  const { habit, current } = summary;
  switch (status) {
    case 'paused':
      return habit.paused;
    case 'done':
      return !habit.paused && current.state === 'satisfied';
    case 'due':
      return !habit.paused && summary.scheduledToday && current.state === 'pending';
    default:
      return true;
  }
}

export function filterHabits(
  summaries: readonly HabitSummary[],
  filter: HabitFilter,
): HabitSummary[] {
  const term = filter.search.trim().toLowerCase();
  return summaries.filter((summary) => {
    const { habit } = summary;
    if (term !== '' && !`${habit.name}\n${habit.notes}`.toLowerCase().includes(term)) {
      return false;
    }
    if (filter.period !== null && habit.period !== filter.period) {
      return false;
    }
    if (filter.categoryId === NO_CATEGORY) {
      if (habit.category !== null) {
        return false;
      }
    } else if (filter.categoryId !== null && habit.category?.id !== filter.categoryId) {
      return false;
    }
    return matchesStatus(summary, filter.status);
  });
}

function compare(a: HabitSummary, b: HabitSummary, field: HabitSortField): number {
  switch (field) {
    case 'name':
      return a.habit.name.localeCompare(b.habit.name, undefined, { sensitivity: 'base' });
    case 'streak':
      return a.streak - b.streak;
    case 'progress':
      return progressFraction(a) - progressFraction(b);
    default:
      return a.habit.createdAt - b.habit.createdAt;
  }
}

/** Stable sort; ties fall back to creation order so the list never reshuffles. */
export function sortHabits(summaries: readonly HabitSummary[], sort: HabitSort): HabitSummary[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...summaries].sort(
    (a, b) => direction * compare(a, b, sort.field) || a.habit.createdAt - b.habit.createdAt,
  );
}

/** How many of today's scheduled, unpaused habits are done. */
export function todayOverview(summaries: readonly HabitSummary[]): { due: number; done: number } {
  let due = 0;
  let done = 0;
  for (const summary of summaries) {
    if (summary.habit.paused || !summary.scheduledToday || summary.current.state === 'excused') {
      continue;
    }
    due += 1;
    if (summary.current.state === 'satisfied') {
      done += 1;
    }
  }
  return { due, done };
}

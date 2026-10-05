import {
  NO_CATEGORY,
  addDaysToKey,
  dateKeyToNoon,
  firstDayOfMonthKey,
  startOfDay,
  startOfWeekKey,
  toDateKey,
  addMonthsToKey,
} from '@/core';

import type { TransactionType } from './entities';

export { NO_CATEGORY };

export type RangePreset = 'all' | 'today' | 'week' | 'month' | 'lastMonth' | 'year';

export interface TransactionFilter {
  search: string;
  /** Empty means every type. */
  types: readonly TransactionType[];
  /** Matches transactions leaving or entering this account. */
  accountId: string | null;
  /** A category id, `NO_CATEGORY`, or null for any. */
  categoryId: string | null;
  range: RangePreset;
}

export const DEFAULT_FILTER: TransactionFilter = {
  search: '',
  types: [],
  accountId: null,
  categoryId: null,
  range: 'all',
};

export type TransactionSortField = 'date' | 'amount';

export interface TransactionSort {
  field: TransactionSortField;
  direction: 'asc' | 'desc';
}

export const DEFAULT_SORT: TransactionSort = { field: 'date', direction: 'desc' };

/** Half-open range of epoch ms: from is included, to is not. */
export interface TimeRange {
  from: number;
  to: number;
}

/** Local midnight at the start of a day key. */
function dayStartMs(key: string): number {
  return startOfDay(dateKeyToNoon(key));
}

/** Range covering the days `fromKey` to `toKey`, both included. */
export function dayRange(fromKey: string, toKey: string): TimeRange {
  return { from: dayStartMs(fromKey), to: dayStartMs(addDaysToKey(toKey, 1)) };
}

/** The time range of a preset relative to `now`; null for "any time". Weeks start on Monday. */
export function presetRange(preset: RangePreset, now: number): TimeRange | null {
  const today = toDateKey(now);
  switch (preset) {
    case 'today':
      return dayRange(today, today);
    case 'week': {
      const start = startOfWeekKey(today);
      return dayRange(start, addDaysToKey(start, 6));
    }
    case 'month': {
      const first = firstDayOfMonthKey(today);
      return dayRange(first, addDaysToKey(addMonthsToKey(first, 1), -1));
    }
    case 'lastMonth': {
      const first = addMonthsToKey(firstDayOfMonthKey(today), -1);
      return dayRange(first, addDaysToKey(addMonthsToKey(first, 1), -1));
    }
    case 'year':
      return dayRange(`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`);
    default:
      return null;
  }
}

export function countActiveFilters(filter: TransactionFilter): number {
  return (
    (filter.types.length > 0 ? 1 : 0) +
    (filter.accountId !== null ? 1 : 0) +
    (filter.categoryId !== null ? 1 : 0) +
    (filter.range !== 'all' ? 1 : 0)
  );
}

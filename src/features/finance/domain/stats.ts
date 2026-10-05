import { addMonthsToKey, firstDayOfMonthKey, lastDayOfMonthKey, type DateKey } from '@/core';

import type { CategoryTotal, FlowTotals } from './entities';
import { dayRange, type TimeRange } from './filters';

export interface MonthTotals extends FlowTotals {
  /** 'YYYY-MM'. */
  month: string;
  range: TimeRange;
}

export const UNCATEGORIZED_NAME = 'Uncategorized';
export const UNCATEGORIZED_COLOR = '#79747E';
const OTHER_NAME = 'Other';

/** The `count` months ending with the month of `today`, oldest first, with their time ranges. */
export function monthRanges(today: DateKey, count: number): { month: string; range: TimeRange }[] {
  const current = firstDayOfMonthKey(today);
  return Array.from({ length: count }, (_, index) => {
    const first = addMonthsToKey(current, index - (count - 1));
    return { month: first.slice(0, 7), range: dayRange(first, lastDayOfMonthKey(first)) };
  });
}

export interface CategorySlice extends CategoryTotal {
  /** Share of the total, between 0 and 1. */
  share: number;
}

/**
 * Orders categories by size and folds everything beyond `maxSlices - 1` into one "Other" slice, so
 * a chart stays readable. Empty and negative totals are dropped.
 */
export function rankCategories(rows: readonly CategoryTotal[], maxSlices: number): CategorySlice[] {
  const positive = rows
    .filter((row) => row.totalMinor > 0)
    .sort((a, b) => b.totalMinor - a.totalMinor);
  const total = positive.reduce((sum, row) => sum + row.totalMinor, 0);
  if (total === 0) {
    return [];
  }

  const shown = positive.length > maxSlices ? positive.slice(0, maxSlices - 1) : positive;
  const rest = positive.slice(shown.length);
  const slices: CategoryTotal[] = [...shown];
  if (rest.length > 0) {
    slices.push({
      id: null,
      name: OTHER_NAME,
      color: UNCATEGORIZED_COLOR,
      totalMinor: rest.reduce((sum, row) => sum + row.totalMinor, 0),
    });
  }
  return slices.map((slice) => ({ ...slice, share: slice.totalMinor / total }));
}

export interface CategoryChange {
  id: string | null;
  name: string;
  color: string;
  currentMinor: number;
  previousMinor: number;
  /** current - previous: positive means more was spent than before. */
  deltaMinor: number;
}

/** Per-category change between two periods, biggest swings first. */
export function compareCategories(
  current: readonly CategoryTotal[],
  previous: readonly CategoryTotal[],
): CategoryChange[] {
  const byKey = new Map<string, CategoryChange>();
  const keyOf = (row: CategoryTotal) => row.id ?? '';

  for (const row of previous) {
    byKey.set(keyOf(row), {
      id: row.id,
      name: row.name,
      color: row.color,
      currentMinor: 0,
      previousMinor: row.totalMinor,
      deltaMinor: -row.totalMinor,
    });
  }
  for (const row of current) {
    const before = byKey.get(keyOf(row));
    byKey.set(keyOf(row), {
      id: row.id,
      name: row.name,
      color: row.color,
      currentMinor: row.totalMinor,
      previousMinor: before?.previousMinor ?? 0,
      deltaMinor: row.totalMinor - (before?.previousMinor ?? 0),
    });
  }
  return [...byKey.values()].sort(
    (a, b) => Math.abs(b.deltaMinor) - Math.abs(a.deltaMinor) || a.name.localeCompare(b.name),
  );
}

export interface CashflowPoint {
  month: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  /** Net of this and every earlier month shown. */
  cumulativeMinor: number;
}

export function cashflowSeries(months: readonly MonthTotals[]): CashflowPoint[] {
  let cumulative = 0;
  return months.map((month) => {
    const netMinor = month.incomeMinor - month.expenseMinor;
    cumulative += netMinor;
    return {
      month: month.month,
      incomeMinor: month.incomeMinor,
      expenseMinor: month.expenseMinor,
      netMinor,
      cumulativeMinor: cumulative,
    };
  });
}

/** Change from `previous` to `current` as a fraction (0.25 = +25%); null when there is no basis. */
export function percentChange(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

import { toDateKey, type Clock } from '@/core';

import {
  cashflowSeries,
  compareCategories,
  monthRanges,
  rankCategories,
  type CashflowPoint,
  type CategoryChange,
  type CategorySlice,
  type MonthTotals,
} from './stats';
import type { TransactionRepository } from './ports';

export const STATS_MONTH_OPTIONS = [3, 6, 12] as const;
export type StatsMonths = (typeof STATS_MONTH_OPTIONS)[number];

/** Which kind of money the category breakdown shows. */
export type Breakdown = 'expense' | 'income';

/** Categories beyond this many are folded into "Other" in the breakdown. */
const MAX_SLICES = 6;

export interface FinanceStats {
  /** Income and expenses for each month, oldest first. */
  months: MonthTotals[];
  cashflow: CashflowPoint[];
  breakdown: Breakdown;
  categories: CategorySlice[];
  categoryTotalMinor: number;
  /** This month against last month. */
  comparison: { current: MonthTotals; previous: MonthTotals; changes: CategoryChange[] };
}

interface StatsUseCaseDeps {
  transactions: TransactionRepository;
  clock: Clock;
}

export function createStatsUseCases({ transactions, clock }: StatsUseCaseDeps) {
  return {
    /** Statistics over the last `monthCount` months, including the current one. */
    async overview(monthCount: StatsMonths, breakdown: Breakdown): Promise<FinanceStats> {
      const ranges = monthRanges(toDateKey(clock.now()), monthCount);
      const months: MonthTotals[] = [];
      for (const { month, range } of ranges) {
        months.push({ month, range, ...(await transactions.flow(range)) });
      }

      const first = months[0];
      const last = months[months.length - 1];
      const previous = months[months.length - 2];
      if (first === undefined || last === undefined || previous === undefined) {
        throw new Error('Statistics need at least two months.');
      }

      const [rangeTotals, currentTotals, previousTotals] = await Promise.all([
        transactions.categoryTotals(breakdown, { from: first.range.from, to: last.range.to }),
        transactions.categoryTotals(breakdown, last.range),
        transactions.categoryTotals(breakdown, previous.range),
      ]);
      const categories = rankCategories(rangeTotals, MAX_SLICES);

      return {
        months,
        cashflow: cashflowSeries(months),
        breakdown,
        categories,
        categoryTotalMinor: rangeTotals.reduce((sum, row) => sum + Math.max(0, row.totalMinor), 0),
        comparison: {
          current: last,
          previous,
          changes: compareCategories(currentTotals, previousTotals),
        },
      };
    },
  };
}

export type StatsUseCases = ReturnType<typeof createStatsUseCases>;

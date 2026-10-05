import {
  addDaysToKey,
  firstDayOfMonthKey,
  lastDayOfMonthKey,
  startOfWeekKey,
  type Category,
  type DateKey,
} from '@/core';

import type { Budget, BudgetPhase, BudgetProgress, BudgetState } from './entities';
import { dayRange, type TimeRange } from './filters';

/** A budget turns "warning" once this share of it has been spent. */
const WARNING_FRACTION = 0.8;

export interface DayRange {
  from: DateKey;
  to: DateKey;
}

/**
 * The days a budget currently covers. Weekly budgets run Monday to Sunday and monthly ones follow
 * the calendar month, both around `today`; custom budgets keep their own dates.
 */
export function budgetDays(
  budget: Pick<Budget, 'period' | 'startDate' | 'endDate'>,
  today: DateKey,
): DayRange {
  switch (budget.period) {
    case 'weekly': {
      const from = startOfWeekKey(today);
      return { from, to: addDaysToKey(from, 6) };
    }
    case 'monthly':
      return { from: firstDayOfMonthKey(today), to: lastDayOfMonthKey(today) };
    default:
      return { from: budget.startDate ?? today, to: budget.endDate ?? today };
  }
}

export function budgetTimeRange(days: DayRange): TimeRange {
  return dayRange(days.from, days.to);
}

function phaseOf(days: DayRange, today: DateKey): BudgetPhase {
  if (today < days.from) {
    return 'upcoming';
  }
  return today > days.to ? 'ended' : 'active';
}

function stateOf(spentMinor: number, amountMinor: number): BudgetState {
  if (spentMinor > amountMinor) {
    return 'over';
  }
  return spentMinor >= amountMinor * WARNING_FRACTION ? 'warning' : 'ok';
}

export function budgetProgress(
  budget: Budget,
  categories: readonly Category[],
  spentMinor: number,
  today: DateKey,
): BudgetProgress {
  const days = budgetDays(budget, today);
  return {
    budget,
    categories: categories.filter((category) => budget.categoryIds.includes(category.id)),
    from: days.from,
    to: days.to,
    spentMinor,
    remainingMinor: budget.amountMinor - spentMinor,
    fraction: budget.amountMinor === 0 ? 0 : spentMinor / budget.amountMinor,
    state: stateOf(spentMinor, budget.amountMinor),
    phase: phaseOf(days, today),
  };
}

/** True when an expense with this category and time counts towards the budget. */
export function budgetCovers(
  budget: Pick<Budget, 'categoryIds'>,
  categoryId: string | null,
): boolean {
  return (
    budget.categoryIds.length === 0 ||
    (categoryId !== null && budget.categoryIds.includes(categoryId))
  );
}

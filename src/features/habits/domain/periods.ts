import {
  addDaysToKey,
  addMonthsToKey,
  firstDayOfMonthKey,
  lastDayOfMonthKey,
  monthOfKey,
  startOfWeekKey,
  type DateKey,
} from '@/core';

import type { HabitPeriod } from './entities';

/** Identifies one goal period: a day (`YYYY-MM-DD`), a week (its Monday) or a month (`YYYY-MM`). */
export type UnitKey = string;

export function unitKeyOf(day: DateKey, period: HabitPeriod): UnitKey {
  switch (period) {
    case 'weekly':
      return startOfWeekKey(day);
    case 'monthly':
      return monthOfKey(day);
    default:
      return day;
  }
}

export function unitRange(unit: UnitKey, period: HabitPeriod): { start: DateKey; end: DateKey } {
  switch (period) {
    case 'weekly':
      return { start: unit, end: addDaysToKey(unit, 6) };
    case 'monthly': {
      const first = `${unit}-01`;
      return { start: first, end: lastDayOfMonthKey(first) };
    }
    default:
      return { start: unit, end: unit };
  }
}

export function nextUnit(unit: UnitKey, period: HabitPeriod): UnitKey {
  switch (period) {
    case 'weekly':
      return addDaysToKey(unit, 7);
    case 'monthly':
      return monthOfKey(addMonthsToKey(firstDayOfMonthKey(`${unit}-01`), 1));
    default:
      return addDaysToKey(unit, 1);
  }
}

export function previousUnit(unit: UnitKey, period: HabitPeriod): UnitKey {
  switch (period) {
    case 'weekly':
      return addDaysToKey(unit, -7);
    case 'monthly':
      return monthOfKey(addMonthsToKey(`${unit}-01`, -1));
    default:
      return addDaysToKey(unit, -1);
  }
}

import {
  addDaysToKey,
  addMonthsClamped,
  firstDayOfMonthKey,
  lastDayOfMonthKey,
  startOfWeekKey,
  type DateKey,
} from '@/core';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

/** Weeks start on Monday throughout the app. */
const WEEK_START = 1;

/** How many days the agenda lists ahead of its anchor day. */
const AGENDA_DAYS = 30;

export interface MonthCell {
  day: DateKey;
  inMonth: boolean;
}

/** Whole Monday-to-Sunday weeks covering the month of `anchor` (4 to 6 rows). */
export function monthGrid(anchor: DateKey): MonthCell[][] {
  const first = firstDayOfMonthKey(anchor);
  const last = lastDayOfMonthKey(anchor);
  const month = first.slice(0, 7);
  const rows: MonthCell[][] = [];

  for (
    let start = startOfWeekKey(first, WEEK_START);
    start <= last;
    start = addDaysToKey(start, 7)
  ) {
    rows.push(
      Array.from({ length: 7 }, (_, offset) => {
        const day = addDaysToKey(start, offset);
        return { day, inMonth: day.startsWith(month) };
      }),
    );
  }
  return rows;
}

export function weekDays(anchor: DateKey): DateKey[] {
  const start = startOfWeekKey(anchor, WEEK_START);
  return Array.from({ length: 7 }, (_, offset) => addDaysToKey(start, offset));
}

/** Inclusive first and last day that a view needs data for. */
export function visibleRange(view: CalendarView, anchor: DateKey): { from: DateKey; to: DateKey } {
  switch (view) {
    case 'month': {
      const grid = monthGrid(anchor);
      return { from: grid[0]![0]!.day, to: grid[grid.length - 1]![6]!.day };
    }
    case 'week': {
      const days = weekDays(anchor);
      return { from: days[0]!, to: days[6]! };
    }
    case 'agenda':
      return { from: anchor, to: addDaysToKey(anchor, AGENDA_DAYS - 1) };
    default:
      return { from: anchor, to: anchor };
  }
}

/** Moves the anchor one step forward (1) or back (-1) for the view. */
export function stepAnchor(view: CalendarView, anchor: DateKey, direction: 1 | -1): DateKey {
  switch (view) {
    case 'month':
      return addMonthsClamped(anchor, direction);
    case 'week':
      return addDaysToKey(anchor, 7 * direction);
    case 'agenda':
      return addDaysToKey(anchor, AGENDA_DAYS * direction);
    default:
      return addDaysToKey(anchor, direction);
  }
}

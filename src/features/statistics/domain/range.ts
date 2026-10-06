import {
  addDaysToKey,
  addMonthsToKey,
  dateKeyToNoon,
  daysBetweenKeys,
  firstDayOfMonthKey,
  lastDayOfMonthKey,
  startOfDay,
  startOfWeekKey,
  type DateKey,
} from '@/core';

export type StatsPeriod = 'day' | 'week' | 'month' | 'year';

export const STATS_PERIODS: readonly StatsPeriod[] = ['day', 'week', 'month', 'year'];

/** A stretch of whole days, `to` included. */
export interface DayRange {
  from: DateKey;
  to: DateKey;
}

/** The same stretch as instants: `from` inclusive, `to` exclusive. */
export interface TimeSpan {
  from: number;
  to: number;
}

export function dayStart(key: DateKey): number {
  return startOfDay(dateKeyToNoon(key));
}

/** From the first instant of `range.from` up to the first instant after `range.to`. */
export function toSpan(range: DayRange): TimeSpan {
  return { from: dayStart(range.from), to: dayStart(addDaysToKey(range.to, 1)) };
}

function firstDayOfYear(key: DateKey): DateKey {
  return `${key.slice(0, 4)}-01-01`;
}

/** The day, week (Monday to Sunday), month or year that contains `anchor`. */
export function periodRange(period: StatsPeriod, anchor: DateKey): DayRange {
  switch (period) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const from = startOfWeekKey(anchor);
      return { from, to: addDaysToKey(from, 6) };
    }
    case 'month':
      return { from: firstDayOfMonthKey(anchor), to: lastDayOfMonthKey(anchor) };
    default:
      return { from: firstDayOfYear(anchor), to: `${anchor.slice(0, 4)}-12-31` };
  }
}

/** Moves the anchor one period back (negative) or forward. */
export function shiftAnchor(period: StatsPeriod, anchor: DateKey, steps: number): DateKey {
  switch (period) {
    case 'day':
      return addDaysToKey(anchor, steps);
    case 'week':
      return addDaysToKey(anchor, 7 * steps);
    case 'month':
      return addMonthsToKey(firstDayOfMonthKey(anchor), steps);
    default:
      return addMonthsToKey(firstDayOfMonthKey(anchor), 12 * steps);
  }
}

export function dayCount(range: DayRange): number {
  return daysBetweenKeys(range.from, range.to) + 1;
}

export interface Bucket {
  /** Short axis label such as "Mon", "14" or "Oct". */
  key: string;
  span: TimeSpan;
  days: DayRange;
}

/** The slices a period's charts are cut into: hours, days or months. */
export function bucketsFor(period: StatsPeriod, anchor: DateKey): Bucket[] {
  const range = periodRange(period, anchor);
  if (period === 'day') {
    const [year, month, day] = range.from.split('-').map(Number) as [number, number, number];
    return Array.from({ length: 24 }, (_, hour) => ({
      key: String(hour),
      span: {
        from: new Date(year, month - 1, day, hour).getTime(),
        to: new Date(year, month - 1, day, hour + 1).getTime(),
      },
      days: range,
    }));
  }
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const from = addMonthsToKey(range.from, index);
      const days = { from, to: lastDayOfMonthKey(from) };
      return { key: from.slice(0, 7), span: toSpan(days), days };
    });
  }
  return Array.from({ length: dayCount(range) }, (_, index) => {
    const day = addDaysToKey(range.from, index);
    return { key: day, span: toSpan({ from: day, to: day }), days: { from: day, to: day } };
  });
}

/** The period right before the one containing `anchor`. */
export function previousRange(period: StatsPeriod, anchor: DateKey): DayRange {
  return periodRange(period, shiftAnchor(period, anchor, -1));
}

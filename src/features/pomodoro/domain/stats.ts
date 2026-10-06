import {
  addDaysToKey,
  addMonthsToKey,
  firstDayOfMonthKey,
  lastDayOfMonthKey,
  startOfWeekKey,
  toDateKey,
  type DateKey,
} from '@/core';

import type { FocusRow } from './entities';

export type StatsPeriod = 'day' | 'week' | 'month';

export interface Bucket {
  from: DateKey;
  /** Last day, inclusive. */
  to: DateKey;
}

/** The `count` most recent days, weeks (Monday to Sunday) or months, oldest first. */
export function buckets(period: StatsPeriod, today: DateKey, count: number): Bucket[] {
  return Array.from({ length: count }, (_, index) => {
    const back = count - 1 - index;
    switch (period) {
      case 'day': {
        const day = addDaysToKey(today, -back);
        return { from: day, to: day };
      }
      case 'week': {
        const from = addDaysToKey(startOfWeekKey(today), -7 * back);
        return { from, to: addDaysToKey(from, 6) };
      }
      default: {
        const from = addMonthsToKey(firstDayOfMonthKey(today), -back);
        return { from, to: lastDayOfMonthKey(from) };
      }
    }
  });
}

export interface Totals {
  /** Time actually focused, including sessions that were stopped early. */
  focusSeconds: number;
  /** Focus sessions that ran to the end. */
  completed: number;
  /** Average deep focus score weighted by session length; null when nothing was scored. */
  deepFocus: number | null;
}

interface DayTotals extends Totals {
  scoreWeighted: number;
  scoreSeconds: number;
}

const EMPTY: DayTotals = {
  focusSeconds: 0,
  completed: 0,
  deepFocus: null,
  scoreWeighted: 0,
  scoreSeconds: 0,
};

/** Focus rows summed per local day. */
export function totalsByDay(rows: readonly FocusRow[]): Map<DateKey, DayTotals> {
  const days = new Map<DateKey, DayTotals>();
  for (const row of rows) {
    const key = toDateKey(row.startedAt);
    const day = days.get(key) ?? { ...EMPTY };
    day.focusSeconds += row.durationSeconds;
    day.completed += row.outcome === 'completed' ? 1 : 0;
    if (row.deepFocus !== null) {
      day.scoreWeighted += row.deepFocus * row.durationSeconds;
      day.scoreSeconds += row.durationSeconds;
    }
    days.set(key, day);
  }
  return days;
}

/** Totals for the days `from` to `to` (inclusive), from rows already grouped by day. */
export function sumDays(days: ReadonlyMap<DateKey, DayTotals>, from: DateKey, to: DateKey): Totals {
  let focusSeconds = 0;
  let completed = 0;
  let scoreWeighted = 0;
  let scoreSeconds = 0;
  for (let day = from; day <= to; day = addDaysToKey(day, 1)) {
    const totals = days.get(day);
    if (totals !== undefined) {
      focusSeconds += totals.focusSeconds;
      completed += totals.completed;
      scoreWeighted += totals.scoreWeighted;
      scoreSeconds += totals.scoreSeconds;
    }
  }
  return {
    focusSeconds,
    completed,
    deepFocus: scoreSeconds === 0 ? null : Math.round(scoreWeighted / scoreSeconds),
  };
}

/** How much of a goal is met (1 = done, may exceed 1); null when the goal is off. */
export function goalFraction(focusSeconds: number, goalMinutes: number): number | null {
  return goalMinutes <= 0 ? null : focusSeconds / 60 / goalMinutes;
}

export interface Streaks {
  current: number;
  longest: number;
}

/**
 * Runs of consecutive days with a completed focus session. The current run stays alive through
 * today even if today has nothing yet, so it only breaks once a whole day has been missed.
 */
export function streaks(daysWithSession: ReadonlySet<DateKey>, today: DateKey): Streaks {
  const sorted = [...daysWithSession].sort();
  let longest = 0;
  let run = 0;
  let previous: DateKey | null = null;
  for (const day of sorted) {
    run = previous !== null && addDaysToKey(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  let current = 0;
  let day = daysWithSession.has(today) ? today : addDaysToKey(today, -1);
  while (daysWithSession.has(day)) {
    current += 1;
    day = addDaysToKey(day, -1);
  }
  return { current, longest };
}

/** Heatmap intensity (0 to 4) of a day relative to the daily goal (100 minutes when there is none). */
export function heatLevel(focusSeconds: number, dailyGoalMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (focusSeconds <= 0) {
    return 0;
  }
  const ratio = focusSeconds / 60 / (dailyGoalMinutes > 0 ? dailyGoalMinutes : 100);
  return ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 1 ? 3 : 4;
}

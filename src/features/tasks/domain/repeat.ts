import {
  combineDayAndTime,
  dateKeyToNoon,
  nextOccurrenceKey,
  startOfDay,
  toDateKey,
  type RecurrencePreset,
  type RecurrenceUnit,
} from '@/core';

import type { DueDate, RepeatRule } from './entities';

/** Repeat choices offered for tasks (yearly is calendar-only). */
export const TASK_REPEAT_PRESETS: readonly RecurrencePreset[] = [
  'none',
  'daily',
  'weekly',
  'monthly',
  'custom',
];

/** Units a custom task repeat may use. */
export const TASK_REPEAT_UNITS: readonly RecurrenceUnit[] = ['day', 'week', 'month'];

const SAFETY_LIMIT = 2_000;

/** The occurrence immediately following `at`, keeping the time of day. */
function nextOccurrenceAt(rule: RepeatRule, at: number): number {
  return combineDayAndTime(dateKeyToNoon(nextOccurrenceKey(rule, toDateKey(at))), at);
}

/**
 * Next due date after completing a recurring task. It skips occurrences that are already in the
 * past so completing a task late never produces an immediately overdue copy.
 */
export function nextDueAfter(rule: RepeatRule, due: DueDate, now: number): DueDate {
  const earliest = due.hasTime ? now : startOfDay(now);
  let at = nextOccurrenceAt(rule, due.at);

  for (let guard = 0; guard < SAFETY_LIMIT && at < earliest; guard += 1) {
    at = nextOccurrenceAt(rule, at);
  }
  return { at, hasTime: due.hasTime };
}

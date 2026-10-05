import { atHour, DAY_MINUTES, MINUTE_MS } from '@/core';
import type { DueDate } from './entities';

/** All-day tasks notify at this local hour on the due day. */
const ALL_DAY_REMINDER_HOUR = 9;

const TIMED_OFFSETS: readonly number[] = [0, 5, 15, 30, 60, DAY_MINUTES];
const ALL_DAY_OFFSETS: readonly number[] = [0, DAY_MINUTES, 2 * DAY_MINUTES];

/** Reminder offsets (minutes before due) that make sense for the due-date kind. */
export function reminderOffsetsFor(hasTime: boolean): readonly number[] {
  return hasTime ? TIMED_OFFSETS : ALL_DAY_OFFSETS;
}

export function isValidReminderOffset(offset: number, hasTime: boolean): boolean {
  return reminderOffsetsFor(hasTime).includes(offset);
}

export function computeReminderAt(due: DueDate, offsetMinutes: number): number {
  const base = due.hasTime ? due.at : atHour(due.at, ALL_DAY_REMINDER_HOUR);
  return base - offsetMinutes * MINUTE_MS;
}

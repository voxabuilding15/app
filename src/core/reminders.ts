import { MINUTE_MS, atHour } from './dates';

/** All-day items notify at this local hour on their day. */
const ALL_DAY_REMINDER_HOUR = 9;

/**
 * The instant a reminder should fire, `offsetMinutes` before an item that starts at `at`. Items
 * without a time of day (`timed` false) are treated as starting at 9:00 on their day.
 */
export function reminderInstant(at: number, timed: boolean, offsetMinutes: number): number {
  const base = timed ? at : atHour(at, ALL_DAY_REMINDER_HOUR);
  return base - offsetMinutes * MINUTE_MS;
}

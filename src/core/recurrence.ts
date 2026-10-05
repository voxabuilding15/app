import {
  addDaysToKey,
  dateKeyToNoon,
  daysBetweenKeys,
  hasWeekday,
  toDateKey,
  weekdayOfKey,
  type DateKey,
} from './dates';

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

/**
 * How often something repeats. `weekdays` is a bitmask (Sunday = bit 0) that only applies to the
 * `week` unit; 0 means "the same weekday as the start".
 */
export interface RecurrenceRule {
  unit: RecurrenceUnit;
  interval: number;
  weekdays: number;
}

export type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export const MAX_RECURRENCE_INTERVAL = 365;

export function recurrencePresetOf(rule: RecurrenceRule | null): RecurrencePreset {
  if (rule === null) {
    return 'none';
  }
  if (rule.interval === 1 && rule.weekdays === 0) {
    switch (rule.unit) {
      case 'day':
        return 'daily';
      case 'week':
        return 'weekly';
      case 'month':
        return 'monthly';
      default:
        return 'yearly';
    }
  }
  return 'custom';
}

export function ruleForRecurrencePreset(
  preset: RecurrencePreset,
  current: RecurrenceRule | null,
): RecurrenceRule | null {
  switch (preset) {
    case 'none':
      return null;
    case 'daily':
      return { unit: 'day', interval: 1, weekdays: 0 };
    case 'weekly':
      return { unit: 'week', interval: 1, weekdays: 0 };
    case 'monthly':
      return { unit: 'month', interval: 1, weekdays: 0 };
    case 'yearly':
      return { unit: 'year', interval: 1, weekdays: 0 };
    default:
      return current !== null && recurrencePresetOf(current) === 'custom'
        ? current
        : { unit: 'day', interval: 2, weekdays: 0 };
  }
}

/** Adds whole months, clamping to the end of shorter months (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsClamped(key: DateKey, months: number): DateKey {
  const noon = new Date(dateKeyToNoon(key));
  const day = noon.getDate();
  const target = new Date(noon.getFullYear(), noon.getMonth() + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateKey(target.getTime());
}

const EPOCH: DateKey = '1970-01-01';

function nextSelectedWeekday(rule: RecurrenceRule, key: DateKey): DateKey {
  const originIndex = daysBetweenKeys(EPOCH, key);
  const weekStart = originIndex - weekdayOfKey(key);

  for (let step = 1; step <= 7 * rule.interval + 7; step += 1) {
    const candidate = addDaysToKey(key, step);
    const weeksElapsed = Math.floor((originIndex + step - weekStart) / 7);
    if (hasWeekday(rule.weekdays, weekdayOfKey(candidate)) && weeksElapsed % rule.interval === 0) {
      return candidate;
    }
  }
  return addDaysToKey(key, 7 * rule.interval);
}

/** The day of the occurrence immediately following the one on `key`. */
export function nextOccurrenceKey(rule: RecurrenceRule, key: DateKey): DateKey {
  switch (rule.unit) {
    case 'day':
      return addDaysToKey(key, rule.interval);
    case 'month':
      return addMonthsClamped(key, rule.interval);
    case 'year':
      return addMonthsClamped(key, 12 * rule.interval);
    default:
      return rule.weekdays === 0
        ? addDaysToKey(key, 7 * rule.interval)
        : nextSelectedWeekday(rule, key);
  }
}

/**
 * The days a repeating item falls on, in order, starting with `startKey` itself. Months and years
 * are counted from the start day so a 31st never drifts to the 28th. The sequence is endless;
 * callers stop reading when they pass the range or limit they care about.
 */
export function* occurrenceKeys(rule: RecurrenceRule, startKey: DateKey): Generator<DateKey> {
  if (rule.unit === 'week' && rule.weekdays !== 0) {
    let day = startKey;
    for (;;) {
      yield day;
      day = nextOccurrenceKey(rule, day);
    }
  }
  for (let index = 0; ; index += 1) {
    switch (rule.unit) {
      case 'day':
        yield addDaysToKey(startKey, index * rule.interval);
        break;
      case 'week':
        yield addDaysToKey(startKey, index * 7 * rule.interval);
        break;
      case 'month':
        yield addMonthsClamped(startKey, index * rule.interval);
        break;
      default:
        yield addMonthsClamped(startKey, index * 12 * rule.interval);
    }
  }
}

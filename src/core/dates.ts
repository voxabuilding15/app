export const MINUTE_MS = 60_000;
export const DAY_MINUTES = 24 * 60;

export function startOfDay(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function addDays(at: number, days: number): number {
  const date = new Date(at);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function atHour(at: number, hour: number): number {
  const date = new Date(at);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

/** Combines the calendar day of `day` with the clock time of `time`. */
export function combineDayAndTime(day: number, time: number): number {
  const result = new Date(day);
  const clock = new Date(time);
  result.setHours(clock.getHours(), clock.getMinutes(), 0, 0);
  return result.getTime();
}

/** A local calendar day as `YYYY-MM-DD`. Day keys avoid time-zone and DST drift in stored history. */
export type DateKey = string;

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateKey(at: number): DateKey {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Noon of the key's local day, which exists in every time zone even on DST-change days. */
export function dateKeyToNoon(key: DateKey): number {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12).getTime();
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(dateKeyToNoon(key), days));
}

/** Weekday of a key, Sunday = 0 ... Saturday = 6. */
export function weekdayOfKey(key: DateKey): number {
  return new Date(dateKeyToNoon(key)).getDay();
}

/** First day of the week containing `key` (Monday by default). */
export function startOfWeekKey(key: DateKey, weekStartsOn = 1): DateKey {
  const offset = (weekdayOfKey(key) - weekStartsOn + 7) % 7;
  return addDaysToKey(key, -offset);
}

/** `YYYY-MM` of the key's month. */
export function monthOfKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function daysBetweenKeys(from: DateKey, to: DateKey): number {
  return Math.round((dateKeyToNoon(to) - dateKeyToNoon(from)) / 86_400_000);
}

export function lastDayOfMonthKey(key: DateKey): DateKey {
  const noon = new Date(dateKeyToNoon(key));
  return toDateKey(new Date(noon.getFullYear(), noon.getMonth() + 1, 0, 12).getTime());
}

export function firstDayOfMonthKey(key: DateKey): DateKey {
  return `${monthOfKey(key)}-01`;
}

export function addMonthsToKey(key: DateKey, months: number): DateKey {
  const noon = new Date(dateKeyToNoon(key));
  return toDateKey(new Date(noon.getFullYear(), noon.getMonth() + months, 1, 12).getTime());
}

/** Bitmask for a weekday where Sunday = 0 ... Saturday = 6, used to store sets of weekdays. */
export function weekdayBit(day: number): number {
  return 1 << day;
}

export function hasWeekday(mask: number, day: number): boolean {
  return (mask & weekdayBit(day)) !== 0;
}

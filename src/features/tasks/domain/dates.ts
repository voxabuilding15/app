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

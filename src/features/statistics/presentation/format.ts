import { dateKeyToNoon } from '@/core';

import type { DayRange, StatsPeriod } from '../domain/range';

const on = (key: string, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Date(dateKeyToNoon(key)).toLocaleDateString(locale, options);

/** "Thursday, 15 October 2026", "12 – 18 Oct 2026", "October 2026" or "2026". */
export function periodTitle(period: StatsPeriod, range: DayRange, locale: string): string {
  switch (period) {
    case 'day':
      return on(range.from, locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    case 'week': {
      const short = { day: 'numeric', month: 'short' } as const;
      return `${on(range.from, locale, short)} – ${on(range.to, locale, { ...short, year: 'numeric' })}`;
    }
    case 'month':
      return on(range.from, locale, { month: 'long', year: 'numeric' });
    default:
      return range.from.slice(0, 4);
  }
}

/** Axis label for a chart bucket: the hour, the weekday or day number, or the month letter. */
export function bucketAxisLabel(period: StatsPeriod, key: string, locale: string): string {
  switch (period) {
    case 'day':
      return Number(key) % 6 === 0 ? key : '';
    case 'week':
      return on(key, locale, { weekday: 'narrow' });
    case 'month':
      return Number(key.slice(8)) % 5 === 1 ? String(Number(key.slice(8))) : '';
    default:
      return on(`${key}-01`, locale, { month: 'narrow' });
  }
}

/** Spoken name of one bucket: "14:00", "Thu 15 Oct" or "October 2026". */
export function bucketName(period: StatsPeriod, key: string, locale: string): string {
  switch (period) {
    case 'day':
      return `${key.padStart(2, '0')}:00`;
    case 'year':
      return on(`${key}-01`, locale, { month: 'long', year: 'numeric' });
    default:
      return on(key, locale, { weekday: 'short', day: 'numeric', month: 'short' });
  }
}

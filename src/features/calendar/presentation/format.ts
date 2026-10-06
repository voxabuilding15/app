import { dateKeyToNoon, toDateKey, type DateKey } from '@/core';

import type { CalendarItem } from '../domain/items';
import { weekDays, type CalendarView } from '../domain/views';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';
import { appLocale } from '@/i18n/formatting';

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(appLocale(), { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLong(day: DateKey): string {
  return new Date(dateKeyToNoon(day)).toLocaleDateString(appLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDayShort(day: DateKey): string {
  return new Date(dateKeyToNoon(day)).toLocaleDateString(appLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function weekdayShort(day: DateKey): string {
  return new Date(dateKeyToNoon(day)).toLocaleDateString(appLocale(), { weekday: 'short' });
}

/** "9:00 AM – 10:30 AM", "All day", or a single time for a point-in-time item. */
export function formatTimeRange(item: CalendarItem): string {
  const { t } = currentTranslator();
  if (item.allDay) {
    return t('All day');
  }
  return item.end > item.start
    ? `${formatTime(item.start)} – ${formatTime(item.end)}`
    : formatTime(item.start);
}

/** "9 AM" label for an hour of the day. */
export function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(appLocale(), { hour: 'numeric' });
}

/** Heading for the period shown: "October 2026", "5 – 11 Oct 2026", "Monday 5 October". */
export function periodTitle(view: CalendarView, anchor: DateKey): string {
  const { t } = currentTranslator();
  const noon = new Date(dateKeyToNoon(anchor));
  switch (view) {
    case 'month':
      return noon.toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' });
    case 'week': {
      const days = weekDays(anchor);
      const first = new Date(dateKeyToNoon(days[0]!));
      const last = new Date(dateKeyToNoon(days[6]!));
      const sameMonth = first.getMonth() === last.getMonth();
      const start = first.toLocaleDateString(
        appLocale(),
        sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' },
      );
      const end = last.toLocaleDateString(appLocale(), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${start} – ${end}`;
    }
    case 'agenda':
      return t('From {dayShort}', { dayShort: formatDayShort(anchor) });
    default:
      return formatDayLong(anchor);
  }
}

const HABIT_STATUS_LABEL = {
  done: 'done',
  partial: msg('partly done'),
  pending: 'to do',
  missed: 'missed',
  skipped: 'skipped',
} as const;

export function describeHabitStatus(item: Extract<CalendarItem, { kind: 'habit' }>): string {
  return item.goal > 1 && item.count > 0
    ? `${item.count} of ${item.goal}, ${HABIT_STATUS_LABEL[item.status]}`
    : HABIT_STATUS_LABEL[item.status];
}

/** One-sentence description of an item for screen readers. */
export function describeItem(item: CalendarItem): string {
  const { t } = currentTranslator();
  switch (item.kind) {
    case 'event':
      return [
        t('Event: {title}', { title: item.title }),
        formatTimeRange(item),
        item.location || null,
        item.recurring ? t('repeats') : null,
      ]
        .filter(Boolean)
        .join(', ');
    case 'task': {
      const when = item.allDay ? t('all day') : formatTime(item.start);
      return item.done
        ? t('Task: {title}, due {when}, done', { title: item.title, when })
        : t('Task: {title}, due {when}', { title: item.title, when });
    }
    default:
      return t('Habit: {title}, {habitStatus}', {
        title: item.title,
        habitStatus: describeHabitStatus(item),
      });
  }
}

/** The day an item starts on, for grouping lists. */
export function itemDay(item: CalendarItem): DateKey {
  return item.kind === 'habit' ? item.date : toDateKey(item.start);
}

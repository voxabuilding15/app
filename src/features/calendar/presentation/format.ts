import { dateKeyToNoon, toDateKey, type DateKey } from '@/core';

import type { CalendarItem } from '../domain/items';
import { weekDays, type CalendarView } from '../domain/views';

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLong(day: DateKey): string {
  return new Date(dateKeyToNoon(day)).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDayShort(day: DateKey): string {
  return new Date(dateKeyToNoon(day)).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function weekdayShort(day: DateKey): string {
  return new Date(dateKeyToNoon(day)).toLocaleDateString(undefined, { weekday: 'short' });
}

/** "9:00 AM – 10:30 AM", "All day", or a single time for a point-in-time item. */
export function formatTimeRange(item: CalendarItem): string {
  if (item.allDay) {
    return 'All day';
  }
  return item.end > item.start
    ? `${formatTime(item.start)} – ${formatTime(item.end)}`
    : formatTime(item.start);
}

/** "9 AM" label for an hour of the day. */
export function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' });
}

/** Heading for the period shown: "October 2026", "5 – 11 Oct 2026", "Monday 5 October". */
export function periodTitle(view: CalendarView, anchor: DateKey): string {
  const noon = new Date(dateKeyToNoon(anchor));
  switch (view) {
    case 'month':
      return noon.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    case 'week': {
      const days = weekDays(anchor);
      const first = new Date(dateKeyToNoon(days[0]!));
      const last = new Date(dateKeyToNoon(days[6]!));
      const sameMonth = first.getMonth() === last.getMonth();
      const start = first.toLocaleDateString(
        undefined,
        sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' },
      );
      const end = last.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${start} – ${end}`;
    }
    case 'agenda':
      return `From ${formatDayShort(anchor)}`;
    default:
      return formatDayLong(anchor);
  }
}

const HABIT_STATUS_LABEL = {
  done: 'done',
  partial: 'partly done',
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
  switch (item.kind) {
    case 'event':
      return [
        `Event: ${item.title}`,
        formatTimeRange(item),
        item.location || null,
        item.recurring ? 'repeats' : null,
      ]
        .filter(Boolean)
        .join(', ');
    case 'task':
      return `Task: ${item.title}, due ${item.allDay ? 'all day' : formatTime(item.start)}${item.done ? ', done' : ''}`;
    default:
      return `Habit: ${item.title}, ${describeHabitStatus(item)}`;
  }
}

/** The day an item starts on, for grouping lists. */
export function itemDay(item: CalendarItem): DateKey {
  return item.kind === 'habit' ? item.date : toDateKey(item.start);
}

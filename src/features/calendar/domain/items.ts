import { addDaysToKey, dateKeyToNoon, startOfDay, type DateKey } from '@/core';

import type { EventOccurrence } from './entities';

export type HabitDayStatus = 'done' | 'partial' | 'pending' | 'missed' | 'skipped';

interface ItemBase {
  /** Unique across all item kinds, so lists can key on it. */
  key: string;
  title: string;
  start: number;
  end: number;
  /** All-day items sit in the strip above the timeline instead of at a time. */
  allDay: boolean;
  /** Accent color, or null to use the theme's default. */
  color: string | null;
}

export interface EventItem extends ItemBase {
  kind: 'event';
  eventId: string;
  occurrenceDate: DateKey;
  location: string;
  notes: string;
  categoryId: string | null;
  recurring: boolean;
}

export interface TaskItem extends ItemBase {
  kind: 'task';
  taskId: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface HabitItem extends ItemBase {
  kind: 'habit';
  habitId: string;
  icon: string;
  date: DateKey;
  status: HabitDayStatus;
  count: number;
  goal: number;
}

export type CalendarItem = EventItem | TaskItem | HabitItem;

export function eventItemFrom(occurrence: EventOccurrence): EventItem {
  const { event } = occurrence;
  return {
    kind: 'event',
    key: `event:${event.id}:${occurrence.occurrenceDate}`,
    eventId: event.id,
    occurrenceDate: occurrence.occurrenceDate,
    title: event.title,
    location: event.location,
    notes: event.notes,
    categoryId: event.category?.id ?? null,
    color: event.category?.color ?? null,
    start: occurrence.start,
    end: occurrence.end,
    allDay: event.allDay,
    recurring: event.recurrence !== null,
  };
}

const KIND_ORDER: Record<CalendarItem['kind'], number> = { event: 0, task: 1, habit: 2 };

/** Chronological, with all-day items first, then events before tasks before habits. */
export function sortItems(items: readonly CalendarItem[]): CalendarItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      a.start - b.start ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.title.localeCompare(b.title),
  );
}

export function dayBounds(day: DateKey): { start: number; end: number } {
  return {
    start: startOfDay(dateKeyToNoon(day)),
    end: startOfDay(dateKeyToNoon(addDaysToKey(day, 1))),
  };
}

/** Items that overlap the given day, sorted. A zero-length item counts on its own day. */
export function itemsOnDay(items: readonly CalendarItem[], day: DateKey): CalendarItem[] {
  const { start, end } = dayBounds(day);
  return sortItems(
    items.filter((item) =>
      item.start === item.end
        ? item.start >= start && item.start < end
        : item.start < end && item.end > start,
    ),
  );
}

/** Items shown in the all-day strip of a day: all-day items and habits. */
export function allDayItemsOn(items: readonly CalendarItem[], day: DateKey): CalendarItem[] {
  return itemsOnDay(items, day).filter((item) => item.allDay);
}

/** Items placed at a time on the timeline of a day. */
export function timedItemsOn(items: readonly CalendarItem[], day: DateKey): CalendarItem[] {
  return itemsOnDay(items, day).filter((item) => !item.allDay);
}

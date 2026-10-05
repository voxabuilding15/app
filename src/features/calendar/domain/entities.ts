import type { Category, DateKey, RecurrenceRule } from '@/core';

/** A repeat rule plus an optional end: an inclusive last day, or a total number of occurrences. */
export interface EventRecurrence extends RecurrenceRule {
  until: DateKey | null;
  count: number | null;
}

/**
 * Times are epoch ms and `end` is exclusive. All-day events start at local midnight of their
 * first day and end at local midnight after their last day.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  notes: string;
  location: string;
  category: Category | null;
  start: number;
  end: number;
  allDay: boolean;
  recurrence: EventRecurrence | null;
  /** Minutes before the start to notify; null means no reminder. */
  reminderOffsetMinutes: number | null;
  createdAt: number;
  updatedAt: number;
}

/** The persisted shape of an event: the category is referenced by id. */
export interface EventRecord extends Omit<CalendarEvent, 'category'> {
  categoryId: string | null;
}

export interface EventEntry {
  event: CalendarEvent;
  /** Occurrence days of a recurring event that were deleted or edited on their own. */
  exceptions: readonly DateKey[];
  notificationIds: readonly string[];
}

/** One concrete instance of an event on the calendar. */
export interface EventOccurrence {
  event: CalendarEvent;
  occurrenceDate: DateKey;
  start: number;
  end: number;
}

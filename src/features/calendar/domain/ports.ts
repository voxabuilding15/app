import type { DateKey } from '@/core';

import type { EventEntry, EventRecord } from './entities';
import type { HabitItem, TaskItem } from './items';

export interface EventRepository {
  /** Events that may have an occurrence in [from, to): single events overlapping it, and every recurring event that has started. */
  listInRange(from: number, to: number): Promise<EventEntry[]>;
  /** Events with a reminder that can still fire after `now`. */
  listWithReminders(now: number): Promise<EventEntry[]>;
  get(id: string): Promise<EventEntry | null>;
  insert(event: EventRecord): Promise<void>;
  update(event: EventRecord): Promise<void>;
  delete(id: string): Promise<void>;
  addException(id: string, occurrenceDate: DateKey): Promise<void>;
  setNotificationIds(id: string, ids: readonly string[]): Promise<void>;
}

/** Read-only view of tasks for the calendar: those due within a range. */
export interface TaskAgendaSource {
  dueBetween(from: number, to: number): Promise<TaskItem[]>;
}

/** Read-only view of habits for the calendar: what each habit looks like on each day. */
export interface HabitAgendaSource {
  between(from: DateKey, to: DateKey, today: DateKey): Promise<HabitItem[]>;
}

export interface ScheduledEventReminder {
  eventId: string;
  occurrenceDate: DateKey;
  title: string;
  body: string;
  fireAt: number;
}

export type EventScheduleOutcome =
  { status: 'scheduled'; notificationIds: string[] } | { status: 'blocked' };

export interface EventReminderScheduler {
  schedule(reminders: readonly ScheduledEventReminder[]): Promise<EventScheduleOutcome>;
  cancel(notificationIds: readonly string[]): Promise<void>;
}

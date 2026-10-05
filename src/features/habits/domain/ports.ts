import type { DateKey } from '@/core';

import type { HabitEntry, HabitRecord } from './entities';
import type { HabitScope } from './filters';

export interface HabitRepository {
  /** Habits in the scope with their complete history. */
  list(scope: HabitScope): Promise<HabitEntry[]>;
  get(id: string): Promise<HabitEntry | null>;
  insert(habit: HabitRecord): Promise<void>;
  update(habit: HabitRecord): Promise<void>;
  setArchivedAt(id: string, archivedAt: number | null): Promise<void>;
  /** Permanently removes the habit and, by cascade, its logs and pauses. */
  delete(id: string): Promise<void>;
  /** Sets how many times the habit was done on a day; 0 clears it. Replaces a skip. */
  setCount(id: string, date: DateKey, count: number): Promise<void>;
  /** Adds `delta` (clamped at 0 and `max`) to a day's count and returns the new count. */
  adjustCount(id: string, date: DateKey, delta: number, max: number): Promise<number>;
  setSkipped(id: string, date: DateKey, skipped: boolean): Promise<void>;
  /** Starts a pause; no-op if one is already open. */
  startPause(id: string, pauseId: string, start: DateKey): Promise<void>;
  /** Ends the open pause on `end` (exclusive); a pause that would be empty is removed. */
  endPause(id: string, end: DateKey): Promise<void>;
  setNotificationIds(id: string, ids: readonly string[]): Promise<void>;
}

export interface HabitReminder {
  habitId: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  /** JS weekdays (Sunday = 0) on which to remind. */
  weekdays: readonly number[];
}

export type HabitScheduleOutcome =
  { status: 'scheduled'; notificationIds: string[] } | { status: 'blocked' };

export interface HabitReminderScheduler {
  schedule(reminder: HabitReminder): Promise<HabitScheduleOutcome>;
  cancel(notificationIds: readonly string[]): Promise<void>;
}

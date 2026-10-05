import type { Category, DateKey } from '@/core';

export type HabitPeriod = 'daily' | 'weekly' | 'monthly';

export type LogStatus = 'done' | 'skipped';

/** One day of history. `count` is completions that day; skipped days are excused. */
export interface HabitLog {
  date: DateKey;
  count: number;
  status: LogStatus;
}

/** Days from `start` up to, but not including, `end` are paused. A null `end` means still paused. */
export interface HabitPause {
  id: string;
  start: DateKey;
  end: DateKey | null;
}

export interface Habit {
  id: string;
  name: string;
  notes: string;
  /** Material icon name. */
  icon: string;
  color: string;
  /** The goal is `goalCount` completions per `period` (day, week or month). */
  period: HabitPeriod;
  goalCount: number;
  /** Scheduled weekdays as a bitmask (Sunday = bit 0). Only meaningful for the daily period. */
  weekdays: number;
  /** Local time of day as HH:MM, or null when there is no reminder. */
  reminderTime: string | null;
  category: Category | null;
  startDate: DateKey;
  archivedAt: number | null;
  createdAt: number;
  paused: boolean;
}

/** The persisted shape of a habit: relations are referenced by id. */
export interface HabitRecord {
  id: string;
  name: string;
  notes: string;
  icon: string;
  color: string;
  period: HabitPeriod;
  goalCount: number;
  weekdays: number;
  reminderTime: string | null;
  categoryId: string | null;
  startDate: DateKey;
  archivedAt: number | null;
  createdAt: number;
}

export interface HabitHistory {
  logs: readonly HabitLog[];
  pauses: readonly HabitPause[];
}

/** A habit with everything needed to compute its progress. */
export interface HabitEntry extends HabitHistory {
  habit: Habit;
  /** Ids of the scheduled reminder notifications, so they can be cancelled. */
  notificationIds: readonly string[];
}

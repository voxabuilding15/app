import { toDateKey } from '@/core';

import type {
  Habit,
  HabitEntry,
  HabitLog,
  HabitPause,
  HabitPeriod,
  LogStatus,
} from '../domain/entities';

export interface HabitRow {
  id: string;
  name: string;
  notes: string;
  icon: string;
  color: string;
  goal_period: HabitPeriod;
  goal_count: number;
  weekdays: number;
  reminder_time: string | null;
  start_date: string | null;
  archived_at: number | null;
  created_at: number;
  notification_ids: string;
  paused: number;
  cat_id: string | null;
  cat_name: string | null;
  cat_color: string | null;
}

export interface LogRow {
  habit_id: string;
  date: string;
  count: number;
  status: LogStatus;
}

export interface PauseRow {
  id: string;
  habit_id: string;
  start_date: string;
  end_date: string | null;
}

function parseIds(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    icon: row.icon,
    color: row.color,
    period: row.goal_period,
    goalCount: row.goal_count,
    weekdays: row.weekdays,
    reminderTime: row.reminder_time,
    category:
      row.cat_id === null || row.cat_name === null || row.cat_color === null
        ? null
        : { id: row.cat_id, name: row.cat_name, color: row.cat_color },
    startDate: row.start_date ?? toDateKey(row.created_at),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    paused: row.paused === 1,
  };
}

function groupBy<T extends { habit_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.habit_id) ?? [];
    list.push(row);
    grouped.set(row.habit_id, list);
  }
  return grouped;
}

export function toEntries(
  habits: readonly HabitRow[],
  logs: readonly LogRow[],
  pauses: readonly PauseRow[],
): HabitEntry[] {
  const logsByHabit = groupBy(logs);
  const pausesByHabit = groupBy(pauses);

  return habits.map((row) => ({
    habit: toHabit(row),
    notificationIds: parseIds(row.notification_ids),
    logs: (logsByHabit.get(row.id) ?? []).map((log): HabitLog => ({
      date: log.date,
      count: log.count,
      status: log.status,
    })),
    pauses: (pausesByHabit.get(row.id) ?? []).map((pause): HabitPause => ({
      id: pause.id,
      start: pause.start_date,
      end: pause.end_date,
    })),
  }));
}

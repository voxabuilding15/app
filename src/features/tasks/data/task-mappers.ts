import type { Label, RepeatRule, RepeatUnit, Task, TaskDetail } from '../domain/entities';

import { INT_TO_PRIORITY } from './task-queries';

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  priority: number;
  due_at: number | null;
  due_has_time: number;
  reminder_offset_minutes: number | null;
  reminder_at: number | null;
  is_alarm: number;
  notification_id: string | null;
  repeat_unit: RepeatUnit | null;
  repeat_interval: number;
  repeat_weekdays: number;
  completed_at: number | null;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
  cat_id: string | null;
  cat_name: string | null;
  cat_color: string | null;
  subtask_total: number;
  subtask_done: number;
}

export interface LabelRow {
  task_id: string;
  id: string;
  name: string;
  color: string;
}

export interface SubtaskRow {
  id: string;
  title: string;
  completed: number;
}

function toRepeat(row: TaskRow): RepeatRule | null {
  return row.repeat_unit === null
    ? null
    : { unit: row.repeat_unit, interval: row.repeat_interval, weekdays: row.repeat_weekdays };
}

export function toTask(row: TaskRow, labels: Label[]): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.description,
    priority: INT_TO_PRIORITY[row.priority] ?? 'medium',
    due: row.due_at === null ? null : { at: row.due_at, hasTime: row.due_has_time === 1 },
    reminderOffsetMinutes: row.reminder_offset_minutes,
    reminderAt: row.reminder_at,
    isAlarm: row.is_alarm === 1,
    repeat: toRepeat(row),
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category:
      row.cat_id === null || row.cat_name === null || row.cat_color === null
        ? null
        : { id: row.cat_id, name: row.cat_name, color: row.cat_color },
    labels,
    subtaskTotal: row.subtask_total,
    subtaskDone: row.subtask_done,
  };
}

export function toTaskDetail(row: TaskRow, labels: Label[], subtasks: SubtaskRow[]): TaskDetail {
  return {
    ...toTask(row, labels),
    notificationId: row.notification_id,
    subtasks: subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      completed: subtask.completed === 1,
    })),
  };
}

export function groupLabels(rows: readonly LabelRow[]): Map<string, Label[]> {
  const byTask = new Map<string, Label[]>();
  for (const row of rows) {
    const list = byTask.get(row.task_id) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    byTask.set(row.task_id, list);
  }
  return byTask;
}

import type { Database } from '@/core';

import { addDays, startOfDay } from '../domain/dates';
import type { Label, TaskDetail, TaskRecord, TaskStats } from '../domain/entities';
import type { TaskFilter, TaskSort } from '../domain/filters';
import type { ListContext, TaskRepository } from '../domain/ports';

import {
  groupLabels,
  toTask,
  toTaskDetail,
  type LabelRow,
  type SubtaskRow,
  type TaskRow,
} from './task-mappers';
import {
  PRIORITY_TO_INT,
  SELECT_TASK,
  buildOrderBy,
  buildWhere,
  placeholders,
} from './task-queries';

const LABELS_FOR_TASKS = (count: number) => `
  SELECT tl.task_id, l.id, l.name, l.color
  FROM task_labels tl JOIN labels l ON l.id = tl.label_id
  WHERE tl.task_id IN (${placeholders(count)})
  ORDER BY l.name COLLATE NOCASE`;

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: Database) {}

  async list(filter: TaskFilter, sort: TaskSort, context: ListContext) {
    const where = buildWhere(filter, context.now);
    const rows = this.db.getAllSync<TaskRow>(
      `${SELECT_TASK} WHERE ${where.sql} ORDER BY ${buildOrderBy(sort)} LIMIT ?`,
      [...where.params, context.limit],
    );
    const labels = this.labelsFor(rows.map((row) => row.id));
    return rows.map((row) => toTask(row, labels.get(row.id) ?? []));
  }

  async stats(now: number): Promise<TaskStats> {
    const todayStart = startOfDay(now);
    const today = this.db.getFirstSync<{ total: number; done: number | null }>(
      `SELECT COUNT(*) AS total, SUM(completed_at IS NOT NULL) AS done
       FROM tasks
       WHERE deleted_at IS NULL AND archived_at IS NULL AND due_at >= ? AND due_at < ?`,
      [todayStart, addDays(todayStart, 1)],
    );
    const overdue = this.db.getFirstSync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM tasks
       WHERE deleted_at IS NULL AND archived_at IS NULL AND completed_at IS NULL
         AND due_at IS NOT NULL
         AND ((due_has_time = 1 AND due_at < ?) OR (due_has_time = 0 AND due_at < ?))`,
      [now, todayStart],
    );
    return {
      dueToday: today?.total ?? 0,
      doneToday: today?.done ?? 0,
      overdue: overdue?.total ?? 0,
    };
  }

  async get(id: string) {
    const [task] = await this.getMany([id]);
    return task ?? null;
  }

  async getMany(ids: readonly string[]): Promise<TaskDetail[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = this.db.getAllSync<TaskRow>(
      `${SELECT_TASK} WHERE t.deleted_at IS NULL AND t.id IN (${placeholders(ids.length)})`,
      [...ids],
    );
    return this.hydrate(rows);
  }

  async insert(task: TaskRecord) {
    this.db.withTransactionSync(() => this.insertRow(task));
  }

  private insertRow(task: TaskRecord): void {
    this.db.runSync(
      `INSERT INTO tasks (id, title, description, priority, category_id, due_at, due_has_time,
           reminder_offset_minutes, reminder_at, is_alarm, repeat_unit, repeat_interval,
           repeat_weekdays, completed_at, archived_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        task.id,
        task.title,
        task.notes,
        PRIORITY_TO_INT[task.priority],
        task.categoryId,
        task.due?.at ?? null,
        task.due?.hasTime ? 1 : 0,
        task.reminderOffsetMinutes,
        task.reminderAt,
        task.isAlarm ? 1 : 0,
        task.repeat?.unit ?? null,
        task.repeat?.interval ?? 1,
        task.repeat?.weekdays ?? 0,
        task.completedAt,
        task.archivedAt,
        task.createdAt,
        task.updatedAt,
      ],
    );
    this.writeRelations(task);
  }

  async update(task: TaskRecord) {
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `UPDATE tasks SET title = ?, description = ?, priority = ?, category_id = ?, due_at = ?,
           due_has_time = ?, reminder_offset_minutes = ?, reminder_at = ?, is_alarm = ?,
           repeat_unit = ?, repeat_interval = ?, repeat_weekdays = ?, updated_at = ?
         WHERE id = ?`,
        [
          task.title,
          task.notes,
          PRIORITY_TO_INT[task.priority],
          task.categoryId,
          task.due?.at ?? null,
          task.due?.hasTime ? 1 : 0,
          task.reminderOffsetMinutes,
          task.reminderAt,
          task.isAlarm ? 1 : 0,
          task.repeat?.unit ?? null,
          task.repeat?.interval ?? 1,
          task.repeat?.weekdays ?? 0,
          task.updatedAt,
          task.id,
        ],
      );
      this.writeRelations(task);
    });
  }

  async complete(id: string, completedAt: number, next: TaskRecord | null) {
    this.db.withTransactionSync(() => {
      this.db.runSync('UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?', [
        completedAt,
        completedAt,
        id,
      ]);
      if (next !== null) {
        this.insertRow(next);
      }
    });
  }

  async reopen(id: string, updatedAt: number) {
    this.db.runSync('UPDATE tasks SET completed_at = NULL, updated_at = ? WHERE id = ?', [
      updatedAt,
      id,
    ]);
  }

  async setArchivedAt(ids: readonly string[], archivedAt: number | null, updatedAt: number) {
    if (ids.length === 0) {
      return;
    }
    this.db.runSync(
      `UPDATE tasks SET archived_at = ?, updated_at = ? WHERE id IN (${placeholders(ids.length)})`,
      [archivedAt, updatedAt, ...ids],
    );
  }

  async setSubtaskCompleted(taskId: string, subtaskId: string, completed: boolean) {
    this.db.runSync('UPDATE subtasks SET completed = ? WHERE id = ? AND task_id = ?', [
      completed ? 1 : 0,
      subtaskId,
      taskId,
    ]);
  }

  async setReminder(id: string, reminderAt: number | null, notificationId: string | null) {
    this.db.runSync('UPDATE tasks SET reminder_at = ?, notification_id = ? WHERE id = ?', [
      reminderAt,
      notificationId,
      id,
    ]);
  }

  async softDelete(ids: readonly string[], deletedAt: number) {
    if (ids.length === 0) {
      return;
    }
    this.db.runSync(`UPDATE tasks SET deleted_at = ? WHERE id IN (${placeholders(ids.length)})`, [
      deletedAt,
      ...ids,
    ]);
  }

  async undoDelete(ids: readonly string[]) {
    if (ids.length === 0) {
      return;
    }
    this.db.runSync(
      `UPDATE tasks SET deleted_at = NULL WHERE id IN (${placeholders(ids.length)})`,
      [...ids],
    );
  }

  async purge(ids: readonly string[]) {
    if (ids.length === 0) {
      return;
    }
    this.db.runSync(
      `DELETE FROM tasks WHERE deleted_at IS NOT NULL AND id IN (${placeholders(ids.length)})`,
      [...ids],
    );
  }

  async purgeAllDeleted() {
    this.db.runSync('DELETE FROM tasks WHERE deleted_at IS NOT NULL');
  }

  private labelsFor(ids: readonly string[]) {
    if (ids.length === 0) {
      return new Map<string, Label[]>();
    }
    return groupLabels(this.db.getAllSync<LabelRow>(LABELS_FOR_TASKS(ids.length), [...ids]));
  }

  private hydrate(rows: TaskRow[]): TaskDetail[] {
    const ids = rows.map((row) => row.id);
    const labels = this.labelsFor(ids);
    return rows.map((row) => {
      const subtasks = this.db.getAllSync<SubtaskRow>(
        'SELECT id, title, completed FROM subtasks WHERE task_id = ? ORDER BY position',
        [row.id],
      );
      return toTaskDetail(row, labels.get(row.id) ?? [], subtasks);
    });
  }

  /** Replaces labels and upserts subtasks for a task. Must run inside a transaction. */
  private writeRelations(task: TaskRecord): void {
    this.db.runSync('DELETE FROM task_labels WHERE task_id = ?', [task.id]);
    for (const labelId of task.labelIds) {
      this.db.runSync('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)', [
        task.id,
        labelId,
      ]);
    }

    const keep = task.subtasks.map((subtask) => subtask.id);
    this.db.runSync(
      keep.length === 0
        ? 'DELETE FROM subtasks WHERE task_id = ?'
        : `DELETE FROM subtasks WHERE task_id = ? AND id NOT IN (${placeholders(keep.length)})`,
      [task.id, ...keep],
    );
    task.subtasks.forEach((subtask, position) => {
      this.db.runSync(
        `INSERT INTO subtasks (id, task_id, title, completed, position) VALUES (?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title,
           completed = excluded.completed, position = excluded.position`,
        [subtask.id, task.id, subtask.title, subtask.completed ? 1 : 0, position],
      );
    });
  }
}

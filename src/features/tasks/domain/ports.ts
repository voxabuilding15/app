import type { Category, Label, Task, TaskDetail, TaskRecord, TaskStats } from './entities';
import type { TaskFilter, TaskSort } from './filters';

export interface ListContext {
  now: number;
  limit: number;
}

export interface TaskRepository {
  list(filter: TaskFilter, sort: TaskSort, context: ListContext): Promise<Task[]>;
  stats(now: number): Promise<TaskStats>;
  get(id: string): Promise<TaskDetail | null>;
  getMany(ids: readonly string[]): Promise<TaskDetail[]>;
  insert(task: TaskRecord): Promise<void>;
  update(task: TaskRecord): Promise<void>;
  /** Completes a task and, atomically, inserts the next occurrence of a repeating task. */
  complete(id: string, completedAt: number, next: TaskRecord | null): Promise<void>;
  reopen(id: string, updatedAt: number): Promise<void>;
  setArchivedAt(
    ids: readonly string[],
    archivedAt: number | null,
    updatedAt: number,
  ): Promise<void>;
  setSubtaskCompleted(taskId: string, subtaskId: string, completed: boolean): Promise<void>;
  setReminder(id: string, reminderAt: number | null, notificationId: string | null): Promise<void>;
  /** Marks tasks as deleted without removing them so the deletion can be undone. */
  softDelete(ids: readonly string[], deletedAt: number): Promise<void>;
  undoDelete(ids: readonly string[]): Promise<void>;
  /** Permanently removes the given soft-deleted tasks. */
  purge(ids: readonly string[]): Promise<void>;
  /** Permanently removes every soft-deleted task, e.g. leftovers from a previous session. */
  purgeAllDeleted(): Promise<void>;
}

export interface TaxonomyRepository {
  listCategories(): Promise<Category[]>;
  listLabels(): Promise<Label[]>;
  saveCategory(category: Category): Promise<void>;
  saveLabel(label: Label): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  deleteLabel(id: string): Promise<void>;
}

export interface ScheduledReminder {
  taskId: string;
  title: string;
  body: string;
  fireAt: number;
  isAlarm: boolean;
}

export type ScheduleOutcome =
  { status: 'scheduled'; notificationId: string } | { status: 'blocked' };

export interface ReminderScheduler {
  schedule(reminder: ScheduledReminder): Promise<ScheduleOutcome>;
  cancel(notificationId: string): Promise<void>;
}

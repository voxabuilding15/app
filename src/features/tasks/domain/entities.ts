export type Priority = 'low' | 'medium' | 'high';

export type RepeatUnit = 'day' | 'week' | 'month';

/**
 * Recurrence rule. `weekdays` is a bitmask (Sunday = bit 0 ... Saturday = bit 6) that only applies
 * to the `week` unit; 0 means "same weekday as the due date".
 */
export interface RepeatRule {
  unit: RepeatUnit;
  interval: number;
  weekdays: number;
}

/** `at` is the due instant; when `hasTime` is false the task is due "any time that day". */
export interface DueDate {
  at: number;
  hasTime: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

/** A task as shown in lists, including aggregates so rows never need a second query. */
export interface Task {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  due: DueDate | null;
  /** Minutes before the due moment to notify; null means no reminder. */
  reminderOffsetMinutes: number | null;
  /** Derived instant of the next notification (may be overridden by snooze). */
  reminderAt: number | null;
  /** Alarm tasks use the high-priority alarm channel and request exact delivery. */
  isAlarm: boolean;
  repeat: RepeatRule | null;
  completedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  category: Category | null;
  labels: Label[];
  subtaskTotal: number;
  subtaskDone: number;
}

export interface TaskDetail extends Task {
  subtasks: Subtask[];
  notificationId: string | null;
}

export interface TaskStats {
  dueToday: number;
  doneToday: number;
  overdue: number;
}

/** The persisted shape of a task: relations are referenced by id. */
export interface TaskRecord {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  categoryId: string | null;
  labelIds: string[];
  due: DueDate | null;
  reminderOffsetMinutes: number | null;
  reminderAt: number | null;
  isAlarm: boolean;
  repeat: RepeatRule | null;
  completedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  subtasks: Subtask[];
}

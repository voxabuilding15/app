import { createId, type Clock } from '@/core';

import { MINUTE_MS } from './dates';
import type { Category, Label, Task, TaskDetail, TaskRecord, TaskStats } from './entities';
import type { TaskFilter, TaskSort } from './filters';
import type { ReminderScheduler, TaskRepository, TaxonomyRepository } from './ports';
import { computeReminderAt } from './reminder';
import { nextDueAfter } from './repeat';
import {
  hasErrors,
  validateDraft,
  validateName,
  type DraftErrors,
  type TaskDraft,
} from './validation';

export type ReminderStatus = 'none' | 'scheduled' | 'blocked' | 'past';

export type SaveTaskResult =
  { ok: true; id: string; reminder: ReminderStatus } | { ok: false; errors: DraftErrors };

export type SaveNameResult = { ok: true; id: string } | { ok: false; error: string };

export interface NamedInput {
  id: string | null;
  name: string;
  color: string;
}

const DEFAULT_SNOOZE_MINUTES = 10;

interface TaskUseCaseDeps {
  tasks: TaskRepository;
  taxonomy: TaxonomyRepository;
  reminders: ReminderScheduler;
  clock: Clock;
}

function reminderBody(task: TaskDetail): string {
  const firstLine = task.notes.trim().split('\n')[0];
  return firstLine !== undefined && firstLine.length > 0 ? firstLine : 'This task is due.';
}

function isOpen(task: TaskDetail): boolean {
  return task.completedAt === null && task.archivedAt === null;
}

function toRecord(task: TaskDetail): TaskRecord {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    categoryId: task.category?.id ?? null,
    labelIds: task.labels.map((label) => label.id),
    due: task.due,
    reminderOffsetMinutes: task.reminderOffsetMinutes,
    reminderAt: task.reminderAt,
    isAlarm: task.isAlarm,
    repeat: task.repeat,
    completedAt: task.completedAt,
    archivedAt: task.archivedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    subtasks: task.subtasks,
  };
}

export function createTaskUseCases({ tasks, taxonomy, reminders, clock }: TaskUseCaseDeps) {
  /** Brings the OS notification in line with the task's current state. */
  async function syncReminder(task: TaskDetail): Promise<ReminderStatus> {
    if (task.notificationId !== null) {
      await reminders.cancel(task.notificationId);
    }

    if (task.reminderAt === null) {
      await tasks.setReminder(task.id, null, null);
      return 'none';
    }
    if (!isOpen(task)) {
      await tasks.setReminder(task.id, task.reminderAt, null);
      return 'none';
    }
    if (task.reminderAt <= clock.now()) {
      await tasks.setReminder(task.id, task.reminderAt, null);
      return 'past';
    }

    const outcome = await reminders.schedule({
      taskId: task.id,
      title: task.title,
      body: reminderBody(task),
      fireAt: task.reminderAt,
      isAlarm: task.isAlarm,
    });
    if (outcome.status === 'blocked') {
      await tasks.setReminder(task.id, task.reminderAt, null);
      return 'blocked';
    }
    await tasks.setReminder(task.id, task.reminderAt, outcome.notificationId);
    return 'scheduled';
  }

  async function syncMany(ids: readonly string[]): Promise<void> {
    const found = await tasks.getMany(ids);
    for (const task of found) {
      await syncReminder(task);
    }
  }

  function recordFromDraft(
    draft: TaskDraft,
    base: Pick<TaskRecord, 'id' | 'createdAt' | 'completedAt' | 'archivedAt'>,
    now: number,
  ): TaskRecord {
    const reminderOffsetMinutes = draft.due === null ? null : draft.reminderOffsetMinutes;
    return {
      ...base,
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      priority: draft.priority,
      categoryId: draft.categoryId,
      labelIds: draft.labelIds,
      due: draft.due,
      reminderOffsetMinutes,
      reminderAt:
        draft.due !== null && reminderOffsetMinutes !== null
          ? computeReminderAt(draft.due, reminderOffsetMinutes)
          : null,
      isAlarm: reminderOffsetMinutes !== null && draft.isAlarm,
      repeat: draft.due === null ? null : draft.repeat,
      updatedAt: now,
      subtasks: draft.subtasks
        .filter((subtask) => subtask.title.trim().length > 0)
        .map((subtask) => ({
          id: subtask.id ?? createId(),
          title: subtask.title.trim(),
          completed: subtask.completed,
        })),
    };
  }

  return {
    list(filter: TaskFilter, sort: TaskSort, limit: number): Promise<Task[]> {
      return tasks.list(filter, sort, { now: clock.now(), limit });
    },

    stats(): Promise<TaskStats> {
      return tasks.stats(clock.now());
    },

    get(id: string): Promise<TaskDetail | null> {
      return tasks.get(id);
    },

    async save(draft: TaskDraft, id: string | null): Promise<SaveTaskResult> {
      const errors = validateDraft(draft);
      if (hasErrors(errors)) {
        return { ok: false, errors };
      }

      const now = clock.now();
      const existing = id === null ? null : await tasks.get(id);
      if (id !== null && existing === null) {
        throw new Error('This task no longer exists.');
      }

      const taskId = existing?.id ?? createId();
      const record = recordFromDraft(
        draft,
        {
          id: taskId,
          createdAt: existing?.createdAt ?? now,
          completedAt: existing?.completedAt ?? null,
          archivedAt: existing?.archivedAt ?? null,
        },
        now,
      );

      if (existing === null) {
        await tasks.insert(record);
      } else {
        await tasks.update(record);
      }

      const saved = await tasks.get(taskId);
      const reminder = saved === null ? 'none' : await syncReminder(saved);
      return { ok: true, id: taskId, reminder };
    },

    async setCompleted(id: string, completed: boolean): Promise<void> {
      const task = await tasks.get(id);
      if (task === null || completed === (task.completedAt !== null)) {
        return;
      }
      const now = clock.now();

      if (!completed) {
        await tasks.reopen(id, now);
        await syncMany([id]);
        return;
      }

      let next: TaskRecord | null = null;
      if (task.repeat !== null && task.due !== null) {
        const due = nextDueAfter(task.repeat, task.due, now);
        const record = toRecord(task);
        next = {
          ...record,
          id: createId(),
          due,
          reminderAt:
            task.reminderOffsetMinutes === null
              ? null
              : computeReminderAt(due, task.reminderOffsetMinutes),
          completedAt: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
          subtasks: task.subtasks.map((subtask) => ({
            id: createId(),
            title: subtask.title,
            completed: false,
          })),
        };
      }

      await tasks.complete(id, now, next);
      await syncMany(next === null ? [id] : [id, next.id]);
    },

    toggleSubtask(taskId: string, subtaskId: string, completed: boolean): Promise<void> {
      return tasks.setSubtaskCompleted(taskId, subtaskId, completed);
    },

    async archive(ids: readonly string[]): Promise<void> {
      await tasks.setArchivedAt(ids, clock.now(), clock.now());
      await syncMany(ids);
    },

    async restore(ids: readonly string[]): Promise<void> {
      await tasks.setArchivedAt(ids, null, clock.now());
      await syncMany(ids);
    },

    async remove(ids: readonly string[]): Promise<void> {
      const found = await tasks.getMany(ids);
      for (const task of found) {
        if (task.notificationId !== null) {
          await reminders.cancel(task.notificationId);
          await tasks.setReminder(task.id, task.reminderAt, null);
        }
      }
      await tasks.softDelete(ids, clock.now());
    },

    async undoRemove(ids: readonly string[]): Promise<void> {
      await tasks.undoDelete(ids);
      await syncMany(ids);
    },

    purge(ids: readonly string[]): Promise<void> {
      return tasks.purge(ids);
    },

    purgeLeftovers(): Promise<void> {
      return tasks.purgeAllDeleted();
    },

    async snooze(id: string, minutes: number = DEFAULT_SNOOZE_MINUTES): Promise<void> {
      const task = await tasks.get(id);
      if (task === null || !isOpen(task)) {
        return;
      }
      const reminderAt = clock.now() + minutes * MINUTE_MS;
      await tasks.setReminder(id, reminderAt, task.notificationId);
      await syncReminder({ ...task, reminderAt });
    },
  };
}

export type TaskUseCases = ReturnType<typeof createTaskUseCases>;

interface TaxonomyDeps {
  taxonomy: TaxonomyRepository;
}

type Named = Category | Label;

async function saveNamed(
  input: NamedInput,
  existing: readonly Named[],
  persist: (item: Named) => Promise<void>,
): Promise<SaveNameResult> {
  const error = validateName(input.name);
  if (error !== null) {
    return { ok: false, error };
  }
  const name = input.name.trim();
  const duplicate = existing.some(
    (item) => item.id !== input.id && item.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return { ok: false, error: 'This name is already in use' };
  }
  const id = input.id ?? createId();
  await persist({ id, name, color: input.color });
  return { ok: true, id };
}

export function createTaxonomyUseCases({ taxonomy }: TaxonomyDeps) {
  return {
    categories: () => taxonomy.listCategories(),
    labels: () => taxonomy.listLabels(),
    async saveCategory(input: NamedInput): Promise<SaveNameResult> {
      return saveNamed(input, await taxonomy.listCategories(), (item) =>
        taxonomy.saveCategory(item),
      );
    },
    async saveLabel(input: NamedInput): Promise<SaveNameResult> {
      return saveNamed(input, await taxonomy.listLabels(), (item) => taxonomy.saveLabel(item));
    },
    deleteCategory: (id: string) => taxonomy.deleteCategory(id),
    deleteLabel: (id: string) => taxonomy.deleteLabel(id),
  };
}

export type TaxonomyUseCases = ReturnType<typeof createTaxonomyUseCases>;

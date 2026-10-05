import {
  createCategoryUseCases,
  createId,
  toDateKey,
  type CategoryRepository,
  type Clock,
  type DateKey,
} from '@/core';

import type { HabitEntry, HabitRecord } from './entities';
import type { HabitFilter, HabitScope, HabitSort } from './filters';
import { DEFAULT_HABIT_FILTER, DEFAULT_HABIT_SORT, filterHabits, sortHabits } from './filters';
import type { HabitReminderScheduler, HabitRepository } from './ports';
import { createEvaluator, summarize, type HabitStats, type HabitSummary } from './progress';
import { reminderWeekdays } from './schedule';
import {
  MAX_DAY_COUNT,
  hasHabitErrors,
  validateHabitDraft,
  type HabitDraft,
  type HabitDraftErrors,
} from './validation';

export type ReminderStatus = 'none' | 'scheduled' | 'blocked';

export type SaveHabitResult =
  { ok: true; id: string; reminder: ReminderStatus } | { ok: false; errors: HabitDraftErrors };

export interface HabitDetail {
  entry: HabitEntry;
  summary: HabitSummary;
  stats: HabitStats;
  today: DateKey;
}

interface HabitUseCaseDeps {
  habits: HabitRepository;
  categories: CategoryRepository;
  reminders: HabitReminderScheduler;
  clock: Clock;
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

export function createHabitUseCases({ habits, categories, reminders, clock }: HabitUseCaseDeps) {
  const today = (): DateKey => toDateKey(clock.now());

  /** Brings the scheduled notifications in line with the habit's current state. */
  async function syncReminders({ habit, notificationIds }: HabitEntry): Promise<ReminderStatus> {
    await reminders.cancel(notificationIds);

    if (habit.reminderTime === null || habit.archivedAt !== null || habit.paused) {
      await habits.setNotificationIds(habit.id, []);
      return 'none';
    }

    const outcome = await reminders.schedule({
      habitId: habit.id,
      title: habit.name,
      body: 'Time for your habit. Keep your streak going.',
      ...parseTime(habit.reminderTime),
      weekdays: reminderWeekdays(habit),
    });
    if (outcome.status === 'blocked') {
      await habits.setNotificationIds(habit.id, []);
      return 'blocked';
    }
    await habits.setNotificationIds(habit.id, outcome.notificationIds);
    return 'scheduled';
  }

  async function resync(id: string): Promise<void> {
    const entry = await habits.get(id);
    if (entry !== null) {
      await syncReminders(entry);
    }
  }

  function toRecord(
    draft: HabitDraft,
    base: Pick<HabitRecord, 'id' | 'startDate' | 'archivedAt' | 'createdAt'>,
  ): HabitRecord {
    const weekdays = draft.period === 'daily' ? draft.weekdays : 0b1111111;
    return {
      ...base,
      name: draft.name.trim(),
      notes: draft.notes.trim(),
      icon: draft.icon,
      color: draft.color,
      period: draft.period,
      goalCount: draft.goalCount,
      weekdays,
      reminderTime: draft.reminderTime,
      categoryId: draft.categoryId,
    };
  }

  return {
    categories: createCategoryUseCases(categories),

    /** Summaries for a scope. Filtering and sorting are optional and happen in memory. */
    async list(
      scope: HabitScope,
      filter: HabitFilter = DEFAULT_HABIT_FILTER,
      sort: HabitSort = DEFAULT_HABIT_SORT,
    ): Promise<HabitSummary[]> {
      const now = today();
      const entries = await habits.list(scope);
      const summaries = entries.map((entry) => summarize(entry.habit, entry, now));
      return sortHabits(filterHabits(summaries, filter), sort);
    },

    async detail(id: string): Promise<HabitDetail | null> {
      const entry = await habits.get(id);
      if (entry === null) {
        return null;
      }
      const now = today();
      return {
        entry,
        summary: summarize(entry.habit, entry, now),
        stats: createEvaluator(entry.habit, entry, now).stats(),
        today: now,
      };
    },

    async save(draft: HabitDraft, id: string | null): Promise<SaveHabitResult> {
      const errors = validateHabitDraft(draft);
      if (hasHabitErrors(errors)) {
        return { ok: false, errors };
      }

      const existing = id === null ? null : await habits.get(id);
      if (id !== null && existing === null) {
        throw new Error('This habit no longer exists.');
      }

      const habitId = existing?.habit.id ?? createId();
      const record = toRecord(draft, {
        id: habitId,
        startDate: existing?.habit.startDate ?? today(),
        archivedAt: existing?.habit.archivedAt ?? null,
        createdAt: existing?.habit.createdAt ?? clock.now(),
      });

      if (existing === null) {
        await habits.insert(record);
      } else {
        await habits.update(record);
      }

      const saved = await habits.get(habitId);
      const reminder = saved === null ? 'none' : await syncReminders(saved);
      return { ok: true, id: habitId, reminder };
    },

    /** Logs exactly `count` completions on `date` (0 clears the day). */
    setCount(id: string, date: DateKey, count: number): Promise<void> {
      return habits.setCount(id, date, Math.min(MAX_DAY_COUNT, Math.max(0, Math.round(count))));
    },

    adjust(id: string, date: DateKey, delta: number): Promise<number> {
      return habits.adjustCount(id, date, delta, MAX_DAY_COUNT);
    },

    skip(id: string, date: DateKey, skipped: boolean): Promise<void> {
      return habits.setSkipped(id, date, skipped);
    },

    async pause(id: string): Promise<void> {
      await habits.startPause(id, createId(), today());
      await resync(id);
    },

    async resume(id: string): Promise<void> {
      await habits.endPause(id, today());
      await resync(id);
    },

    async archive(id: string): Promise<void> {
      await habits.setArchivedAt(id, clock.now());
      await resync(id);
    },

    async restore(id: string): Promise<void> {
      await habits.setArchivedAt(id, null);
      await resync(id);
    },

    async remove(id: string): Promise<void> {
      const entry = await habits.get(id);
      if (entry !== null) {
        await reminders.cancel(entry.notificationIds);
      }
      await habits.delete(id);
    },
  };
}

export type HabitUseCases = ReturnType<typeof createHabitUseCases>;

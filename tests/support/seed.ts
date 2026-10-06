import { createId, type Database } from '@/core';
import { SqliteSessionRepository } from '@/features/pomodoro/data/sqlite-session-repository';

/** Writes rows for every feature straight into the database, for tests of what reads them. */
export function createSeeder(db: Database, now: () => number) {
  const sessions = new SqliteSessionRepository(db);
  return {
    addTask(
      title: string,
      options: {
        createdAt?: number;
        dueAt?: number;
        completedAt?: number;
        deleted?: boolean;
        archived?: boolean;
      } = {},
    ) {
      const created = options.createdAt ?? now();
      db.runSync(
        `INSERT INTO tasks (id, title, created_at, updated_at, due_at, completed_at, deleted_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          title,
          created,
          created,
          options.dueAt ?? null,
          options.completedAt ?? null,
          options.deleted === true ? created : null,
          options.archived === true ? created : null,
        ],
      );
    },

    addHabit(
      name: string,
      startDate: string,
      logs: { date: string; count?: number; status?: 'done' | 'skipped' }[] = [],
    ) {
      const id = createId();
      db.runSync(
        `INSERT INTO habits (id, name, icon, color, goal_period, goal_count, created_at, start_date)
         VALUES (?, ?, 'star', '#000000', 'daily', 1, ?, ?)`,
        [id, name, now(), startDate],
      );
      for (const log of logs) {
        db.runSync('INSERT INTO habit_logs (habit_id, date, count, status) VALUES (?, ?, ?, ?)', [
          id,
          log.date,
          log.count ?? 1,
          log.status ?? 'done',
        ]);
      }
      return id;
    },

    addEvent(
      title: string,
      startAt: number,
      endAt: number,
      options: {
        allDay?: boolean;
        repeatUnit?: 'day' | 'week' | 'month' | 'year';
        repeatCount?: number;
      } = {},
    ) {
      db.runSync(
        `INSERT INTO events (id, title, start_at, end_at, all_day, repeat_unit, repeat_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          title,
          startAt,
          endAt,
          options.allDay === true ? 1 : 0,
          options.repeatUnit ?? null,
          options.repeatCount ?? null,
          startAt,
          startAt,
        ],
      );
    },

    addTransaction(
      type: 'income' | 'expense',
      amountMinor: number,
      occurredAt: number,
      categoryId: string | null = null,
    ) {
      db.runSync(
        `INSERT OR IGNORE INTO accounts (id, name, type, color, initial_balance_minor, created_at)
         VALUES ('acc', 'Main', 'bank', '#000000', 0, 1)`,
      );
      db.runSync(
        `INSERT INTO transactions (id, type, amount_minor, account_id, category_id, occurred_at, created_at, updated_at)
         VALUES (?, ?, ?, 'acc', ?, ?, ?, ?)`,
        [createId(), type, amountMinor, categoryId, occurredAt, occurredAt, occurredAt],
      );
    },

    addCategory(name: string, kind: 'expense' | 'income' = 'expense') {
      const id = createId();
      db.runSync(
        `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES (?, ?, ?, '#112233', 'star', 1)`,
        [id, kind, name],
      );
      return id;
    },

    addNote(
      title: string,
      createdAt: number,
      updatedAt = createdAt,
      options: { deleted?: boolean } = {},
    ) {
      db.runSync(
        `INSERT INTO notes (id, title, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)`,
        [createId(), title, createdAt, updatedAt, options.deleted === true ? updatedAt : null],
      );
    },

    async addFocus(
      startedAt: number,
      minutes: number,
      options: { outcome?: 'completed' | 'stopped'; deepFocus?: number } = {},
    ) {
      await sessions.insert({
        id: createId(),
        kind: 'focus',
        plannedSeconds: minutes * 60,
        durationSeconds: minutes * 60,
        startedAt,
        endedAt: startedAt + minutes * 60_000,
        outcome: options.outcome ?? 'completed',
        pauses: 0,
        deepFocus: options.deepFocus ?? 100,
        note: '',
        taskId: null,
        habitId: null,
        tagIds: [],
      });
    },
  };
}

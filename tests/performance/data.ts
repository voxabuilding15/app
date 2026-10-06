import type { Database } from '@/core';

export interface Sizes {
  tasks: number;
  habits: number;
  /** Days of history each habit has logs for. */
  habitDays: number;
  events: number;
  transactions: number;
  notes: number;
  sessions: number;
}

/** What a heavy user might have after a couple of years. */
export const LARGE: Sizes = {
  tasks: 5_000,
  habits: 30,
  habitDays: 730,
  events: 1_500,
  transactions: 10_000,
  notes: 2_000,
  sessions: 5_000,
};

const DAY = 86_400_000;

/** A small deterministic random generator, so every run sees the same data. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const dayKey = (at: number) => {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};

/** Fills a freshly migrated database with `sizes` of everything. */
export function populate(db: Database, sizes: Sizes, now: number): void {
  const rand = random(42);
  const pick = (count: number) => Math.floor(rand() * count);
  const ago = (maxDays: number) => now - Math.floor(rand() * maxDays * DAY);
  const years = 2 * 365;

  db.withTransactionSync(() => {
    for (let index = 0; index < 20; index += 1) {
      db.runSync(
        `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES (?, ?, ?, '#112233', 'star', 1)`,
        [
          `cat-${index}`,
          ['task', 'expense', 'income', 'habit', 'event'][index % 5] ?? 'task',
          `Category ${index}`,
        ],
      );
    }
    for (let index = 0; index < 5; index += 1) {
      db.runSync(
        `INSERT INTO accounts (id, name, type, color, initial_balance_minor, created_at) VALUES (?, ?, 'bank', '#000000', 0, 1)`,
        [`acc-${index}`, `Account ${index}`],
      );
    }
    for (let index = 0; index < 20; index += 1) {
      db.runSync(`INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, NULL, 1)`, [
        `f-${index}`,
        `Folder ${index}`,
      ]);
    }

    for (let index = 0; index < sizes.tasks; index += 1) {
      const created = ago(years);
      const done = rand() < 0.5;
      const archived = done && rand() < 0.2;
      db.runSync(
        `INSERT INTO tasks (id, title, description, priority, category_id, due_at, completed_at, archived_at, deleted_at, created_at, updated_at)
         VALUES (?, ?, 'Some description of the task', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `task-${index}`,
          `Task number ${index}`,
          pick(4),
          rand() < 0.7 ? `cat-${pick(4) * 5}` : null,
          rand() < 0.6 ? created + pick(30) * DAY : null,
          done ? created + pick(10) * DAY : null,
          archived ? created + 11 * DAY : null,
          rand() < 0.02 ? created : null,
          created,
          created,
        ],
      );
    }

    for (let index = 0; index < sizes.habits; index += 1) {
      db.runSync(
        `INSERT INTO habits (id, name, icon, color, goal_period, goal_count, created_at, start_date)
         VALUES (?, ?, 'star', '#000000', 'daily', 1, ?, ?)`,
        [`habit-${index}`, `Habit ${index}`, now - years * DAY, dayKey(now - years * DAY)],
      );
      for (let day = 0; day < sizes.habitDays; day += 1) {
        if (rand() < 0.7) {
          db.runSync(
            `INSERT INTO habit_logs (habit_id, date, count, status) VALUES (?, ?, 1, 'done')`,
            [`habit-${index}`, dayKey(now - day * DAY)],
          );
        }
      }
    }

    for (let index = 0; index < sizes.events; index += 1) {
      const start = now - pick(years) * DAY + pick(14) * DAY;
      const recurring = index % 30 === 0;
      db.runSync(
        `INSERT INTO events (id, title, start_at, end_at, repeat_unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `ev-${index}`,
          `Event ${index}`,
          start,
          start + 3_600_000,
          recurring ? 'week' : null,
          start,
          start,
        ],
      );
    }

    for (let index = 0; index < sizes.transactions; index += 1) {
      const at = ago(years);
      const income = rand() < 0.15;
      db.runSync(
        `INSERT INTO transactions (id, type, amount_minor, account_id, category_id, note, occurred_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)`,
        [
          `tx-${index}`,
          income ? 'income' : 'expense',
          100 + pick(50_000),
          `acc-${pick(5)}`,
          `cat-${(income ? 2 : 1) + pick(3) * 5}`,
          at,
          at,
          at,
        ],
      );
    }

    const body = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(8);
    for (let index = 0; index < sizes.notes; index += 1) {
      const created = ago(years);
      db.runSync(
        `INSERT INTO notes (id, folder_id, title, body, pinned, favorite, archived_at, deleted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `note-${index}`,
          rand() < 0.5 ? `f-${pick(20)}` : null,
          `Note ${index}`,
          body,
          rand() < 0.05 ? 1 : 0,
          rand() < 0.1 ? 1 : 0,
          rand() < 0.1 ? created : null,
          rand() < 0.03 ? created : null,
          created,
          created + pick(5) * DAY,
        ],
      );
    }

    for (let index = 0; index < sizes.sessions; index += 1) {
      const started = ago(years);
      const focus = rand() < 0.8;
      const seconds = (focus ? 1500 : 300) - pick(focus ? 600 : 200);
      db.runSync(
        `INSERT INTO pomodoro_sessions (id, kind, planned_seconds, duration_seconds, started_at, ended_at, outcome, pauses, deep_focus, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, '')`,
        [
          `s-${index}`,
          focus ? 'focus' : 'short_break',
          focus ? 1500 : 300,
          seconds,
          started,
          started + seconds * 1000,
          rand() < 0.8 ? 'completed' : 'stopped',
          focus ? 60 + pick(40) : null,
        ],
      );
    }
  });
  db.execSync('ANALYZE');
}

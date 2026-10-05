export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
}

/**
 * Schema conventions:
 * - Timestamps are INTEGER epoch milliseconds; calendar dates are 'YYYY-MM-DD' TEXT.
 * - Money is stored as INTEGER minor units (cents) to avoid floating point drift.
 * - Every foreign key column is indexed so cascades and joins never scan.
 * - Partial indexes only cover the rows that hot queries actually read.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('task','expense','income','note')),
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_categories_kind ON categories(kind)`,

      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 0 AND 3),
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        due_at INTEGER,
        reminder_at INTEGER,
        is_alarm INTEGER NOT NULL DEFAULT 0 CHECK (is_alarm IN (0,1)),
        repeat_rule TEXT,
        completed_at INTEGER,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_tasks_open_due ON tasks(due_at) WHERE completed_at IS NULL AND archived_at IS NULL`,
      `CREATE INDEX idx_tasks_reminder ON tasks(reminder_at) WHERE reminder_at IS NOT NULL AND completed_at IS NULL`,
      `CREATE INDEX idx_tasks_completed ON tasks(completed_at) WHERE completed_at IS NOT NULL`,
      `CREATE INDEX idx_tasks_category ON tasks(category_id)`,

      `CREATE TABLE subtasks (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX idx_subtasks_task ON subtasks(task_id, position)`,

      `CREATE TABLE labels (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL
      )`,
      `CREATE TABLE task_labels (
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, label_id)
      ) WITHOUT ROWID`,
      `CREATE INDEX idx_task_labels_label ON task_labels(label_id)`,

      `CREATE TABLE habits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        goal_period TEXT NOT NULL CHECK (goal_period IN ('daily','weekly','monthly')),
        goal_count INTEGER NOT NULL DEFAULT 1 CHECK (goal_count > 0),
        reminder_time TEXT,
        archived_at INTEGER,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_habits_active ON habits(created_at) WHERE archived_at IS NULL`,
      `CREATE TABLE habit_logs (
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
        PRIMARY KEY (habit_id, date)
      ) WITHOUT ROWID`,
      `CREATE INDEX idx_habit_logs_date ON habit_logs(date)`,

      `CREATE TABLE transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        occurred_at INTEGER NOT NULL,
        recurring_rule TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_transactions_type_date ON transactions(type, occurred_at)`,
      `CREATE INDEX idx_transactions_category ON transactions(category_id)`,
      `CREATE INDEX idx_transactions_recurring ON transactions(recurring_rule) WHERE recurring_rule IS NOT NULL`,
      `CREATE TABLE budgets (
        month TEXT PRIMARY KEY NOT NULL,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0)
      ) WITHOUT ROWID`,

      `CREATE TABLE folders (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE notes (
        id TEXT PRIMARY KEY NOT NULL,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        is_checklist INTEGER NOT NULL DEFAULT 0 CHECK (is_checklist IN (0,1)),
        pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
        favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0,1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_notes_folder ON notes(folder_id, updated_at DESC)`,
      `CREATE INDEX idx_notes_pinned ON notes(updated_at DESC) WHERE pinned = 1`,

      `CREATE TABLE pomodoro_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('focus','short_break','long_break')),
        duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
        started_at INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 1 CHECK (completed IN (0,1))
      )`,
      `CREATE INDEX idx_pomodoro_started ON pomodoro_sessions(started_at)`,

      `CREATE TABLE alarms (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        time TEXT NOT NULL,
        days_mask INTEGER NOT NULL DEFAULT 0 CHECK (days_mask BETWEEN 0 AND 127),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
        sound TEXT,
        vibrate INTEGER NOT NULL DEFAULT 1 CHECK (vibrate IN (0,1)),
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_alarms_enabled ON alarms(time) WHERE enabled = 1`,
    ],
  },
];

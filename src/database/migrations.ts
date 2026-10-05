export interface Migration {
  version: number;
  name: string;
  statements: readonly string[];
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('task','expense','income','note')),
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority INTEGER NOT NULL DEFAULT 1,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        due_at INTEGER,
        reminder_at INTEGER,
        is_alarm INTEGER NOT NULL DEFAULT 0,
        repeat_rule TEXT,
        completed_at INTEGER,
        archived_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(completed_at, archived_at)`,
      `CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id)`,
      `CREATE TABLE IF NOT EXISTS labels (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS task_labels (
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, label_id)
      )`,
      `CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        goal_period TEXT NOT NULL CHECK (goal_period IN ('daily','weekly','monthly')),
        goal_count INTEGER NOT NULL DEFAULT 1,
        reminder_time TEXT,
        archived_at INTEGER,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS habit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        UNIQUE (habit_id, date)
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        amount_minor INTEGER NOT NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        occurred_at INTEGER NOT NULL,
        recurring_rule TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(occurred_at)`,
      `CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY NOT NULL,
        month TEXT NOT NULL UNIQUE,
        amount_minor INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        is_checklist INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('focus','short_break','long_break')),
        duration_seconds INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS alarms (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        time TEXT NOT NULL,
        days_mask INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        sound TEXT,
        vibrate INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
    ],
  },
];

export interface Migration {
  version: number;
  name: string;
  /** Rebuilds tables SQLite cannot ALTER: runs with foreign keys off and verifies them afterwards. */
  rebuildsTables?: boolean;
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
  {
    version: 2,
    name: 'tasks_feature',
    statements: [
      // Due date: `due_at` is the instant; `due_has_time` = 0 means "all day" (time part ignored).
      `ALTER TABLE tasks ADD COLUMN due_has_time INTEGER NOT NULL DEFAULT 0 CHECK (due_has_time IN (0,1))`,
      // Reminder offset in minutes before the due moment (NULL = no reminder); `reminder_at` is the derived instant.
      `ALTER TABLE tasks ADD COLUMN reminder_offset_minutes INTEGER CHECK (reminder_offset_minutes >= 0)`,
      `ALTER TABLE tasks ADD COLUMN notification_id TEXT`,
      // Structured repeat rule (replaces the unused free-text `repeat_rule`).
      `ALTER TABLE tasks ADD COLUMN repeat_unit TEXT CHECK (repeat_unit IN ('day','week','month'))`,
      `ALTER TABLE tasks ADD COLUMN repeat_interval INTEGER NOT NULL DEFAULT 1 CHECK (repeat_interval BETWEEN 1 AND 365)`,
      `ALTER TABLE tasks ADD COLUMN repeat_weekdays INTEGER NOT NULL DEFAULT 0 CHECK (repeat_weekdays BETWEEN 0 AND 127)`,
      `ALTER TABLE tasks DROP COLUMN repeat_rule`,
      // Soft delete powers undo; rows are hard-deleted once the undo window closes.
      `ALTER TABLE tasks ADD COLUMN deleted_at INTEGER`,

      `DROP INDEX idx_tasks_open_due`,
      `DROP INDEX idx_tasks_reminder`,
      `DROP INDEX idx_tasks_completed`,
      `CREATE INDEX idx_tasks_active_due ON tasks(due_at) WHERE deleted_at IS NULL AND archived_at IS NULL`,
      `CREATE INDEX idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL AND archived_at IS NULL AND deleted_at IS NULL`,
      `CREATE INDEX idx_tasks_archived_at ON tasks(archived_at) WHERE archived_at IS NOT NULL AND deleted_at IS NULL`,
      `CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL`,

      `CREATE UNIQUE INDEX idx_categories_kind_name ON categories(kind, name COLLATE NOCASE)`,
      `CREATE UNIQUE INDEX idx_labels_name_nocase ON labels(name COLLATE NOCASE)`,
    ],
  },
  {
    version: 3,
    name: 'habits_feature',
    rebuildsTables: true,
    statements: [
      // `categories.kind` gains 'habit'. A CHECK cannot be altered, so the table is rebuilt.
      `CREATE TABLE categories_new (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('task','habit','expense','income','note')),
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `INSERT INTO categories_new (id, kind, name, color, icon, created_at)
         SELECT id, kind, name, color, icon, created_at FROM categories`,
      `DROP TABLE categories`,
      `ALTER TABLE categories_new RENAME TO categories`,
      `CREATE INDEX idx_categories_kind ON categories(kind)`,
      `CREATE UNIQUE INDEX idx_categories_kind_name ON categories(kind, name COLLATE NOCASE)`,

      `ALTER TABLE habits ADD COLUMN notes TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE habits ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL`,
      // Weekday bitmask (Sunday = bit 0) of the days a daily-period habit is scheduled; 127 = every day.
      `ALTER TABLE habits ADD COLUMN weekdays INTEGER NOT NULL DEFAULT 127 CHECK (weekdays BETWEEN 1 AND 127)`,
      // 'YYYY-MM-DD' local day the habit starts counting from (NULL falls back to created_at).
      `ALTER TABLE habits ADD COLUMN start_date TEXT`,
      // JSON array of scheduled notification ids, so reminders can be cancelled and rescheduled.
      `ALTER TABLE habits ADD COLUMN notification_ids TEXT NOT NULL DEFAULT '[]'`,
      `CREATE INDEX idx_habits_category ON habits(category_id)`,

      // 'skipped' days are excused: they neither extend nor break a streak.
      `ALTER TABLE habit_logs ADD COLUMN status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done','skipped'))`,

      // A pause covers days from start_date up to (not including) end_date; NULL end = still paused.
      `CREATE TABLE habit_pauses (
        id TEXT PRIMARY KEY NOT NULL,
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL,
        end_date TEXT,
        CHECK (end_date IS NULL OR end_date > start_date)
      )`,
      `CREATE INDEX idx_habit_pauses_habit ON habit_pauses(habit_id, start_date)`,
      `CREATE UNIQUE INDEX idx_habit_pauses_open ON habit_pauses(habit_id) WHERE end_date IS NULL`,
    ],
  },
  {
    version: 4,
    name: 'calendar_feature',
    rebuildsTables: true,
    statements: [
      // `categories.kind` gains 'event' (same table rebuild as v3, since a CHECK cannot be altered).
      `CREATE TABLE categories_new (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('task','habit','event','expense','income','note')),
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `INSERT INTO categories_new (id, kind, name, color, icon, created_at)
         SELECT id, kind, name, color, icon, created_at FROM categories`,
      `DROP TABLE categories`,
      `ALTER TABLE categories_new RENAME TO categories`,
      `CREATE INDEX idx_categories_kind ON categories(kind)`,
      `CREATE UNIQUE INDEX idx_categories_kind_name ON categories(kind, name COLLATE NOCASE)`,

      // Events. Times are epoch ms and `end_at` is exclusive. All-day events start at local
      // midnight of their first day and end at local midnight after their last day.
      `CREATE TABLE events (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        start_at INTEGER NOT NULL,
        end_at INTEGER NOT NULL,
        all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
        repeat_unit TEXT CHECK (repeat_unit IN ('day','week','month','year')),
        repeat_interval INTEGER NOT NULL DEFAULT 1 CHECK (repeat_interval BETWEEN 1 AND 365),
        repeat_weekdays INTEGER NOT NULL DEFAULT 0 CHECK (repeat_weekdays BETWEEN 0 AND 127),
        repeat_until TEXT,
        repeat_count INTEGER CHECK (repeat_count IS NULL OR repeat_count >= 1),
        reminder_offset_minutes INTEGER CHECK (reminder_offset_minutes IS NULL OR reminder_offset_minutes >= 0),
        notification_ids TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (end_at > start_at)
      )`,
      `CREATE INDEX idx_events_single ON events(start_at) WHERE repeat_unit IS NULL`,
      `CREATE INDEX idx_events_recurring ON events(start_at) WHERE repeat_unit IS NOT NULL`,
      `CREATE INDEX idx_events_category ON events(category_id)`,
      // Occurrences of a recurring event that were deleted or moved on their own.
      `CREATE TABLE event_exceptions (
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        occurrence_date TEXT NOT NULL,
        PRIMARY KEY (event_id, occurrence_date)
      ) WITHOUT ROWID`,
    ],
  },
  {
    version: 5,
    name: 'finance_feature',
    rebuildsTables: true,
    statements: [
      // Money is INTEGER minor units. A balance is the account's opening balance plus everything
      // that moved in or out of it; transfers appear on both accounts.
      `CREATE TABLE accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('cash','bank','savings','credit_card')),
        color TEXT NOT NULL,
        initial_balance_minor INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        created_at INTEGER NOT NULL
      )`,
      `CREATE UNIQUE INDEX idx_accounts_name ON accounts(name COLLATE NOCASE)`,
      `CREATE INDEX idx_accounts_active ON accounts(created_at) WHERE archived_at IS NULL`,

      // Rules that post a transaction on a schedule. `next_date` is the first occurrence that has
      // not been posted yet (NULL once the series has ended), so deleting a posted transaction never
      // makes it come back.
      `CREATE TABLE recurring_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        repeat_unit TEXT NOT NULL CHECK (repeat_unit IN ('day','week','month','year')),
        repeat_interval INTEGER NOT NULL DEFAULT 1 CHECK (repeat_interval BETWEEN 1 AND 365),
        repeat_weekdays INTEGER NOT NULL DEFAULT 0 CHECK (repeat_weekdays BETWEEN 0 AND 127),
        start_date TEXT NOT NULL,
        end_date TEXT,
        next_date TEXT,
        paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK ((type = 'transfer') = (to_account_id IS NOT NULL)),
        CHECK (to_account_id IS NULL OR to_account_id <> account_id),
        CHECK (end_date IS NULL OR end_date >= start_date)
      )`,
      `CREATE INDEX idx_recurring_due ON recurring_transactions(next_date) WHERE paused = 0 AND next_date IS NOT NULL`,
      `CREATE INDEX idx_recurring_account ON recurring_transactions(account_id)`,
      `CREATE INDEX idx_recurring_to_account ON recurring_transactions(to_account_id) WHERE to_account_id IS NOT NULL`,
      `CREATE INDEX idx_recurring_category ON recurring_transactions(category_id)`,

      // Transactions written before accounts existed (none are created by earlier app versions,
      // but a database may hold some) move into a default Cash account instead of being dropped.
      `INSERT INTO accounts (id, name, type, color, initial_balance_minor, archived_at, created_at)
         SELECT 'legacy-cash', 'Cash', 'cash', '#16A34A', 0, NULL, CAST(strftime('%s','now') AS INTEGER) * 1000
         WHERE EXISTS (SELECT 1 FROM transactions)`,
      `CREATE TABLE transactions_new (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        occurred_at INTEGER NOT NULL,
        recurring_id TEXT REFERENCES recurring_transactions(id) ON DELETE SET NULL,
        occurrence_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK ((type = 'transfer') = (to_account_id IS NOT NULL)),
        CHECK (to_account_id IS NULL OR to_account_id <> account_id),
        CHECK (type <> 'transfer' OR category_id IS NULL)
      )`,
      `INSERT INTO transactions_new (id, type, amount_minor, account_id, category_id, note, occurred_at, created_at, updated_at)
         SELECT id, type, amount_minor, 'legacy-cash', category_id, note, occurred_at, created_at, created_at
         FROM transactions`,
      `DROP TABLE transactions`,
      `ALTER TABLE transactions_new RENAME TO transactions`,
      `CREATE INDEX idx_transactions_occurred ON transactions(occurred_at)`,
      `CREATE INDEX idx_transactions_account ON transactions(account_id, occurred_at)`,
      `CREATE INDEX idx_transactions_to_account ON transactions(to_account_id) WHERE to_account_id IS NOT NULL`,
      `CREATE INDEX idx_transactions_category ON transactions(category_id, occurred_at)`,
      `CREATE INDEX idx_transactions_type_date ON transactions(type, occurred_at)`,
      `CREATE UNIQUE INDEX idx_transactions_occurrence ON transactions(recurring_id, occurrence_date) WHERE recurring_id IS NOT NULL`,

      // Budgets: weekly (Monday to Sunday) and monthly ones repeat on their own; custom budgets
      // cover an explicit date range. The old one-amount-per-month table becomes custom budgets.
      `CREATE TABLE budgets_new (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        period TEXT NOT NULL CHECK (period IN ('weekly','monthly','custom')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        start_date TEXT,
        end_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK ((period = 'custom') = (start_date IS NOT NULL AND end_date IS NOT NULL)),
        CHECK (start_date IS NULL OR end_date >= start_date)
      )`,
      `INSERT INTO budgets_new (id, name, period, amount_minor, start_date, end_date, created_at, updated_at)
         SELECT 'legacy-' || month, 'Budget ' || month, 'custom', amount_minor,
                month || '-01', date(month || '-01', '+1 month', '-1 day'),
                CAST(strftime('%s','now') AS INTEGER) * 1000, CAST(strftime('%s','now') AS INTEGER) * 1000
         FROM budgets WHERE amount_minor > 0`,
      `DROP TABLE budgets`,
      `ALTER TABLE budgets_new RENAME TO budgets`,
      `CREATE UNIQUE INDEX idx_budgets_name ON budgets(name COLLATE NOCASE)`,

      // A budget limits spending in the listed categories; with none listed it covers all spending.
      `CREATE TABLE budget_categories (
        budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (budget_id, category_id)
      ) WITHOUT ROWID`,
      `CREATE INDEX idx_budget_categories_category ON budget_categories(category_id)`,
    ],
  },
];

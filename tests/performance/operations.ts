import { SqliteAchievementSource } from '@/features/achievements/data/sqlite-source';
import { SqliteUnlockRepository } from '@/features/achievements/data/sqlite-unlocks';
import { createAchievementUseCases } from '@/features/achievements/domain/usecases';
import { DeviceRestoreEffects } from '@/features/backup/data/restore-effects';
import { SqliteBackupStore } from '@/features/backup/data/sqlite-backup-store';
import { createBackupUseCases } from '@/features/backup/domain/usecases';
import { SqliteEventRepository } from '@/features/calendar/data/sqlite-event-repository';
import { SqliteTransactionRepository } from '@/features/finance/data/sqlite-transaction-repository';
import {
  DEFAULT_FILTER as MONEY_FILTER,
  DEFAULT_SORT as MONEY_SORT,
} from '@/features/finance/domain/filters';
import { SqliteHabitRepository } from '@/features/habits/data/sqlite-habit-repository';
import { SqliteNoteRepository } from '@/features/notes/data/sqlite-note-repository';
import {
  DEFAULT_FILTER as NOTE_FILTER,
  DEFAULT_SORT as NOTE_SORT,
} from '@/features/notes/domain/filters';
import { SqliteSessionRepository } from '@/features/pomodoro/data/sqlite-session-repository';
import { DEFAULT_SETTINGS } from '@/features/pomodoro/domain/settings';
import { createStatsUseCases as createFocusStats } from '@/features/pomodoro/domain/stats-usecases';
import { createStatsSources } from '@/features/statistics/data/create-sources';
import { createStatsUseCases } from '@/features/statistics/domain/usecases';
import { SqliteTaskRepository } from '@/features/tasks/data/sqlite-task-repository';
import { DEFAULT_FILTER as TASK_FILTER, defaultSortFor } from '@/features/tasks/domain/filters';
import type { Database, NotificationService } from '@/core';

import { MemoryFiles } from '../support/memory-files';

export interface Operation {
  name: string;
  /** The slowest this may take on any machine that runs the tests. */
  limitMs: number;
  run: () => Promise<unknown>;
}

const DAY = 86_400_000;

/** The things people wait for, run against `db` as the app would run them. */
export function buildOperations(db: Database, now: number): Operation[] {
  const clock = { now: () => now };
  const values = new Map<string, string>();
  const storage = {
    getString: (key: string) => values.get(key),
    setString: (key: string, value: string) => void values.set(key, value),
    remove: (key: string) => void values.delete(key),
  };
  const files = new MemoryFiles();
  const sources = createStatsSources({
    clock,
    db,
    storage,
    files,
    categories: () => {
      throw new Error('not used');
    },
    notifications: undefined as never,
    authenticator: undefined as never,
  });
  const stats = createStatsUseCases({ sources, clock });
  const sessions = new SqliteSessionRepository(db);
  const store = new SqliteBackupStore(db);
  const backups = createBackupUseCases({
    store,
    files,
    storage,
    clock,
    effects: new DeviceRestoreEffects(
      { cancelAll: async () => undefined } as unknown as NotificationService,
      storage,
    ),
    appName: 'FocusFlow',
    appVersion: '1.0.0',
  });
  const today = new Date(now);
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const tasks = new SqliteTaskRepository(db);
  let saved = '';

  return [
    { name: 'Statistics: day', limitMs: 2_000, run: () => stats.report('day', key) },
    { name: 'Statistics: week', limitMs: 2_000, run: () => stats.report('week', key) },
    { name: 'Statistics: month', limitMs: 3_000, run: () => stats.report('month', key) },
    { name: 'Statistics: year', limitMs: 4_000, run: () => stats.report('year', key) },
    {
      name: 'Achievements: check',
      limitMs: 2_000,
      run: () =>
        createAchievementUseCases({
          source: new SqliteAchievementSource(db),
          unlocks: new SqliteUnlockRepository(db),
          clock,
        }).sync(),
    },
    {
      name: 'Focus statistics (400 days)',
      limitMs: 2_000,
      run: () => createFocusStats({ sessions, clock }).overview(DEFAULT_SETTINGS),
    },
    {
      name: 'Tasks: active list',
      limitMs: 1_000,
      run: () => tasks.list(TASK_FILTER, defaultSortFor('active'), { now, limit: 100 }),
    },
    {
      name: 'Tasks: search',
      limitMs: 1_500,
      run: () =>
        tasks.list({ ...TASK_FILTER, search: 'number 12' }, defaultSortFor('active'), {
          now,
          limit: 100,
        }),
    },
    {
      name: 'Habits: all with history',
      limitMs: 2_000,
      run: () => new SqliteHabitRepository(db).list('active'),
    },
    {
      name: 'Calendar: two months',
      limitMs: 1_500,
      run: () => new SqliteEventRepository(db).listInRange(now - 30 * DAY, now + 30 * DAY),
    },
    {
      name: 'Finance: recent transactions',
      limitMs: 1_000,
      run: () =>
        new SqliteTransactionRepository(db).list(MONEY_FILTER, MONEY_SORT, { now, limit: 100 }),
    },
    {
      name: 'Notes: list',
      limitMs: 1_000,
      run: () =>
        new SqliteNoteRepository(db).list(
          { ...NOTE_FILTER, folderIds: null, withoutFolder: false },
          NOTE_SORT,
          100,
        ),
    },
    {
      name: 'Backup: create',
      limitMs: 8_000,
      run: async () => {
        const made = await backups.create('manual', false);
        saved = await files.readText('documents', made.file.path);
        return made;
      },
    },
    {
      name: 'Backup: check file',
      limitMs: 8_000,
      run: async () => backups.inspect(saved),
    },
    {
      name: 'Backup: merge identical data',
      limitMs: 12_000,
      run: async () => {
        const result = backups.inspect(saved);
        if (result.ok) {
          await backups.restore(result.backup, { mode: 'merge', policy: 'newest' });
        }
      },
    },
    {
      name: 'Backup: replace everything',
      limitMs: 12_000,
      run: async () => {
        const result = backups.inspect(saved);
        if (result.ok) {
          await backups.restore(result.backup, { mode: 'replace', policy: 'keep-local' });
        }
      },
    },
  ];
}

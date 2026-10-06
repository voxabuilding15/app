import type { KeyValueStorage, NotificationService } from '@/core';
import { createId } from '@/core';
import { DeviceRestoreEffects } from '@/features/backup/data/restore-effects';
import { SqliteBackupStore } from '@/features/backup/data/sqlite-backup-store';
import { createBackupUseCases } from '@/features/backup/domain/usecases';

import { MemoryFiles } from '../support/memory-files';
import { createSeeder } from '../support/seed';
import { createTestDatabase } from '../tasks/test-database';

export const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    setString: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}

/** The backup use cases over a fresh in-memory database, files and settings. */
export function createBackups(start = at(2026, 10, 15, 18)) {
  const state = { now: start };
  const db = createTestDatabase();
  const files = new MemoryFiles();
  const storage = memoryStorage();
  const cancelled = { count: 0 };
  const notifications = {
    cancelAll: async () => void (cancelled.count += 1),
  } as unknown as NotificationService;
  const seed = createSeeder(db, () => state.now);
  const store = new SqliteBackupStore(db);

  return {
    db,
    state,
    files,
    storage,
    cancelled,
    seed,
    store,
    backups: createBackupUseCases({
      store,
      files,
      storage,
      clock: { now: () => state.now },
      effects: new DeviceRestoreEffects(notifications, storage),
      appName: 'FocusFlow',
      appVersion: '1.0.0',
    }),
    run(sql: string, params: (string | number | null)[] = []) {
      db.runSync(sql, params);
    },
    count(table: string): number {
      return db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
    },
    /** A little of everything, linked together. */
    async seedEverything() {
      const category = createId();
      this.run(
        `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES (?, 'expense', 'Food', '#112233', 'star', 1)`,
        [category],
      );
      const taskCategory = createId();
      this.run(
        `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES (?, 'task', 'Work', '#112233', 'star', 1)`,
        [taskCategory],
      );
      seed.addTask('Write report', {
        createdAt: at(2026, 10, 10),
        dueAt: at(2026, 10, 16),
        completedAt: at(2026, 10, 12),
      });
      this.run('UPDATE tasks SET category_id = ?', [taskCategory]);
      const habit = seed.addHabit('Read', '2026-10-01', [
        { date: '2026-10-12' },
        { date: '2026-10-13', count: 2 },
      ]);
      seed.addEvent('Dentist', at(2026, 10, 20, 9), at(2026, 10, 20, 10));
      seed.addTransaction('expense', 4_250, at(2026, 10, 14), category);
      seed.addTransaction('income', 200_000, at(2026, 10, 1));
      const folder = createId();
      this.run(
        `INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, 'Ideas', NULL, 1)`,
        [folder],
      );
      const note = createId();
      this.run(
        `INSERT INTO notes (id, folder_id, title, body, created_at, updated_at) VALUES (?, ?, 'Plan', 'Body', ?, ?)`,
        [note, folder, at(2026, 10, 13), at(2026, 10, 14)],
      );
      const noteTag = createId();
      this.run(
        `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES (?, 'note', 'Idea', '#112233', 'star', 1)`,
        [noteTag],
      );
      this.run('INSERT INTO note_tags (note_id, category_id) VALUES (?, ?)', [note, noteTag]);
      await seed.addFocus(at(2026, 10, 14, 9), 25);
      this.run(
        `INSERT INTO achievement_unlocks (key, kind, ref, xp, unlocked_at) VALUES ('badge:first-task', 'badge', 'first-task', 20, 5)`,
      );
      this.run('UPDATE achievement_state SET peak_xp = 120');
      return { category, taskCategory, habit, folder, note, noteTag };
    },
    /** Adds an attachment row with a file on "disk". */
    async addAttachment(noteId: string, path: string, content: string) {
      this.run(
        `INSERT INTO note_attachments (id, note_id, kind, name, mime, path, size_bytes, created_at)
         VALUES (?, ?, 'image', ?, 'image/png', ?, ?, 1)`,
        [createId(), noteId, path.split('/').pop() ?? path, path, content.length],
      );
      await files.writeText('documents', path, content);
    },
  };
}

export type BackupFixture = ReturnType<typeof createBackups>;

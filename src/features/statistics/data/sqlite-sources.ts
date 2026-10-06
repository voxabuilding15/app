import type { Database } from '@/core';

import type { DueTask, NoteSource, TaskSource } from '../domain/ports';
import type { TimeSpan } from '../domain/range';

const times = (rows: readonly { at: number }[]) => rows.map((row) => row.at);

export class SqliteTaskSource implements TaskSource {
  constructor(private readonly db: Database) {}

  async completedAt({ from, to }: TimeSpan): Promise<number[]> {
    return times(
      this.db.getAllSync<{ at: number }>(
        `SELECT at FROM (
           SELECT completed_at AS at FROM tasks
           WHERE completed_at >= ? AND completed_at < ? AND archived_at IS NULL AND deleted_at IS NULL
           UNION ALL
           SELECT completed_at AS at FROM tasks
           WHERE completed_at >= ? AND completed_at < ? AND archived_at IS NOT NULL AND deleted_at IS NULL
         ) ORDER BY at`,
        [from, to, from, to],
      ),
    );
  }

  async createdAt({ from, to }: TimeSpan): Promise<number[]> {
    return times(
      this.db.getAllSync<{ at: number }>(
        `SELECT created_at AS at FROM tasks
         WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL ORDER BY created_at`,
        [from, to],
      ),
    );
  }

  async dueIn({ from, to }: TimeSpan): Promise<DueTask[]> {
    const rows = this.db.getAllSync<{ due_at: number; completed_at: number | null }>(
      `SELECT due_at, completed_at FROM tasks
       WHERE due_at >= ? AND due_at < ? AND deleted_at IS NULL AND archived_at IS NULL
       ORDER BY due_at`,
      [from, to],
    );
    return rows.map((row) => ({ dueAt: row.due_at, completed: row.completed_at !== null }));
  }
}

export class SqliteNoteSource implements NoteSource {
  constructor(private readonly db: Database) {}

  async createdAt({ from, to }: TimeSpan): Promise<number[]> {
    return times(
      this.db.getAllSync<{ at: number }>(
        `SELECT created_at AS at FROM notes
         WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL ORDER BY created_at`,
        [from, to],
      ),
    );
  }

  async updatedAt({ from, to }: TimeSpan): Promise<number[]> {
    return times(
      this.db.getAllSync<{ at: number }>(
        `SELECT updated_at AS at FROM notes
         WHERE updated_at >= ? AND updated_at < ? AND updated_at > created_at
           AND archived_at IS NULL AND deleted_at IS NULL ORDER BY updated_at`,
        [from, to],
      ),
    );
  }

  async activeCount(): Promise<number> {
    return (
      this.db.getFirstSync<{ total: number }>(
        'SELECT COUNT(*) AS total FROM notes WHERE archived_at IS NULL AND deleted_at IS NULL',
      )?.total ?? 0
    );
  }
}

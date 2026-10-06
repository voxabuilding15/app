import { getSchemaVersion } from '@/database/migrate';
import type { Database } from '@/core';

import type { DataUsage, DataUsageSource } from '../domain/usage';

export class SqliteDataUsage implements DataUsageSource {
  constructor(private readonly db: Database) {}

  private count(sql: string): number {
    return this.db.getFirstSync<{ total: number | null }>(sql)?.total ?? 0;
  }

  async read(): Promise<DataUsage> {
    const pages =
      this.db.getFirstSync<{ page_count: number }>('PRAGMA page_count')?.page_count ?? 0;
    const size = this.db.getFirstSync<{ page_size: number }>('PRAGMA page_size')?.page_size ?? 0;
    return {
      tasks: this.count('SELECT COUNT(*) AS total FROM tasks WHERE deleted_at IS NULL'),
      habits: this.count('SELECT COUNT(*) AS total FROM habits'),
      events: this.count('SELECT COUNT(*) AS total FROM events'),
      transactions: this.count('SELECT COUNT(*) AS total FROM transactions'),
      notes: this.count('SELECT COUNT(*) AS total FROM notes WHERE deleted_at IS NULL'),
      focusSessions: this.count(
        "SELECT COUNT(*) AS total FROM pomodoro_sessions WHERE kind = 'focus'",
      ),
      attachments: this.count('SELECT COUNT(*) AS total FROM note_attachments'),
      databaseBytes: pages * size,
      schemaVersion: getSchemaVersion(this.db),
    };
  }
}

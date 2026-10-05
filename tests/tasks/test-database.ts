import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Database } from '@/core';
import { runMigrations } from '@/database/migrate';

type Params = SQLInputValue[];

/** Adapts Node's built-in SQLite to the app's `Database` port so real SQL runs in tests. */
export function createTestDatabase(): Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');

  const db = {
    execSync: (sql: string) => sqlite.exec(sql),
    getAllSync: <T>(sql: string, params: Params = []) =>
      sqlite.prepare(sql).all(...params) as unknown as T[],
    getFirstSync: <T>(sql: string, params: Params = []) =>
      (sqlite.prepare(sql).get(...params) ?? null) as unknown as T | null,
    runSync: (sql: string, params: Params = []) => sqlite.prepare(sql).run(...params),
    withTransactionSync: (task: () => void) => {
      sqlite.exec('BEGIN');
      try {
        task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };

  runMigrations(db as never);
  return db as unknown as Database;
}

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Database } from '@/core';
import { runMigrations } from '@/database/migrate';
import { migrations } from '@/database/migrations';

type Params = SQLInputValue[];

function adapt(sqlite: DatabaseSync): Database {
  const db = {
    execSync: (sql: string) => sqlite.exec(sql),
    // node:sqlite rows have a null prototype; spread them into plain objects like expo-sqlite returns.
    getAllSync: <T>(sql: string, params: Params = []) =>
      sqlite
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row })) as unknown as T[],
    getFirstSync: <T>(sql: string, params: Params = []) => {
      const row = sqlite.prepare(sql).get(...params);
      return (row === undefined ? null : { ...row }) as unknown as T | null;
    },
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
  return db as unknown as Database;
}

/** Adapts Node's built-in SQLite to the app's `Database` port so real SQL runs in tests. */
export function createTestDatabase(): Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const db = adapt(sqlite);
  runMigrations(db as never);
  return db;
}

/**
 * A database frozen at schema `version`, for testing upgrades. Seed it, then call `upgrade()` to
 * apply the remaining migrations exactly as the app does on launch.
 */
export function createDatabaseAtVersion(version: number): { db: Database; upgrade: () => void } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const migration of migrations.filter((m) => m.version <= version)) {
    migration.statements.forEach((statement) => sqlite.exec(statement));
  }
  sqlite.exec(`PRAGMA user_version = ${version}`);
  const db = adapt(sqlite);
  return { db, upgrade: () => runMigrations(db as never) };
}

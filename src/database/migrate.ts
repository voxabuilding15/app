import type { SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';

interface UserVersionRow {
  user_version: number;
}

export function getSchemaVersion(db: Pick<SQLiteDatabase, 'getFirstSync'>): number {
  return db.getFirstSync<UserVersionRow>('PRAGMA user_version')?.user_version ?? 0;
}

/** Applies each pending migration atomically, bumping `user_version` in the same transaction. */
export function runMigrations(db: SQLiteDatabase): void {
  const current = getSchemaVersion(db);

  for (const migration of migrations) {
    if (migration.version <= current) {
      continue;
    }
    if (migration.rebuildsTables) {
      // SQLite ignores this pragma inside a transaction, so it must be set around it.
      db.execSync('PRAGMA foreign_keys = OFF');
    }
    try {
      db.withTransactionSync(() => {
        for (const statement of migration.statements) {
          db.execSync(statement);
        }
        if (migration.rebuildsTables) {
          const violations = db.getAllSync('PRAGMA foreign_key_check');
          if (violations.length > 0) {
            throw new Error(`Migration ${migration.name} broke ${violations.length} foreign keys`);
          }
        }
        db.execSync(`PRAGMA user_version = ${migration.version}`);
      });
    } finally {
      if (migration.rebuildsTables) {
        db.execSync('PRAGMA foreign_keys = ON');
      }
    }
  }
}

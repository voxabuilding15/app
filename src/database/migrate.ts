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
    db.withTransactionSync(() => {
      for (const statement of migration.statements) {
        db.execSync(statement);
      }
      db.execSync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';

interface UserVersionRow {
  user_version: number;
}

export function getSchemaVersion(db: SQLiteDatabase): number {
  const row = db.getFirstSync<UserVersionRow>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export function runMigrations(db: SQLiteDatabase): void {
  const current = getSchemaVersion(db);
  const pending = migrations.filter((migration) => migration.version > current);

  for (const migration of pending) {
    db.withTransactionSync(() => {
      for (const statement of migration.statements) {
        db.execSync(statement);
      }
    });
    db.execSync(`PRAGMA user_version = ${migration.version};`);
  }
}

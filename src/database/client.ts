import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME } from '@/constants/app';

import { runMigrations } from './migrate';

let instance: SQLiteDatabase | null = null;

export function getDatabase(): SQLiteDatabase {
  if (instance === null) {
    const db = openDatabaseSync(DATABASE_NAME);
    db.execSync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA temp_store = MEMORY;
    `);
    runMigrations(db);
    instance = db;
  }
  return instance;
}

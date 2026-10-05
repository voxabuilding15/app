import type { SQLiteDatabase } from 'expo-sqlite';

export type Database = Pick<
  SQLiteDatabase,
  'execSync' | 'getAllSync' | 'getFirstSync' | 'runSync' | 'withTransactionSync'
>;

import type { TableData } from './format';
import type { MergePlan } from './merge';
import type { Schema } from './schema';

export interface ApplyResult {
  inserted: number;
  updated: number;
  /** Rows that could not be stored (they clash with something on this device). */
  skipped: number;
  /** Links to missing items that were cleared, or rows removed because they depended on a skipped one. */
  repaired: number;
}

/** Raised when a restore could not be completed; nothing was changed. */
export class RestoreError extends Error {
  constructor(
    readonly reason: 'incompatible' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'RestoreError';
  }
}

/** Reads and rewrites the whole database as plain rows. */
export interface BackupStore {
  schema(): Promise<Schema>;
  schemaVersion(): number;
  readAll(): Promise<TableData>;
  /** Replaces every row with `data`, all or nothing. */
  replaceAll(data: TableData): Promise<ApplyResult>;
  /** Adds and updates rows, all or nothing; nothing is deleted. */
  merge(plan: MergePlan): Promise<ApplyResult>;
}

/** Runs after a restore, for things that live outside the database. */
export interface RestoreEffects {
  afterRestore(): Promise<void>;
}

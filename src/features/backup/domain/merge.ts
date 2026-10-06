import type { Row, TableData } from './format';
import { keyOf, project, tableNamed, type Schema, type TableInfo } from './schema';

/** What to do when the same item exists on this device and in the backup, with different content. */
export type ConflictPolicy = 'keep-local' | 'keep-backup' | 'newest';

export interface TableAnalysis {
  table: string;
  /** Only in the backup. */
  added: number;
  /** In both, and the same. */
  identical: number;
  /** In both, and different. */
  conflicts: number;
  /** Conflicts the chosen policy resolves in favour of the backup. */
  takenFromBackup: number;
}

export interface MergePlan {
  inserts: { table: string; row: Row }[];
  updates: { table: string; row: Row }[];
}

/** Tables where the larger value of a column always wins, whatever the policy. */
const MAX_COLUMN: Readonly<Record<string, string>> = { achievement_state: 'peak_xp' };

/** The column that says how recent a row is, when it has one. */
function timestampColumn(table: TableInfo): string | null {
  for (const name of ['updated_at', 'created_at']) {
    if (table.columns.some((column) => column.name === name)) {
      return name;
    }
  }
  return null;
}

/** Whether two rows hold the same values in the columns both have. */
function sameContent(table: TableInfo, local: Row, incoming: Row): boolean {
  return table.columns.every((column) => {
    const theirs = incoming[column.name];
    return theirs === undefined || theirs === local[column.name];
  });
}

function prefersBackup(
  table: TableInfo,
  policy: ConflictPolicy,
  local: Row,
  incoming: Row,
): boolean {
  const max = MAX_COLUMN[table.name];
  if (max !== undefined) {
    return Number(incoming[max] ?? 0) > Number(local[max] ?? 0);
  }
  switch (policy) {
    case 'keep-local':
      return false;
    case 'keep-backup':
      return true;
    default: {
      const column = timestampColumn(table);
      return column !== null && Number(incoming[column] ?? 0) > Number(local[column] ?? 0);
    }
  }
}

/**
 * Compares a backup with what is on the device, table by table, and works out what merging it
 * would do. Nothing is ever deleted: a merge adds what is missing and settles differences by the
 * policy.
 */
export function planMerge(
  schema: Schema,
  local: TableData,
  incoming: TableData,
  policy: ConflictPolicy,
): { analysis: TableAnalysis[]; plan: MergePlan } {
  const plan: MergePlan = { inserts: [], updates: [] };
  const analysis: TableAnalysis[] = [];

  for (const [name, rows] of Object.entries(incoming)) {
    const table = tableNamed(schema, name);
    if (table === undefined) {
      continue;
    }
    const existing = new Map((local[name] ?? []).map((row) => [keyOf(table, row), row]));
    const result: TableAnalysis = {
      table: name,
      added: 0,
      identical: 0,
      conflicts: 0,
      takenFromBackup: 0,
    };
    const seen = new Set<string>();

    for (const raw of rows) {
      const row = project(table, raw);
      const key = keyOf(table, row);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const current = existing.get(key);
      if (current === undefined) {
        result.added += 1;
        plan.inserts.push({ table: name, row });
      } else if (sameContent(table, current, row)) {
        result.identical += 1;
      } else {
        result.conflicts += 1;
        if (prefersBackup(table, policy, current, row)) {
          result.takenFromBackup += 1;
          plan.updates.push({ table: name, row });
        }
      }
    }
    analysis.push(result);
  }
  return { analysis, plan };
}

export function totals(analysis: readonly TableAnalysis[]) {
  return analysis.reduce(
    (sum, entry) => ({
      added: sum.added + entry.added,
      identical: sum.identical + entry.identical,
      conflicts: sum.conflicts + entry.conflicts,
      takenFromBackup: sum.takenFromBackup + entry.takenFromBackup,
    }),
    { added: 0, identical: 0, conflicts: 0, takenFromBackup: 0 },
  );
}

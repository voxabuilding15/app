import { getSchemaVersion } from '@/database/migrate';
import type { Database } from '@/core';

import type { Row, TableData } from '../domain/format';
import type { MergePlan } from '../domain/merge';
import { RestoreError, type ApplyResult, type BackupStore } from '../domain/ports';
import {
  primaryKeyOf,
  type ColumnInfo,
  type ForeignKeyInfo,
  type Schema,
  type TableInfo,
} from '../domain/schema';
import { currentTranslator } from '@/i18n/translate';

interface MasterRow {
  name: string;
}
interface ColumnRow {
  name: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}
interface ForeignKeyRow {
  table: string;
  from: string;
  to: string | null;
}

/** Names come only from the database's own schema, never from a backup, but are quoted anyway. */
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
const MAX_REPAIR_ROUNDS = 25;

/** Deletes children before the parents they point at, so restricted links never block a delete. */
function deletionOrder(schema: Schema): TableInfo[] {
  const remaining = [...schema];
  const ordered: TableInfo[] = [];
  while (remaining.length > 0) {
    const index = remaining.findIndex(
      (table) =>
        !remaining.some(
          (other) =>
            other.name !== table.name && other.foreignKeys.some((key) => key.parent === table.name),
        ),
    );
    // A cycle between tables (none today) is broken arbitrarily.
    ordered.push(...remaining.splice(index === -1 ? 0 : index, 1));
  }
  return ordered;
}

export class SqliteBackupStore implements BackupStore {
  constructor(private readonly db: Database) {}

  schemaVersion(): number {
    return getSchemaVersion(this.db);
  }

  async schema(): Promise<Schema> {
    const tables = this.db.getAllSync<MasterRow>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    return tables.map(({ name }): TableInfo => {
      const columns = this.db
        .getAllSync<ColumnRow>(`PRAGMA table_info(${quote(name)})`)
        .map((column): ColumnInfo => ({
          name: column.name,
          notNull: column.notnull === 1,
          hasDefault: column.dflt_value !== null,
          pk: column.pk,
        }));
      const foreignKeys = this.db
        .getAllSync<ForeignKeyRow>(`PRAGMA foreign_key_list(${quote(name)})`)
        .map((key): ForeignKeyInfo => ({
          column: key.from,
          parent: key.table,
          parentColumn: key.to ?? 'id',
        }));
      return { name, columns, foreignKeys };
    });
  }

  async readAll(): Promise<TableData> {
    const data: TableData = {};
    for (const table of await this.schema()) {
      data[table.name] = this.db.getAllSync<Row>(`SELECT * FROM ${quote(table.name)}`);
    }
    return data;
  }

  async replaceAll(data: TableData): Promise<ApplyResult> {
    const { t } = currentTranslator();
    const schema = await this.schema();
    const result: ApplyResult = { inserted: 0, updated: 0, skipped: 0, repaired: 0 };
    try {
      this.db.withTransactionSync(() => {
        // Links are checked when the transaction ends, so the order rows go in does not matter.
        this.db.runSync('PRAGMA defer_foreign_keys = ON');
        for (const table of deletionOrder(schema)) {
          this.db.runSync(`DELETE FROM ${quote(table.name)}`);
        }
        for (const table of schema) {
          for (const row of data[table.name] ?? []) {
            this.insert(table, row);
            result.inserted += 1;
          }
        }
        if (this.findOrphans(schema).length > 0) {
          throw new RestoreError(
            'invalid',
            t('The backup refers to items that it does not contain.'),
          );
        }
      });
    } catch (error) {
      if (error instanceof RestoreError) {
        throw error;
      }
      throw new RestoreError(
        'incompatible',
        error instanceof Error ? error.message : t('The backup could not be stored.'),
      );
    }
    return result;
  }

  async merge(plan: MergePlan): Promise<ApplyResult> {
    const schema = await this.schema();
    const tables = new Map(schema.map((table) => [table.name, table]));
    const result: ApplyResult = { inserted: 0, updated: 0, skipped: 0, repaired: 0 };

    this.db.withTransactionSync(() => {
      this.db.runSync('PRAGMA defer_foreign_keys = ON');
      for (const { table: name, row } of plan.inserts) {
        const table = tables.get(name);
        if (table === undefined) {
          continue;
        }
        try {
          this.insert(table, row);
          result.inserted += 1;
        } catch {
          // Clashes with something here, such as a category with the same name.
          result.skipped += 1;
        }
      }
      for (const { table: name, row } of plan.updates) {
        const table = tables.get(name);
        if (table !== undefined && this.update(table, row)) {
          result.updated += 1;
        }
      }
      result.repaired = this.repairOrphans(schema);
    });
    return result;
  }

  /** Runs a statement that may break a rule; false when it did. */
  private attempt(sql: string, params: (string | number | null)[]): boolean {
    try {
      this.db.runSync(sql, params);
      return true;
    } catch {
      return false;
    }
  }

  private insert(table: TableInfo, row: Row): void {
    const columns = Object.keys(row);
    if (columns.length === 0) {
      return;
    }
    this.db.runSync(
      `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(', ')}) VALUES (${columns
        .map(() => '?')
        .join(', ')})`,
      columns.map((column) => row[column] ?? null),
    );
  }

  /** Updates every column but the key. False when there was nothing to change. */
  private update(table: TableInfo, row: Row): boolean {
    const keys = primaryKeyOf(table);
    const columns = Object.keys(row).filter((column) => !keys.includes(column));
    if (columns.length === 0 || keys.length === 0) {
      return false;
    }
    this.db.runSync(
      `UPDATE ${quote(table.name)} SET ${columns.map((column) => `${quote(column)} = ?`).join(', ')}
       WHERE ${keys.map((key) => `${quote(key)} IS ?`).join(' AND ')}`,
      [...columns.map((column) => row[column] ?? null), ...keys.map((key) => row[key] ?? null)],
    );
    return true;
  }

  /** Rows whose link points at an item that does not exist. */
  private findOrphans(schema: Schema): { table: TableInfo; key: ForeignKeyInfo; rows: Row[] }[] {
    const found: { table: TableInfo; key: ForeignKeyInfo; rows: Row[] }[] = [];
    for (const table of schema) {
      const keyColumns = primaryKeyOf(table);
      for (const key of table.foreignKeys) {
        const rows = this.db.getAllSync<Row>(
          `SELECT ${keyColumns.map(quote).join(', ')} FROM ${quote(table.name)} AS child
           WHERE child.${quote(key.column)} IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM ${quote(key.parent)} AS parent
             WHERE parent.${quote(key.parentColumn)} = child.${quote(key.column)})`,
        );
        if (rows.length > 0) {
          found.push({ table, key, rows });
        }
      }
    }
    return found;
  }

  /**
   * Fixes links to items that were not restored: an optional link is cleared, and a row that needs
   * its parent goes away with it. Repeats, since removing a row can orphan the rows below it.
   */
  private repairOrphans(schema: Schema): number {
    let repaired = 0;
    for (let round = 0; round < MAX_REPAIR_ROUNDS; round += 1) {
      const orphans = this.findOrphans(schema);
      if (orphans.length === 0) {
        break;
      }
      for (const { table, key, rows } of orphans) {
        const keyColumns = primaryKeyOf(table);
        const optional =
          table.columns.find((column) => column.name === key.column)?.notNull === false;
        for (const row of rows) {
          const where = keyColumns.map((column) => `${quote(column)} IS ?`).join(' AND ');
          const params = keyColumns.map((column) => row[column] ?? null);
          // Clearing the link can break a rule of its own (a transfer needs its second account),
          // and then the row has to go instead.
          const cleared =
            optional &&
            this.attempt(
              `UPDATE ${quote(table.name)} SET ${quote(key.column)} = NULL WHERE ${where}`,
              params,
            );
          if (
            !cleared &&
            !this.attempt(`DELETE FROM ${quote(table.name)} WHERE ${where}`, params)
          ) {
            continue;
          }
          repaired += 1;
        }
      }
    }
    return repaired;
  }
}

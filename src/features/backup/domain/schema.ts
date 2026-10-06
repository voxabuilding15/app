import type { Cell, Row, TableData } from './format';

export interface ColumnInfo {
  name: string;
  notNull: boolean;
  hasDefault: boolean;
  /** 1-based position in the primary key, or 0. */
  pk: number;
}

export interface ForeignKeyInfo {
  column: string;
  parent: string;
  parentColumn: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export type Schema = TableInfo[];

export const tableNamed = (schema: Schema, name: string): TableInfo | undefined =>
  schema.find((table) => table.name === name);

export const primaryKeyOf = (table: TableInfo): string[] =>
  table.columns
    .filter((column) => column.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((column) => column.name);

/** A row with only the columns the table has. */
export function project(table: TableInfo, row: Row): Row {
  const out: Row = {};
  for (const column of table.columns) {
    const value = row[column.name];
    if (value !== undefined) {
      out[column.name] = value as Cell;
    }
  }
  return out;
}

export function keyOf(table: TableInfo, row: Row): string {
  return JSON.stringify(primaryKeyOf(table).map((name) => row[name] ?? null));
}

/** Rows grouped by table, keeping only tables and columns the database has. */
export function projectAll(schema: Schema, data: TableData): TableData {
  const out: TableData = {};
  for (const table of schema) {
    out[table.name] = (data[table.name] ?? []).map((row) => project(table, row));
  }
  return out;
}

import type { Database } from '@/core';

import type { CategoryTotal, FlowTotals, Transaction, TransactionRecord } from '../domain/entities';
import type { TimeRange, TransactionFilter, TransactionSort } from '../domain/filters';
import type { TransactionListContext, TransactionRepository } from '../domain/ports';
import { UNCATEGORIZED_COLOR, UNCATEGORIZED_NAME } from '../domain/stats';

import {
  toTransaction,
  toTransactionRecord,
  type TransactionRecordRow,
  type TransactionRow,
} from './mappers';
import { SELECT_TRANSACTION, buildOrderBy, buildWhere, placeholders } from './transaction-queries';

const COLUMNS = `id, type, amount_minor, account_id, to_account_id, category_id, note, occurred_at,
  recurring_id, occurrence_date, created_at, updated_at`;

export class SqliteTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Database) {}

  async list(
    filter: TransactionFilter,
    sort: TransactionSort,
    context: TransactionListContext,
  ): Promise<Transaction[]> {
    const where = buildWhere(filter, context.now);
    const rows = this.db.getAllSync<TransactionRow>(
      `${SELECT_TRANSACTION} WHERE ${where.sql} ORDER BY ${buildOrderBy(sort)} LIMIT ?`,
      [...where.params, context.limit],
    );
    return rows.map(toTransaction);
  }

  async get(id: string): Promise<TransactionRecord | null> {
    const row = this.db.getFirstSync<TransactionRecordRow>(
      `SELECT ${COLUMNS} FROM transactions WHERE id = ?`,
      [id],
    );
    return row === null ? null : toTransactionRecord(row);
  }

  async insert(record: TransactionRecord): Promise<void> {
    this.db.runSync(
      `INSERT INTO transactions (${COLUMNS}) VALUES (${placeholders(12)})`,
      this.values(record),
    );
  }

  async update(record: TransactionRecord): Promise<void> {
    this.db.runSync(
      `UPDATE transactions SET type = ?, amount_minor = ?, account_id = ?, to_account_id = ?,
         category_id = ?, note = ?, occurred_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        record.type,
        record.amountMinor,
        record.accountId,
        record.toAccountId,
        record.categoryId,
        record.note,
        record.occurredAt,
        record.updatedAt,
        record.id,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM transactions WHERE id = ?', [id]);
  }

  async flow(range: TimeRange): Promise<FlowTotals> {
    const row = this.db.getFirstSync<{ income: number; expense: number }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount_minor END), 0) AS income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor END), 0) AS expense
       FROM transactions WHERE type <> 'transfer' AND occurred_at >= ? AND occurred_at < ?`,
      [range.from, range.to],
    );
    return { incomeMinor: row?.income ?? 0, expenseMinor: row?.expense ?? 0 };
  }

  async categoryTotals(type: 'income' | 'expense', range: TimeRange): Promise<CategoryTotal[]> {
    const rows = this.db.getAllSync<{
      id: string | null;
      name: string;
      color: string;
      total: number;
    }>(
      `SELECT c.id AS id, COALESCE(c.name, ?) AS name, COALESCE(c.color, ?) AS color,
              SUM(t.amount_minor) AS total
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.type = ? AND t.occurred_at >= ? AND t.occurred_at < ?
       GROUP BY t.category_id ORDER BY total DESC, name COLLATE NOCASE`,
      [UNCATEGORIZED_NAME, UNCATEGORIZED_COLOR, type, range.from, range.to],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      totalMinor: row.total,
    }));
  }

  async expenseTotal(range: TimeRange, categoryIds: readonly string[]): Promise<number> {
    const filter =
      categoryIds.length > 0 ? `AND category_id IN (${placeholders(categoryIds.length)})` : '';
    const row = this.db.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions
       WHERE type = 'expense' AND occurred_at >= ? AND occurred_at < ? ${filter}`,
      [range.from, range.to, ...categoryIds],
    );
    return row?.total ?? 0;
  }

  private values(record: TransactionRecord) {
    return [
      record.id,
      record.type,
      record.amountMinor,
      record.accountId,
      record.toAccountId,
      record.categoryId,
      record.note,
      record.occurredAt,
      record.recurringId,
      record.occurrenceDate,
      record.createdAt,
      record.updatedAt,
    ];
  }
}

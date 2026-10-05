import type { DateKey, Database } from '@/core';

import type { RecurringRecord, RecurringTransaction, TransactionRecord } from '../domain/entities';
import type { RecurringRepository } from '../domain/ports';

import {
  SELECT_REFS,
  toRecurring,
  toRecurringRecord,
  type RecurringRecordRow,
  type RecurringRow,
} from './mappers';

const COLUMNS = `id, type, amount_minor, account_id, to_account_id, category_id, note, repeat_unit,
  repeat_interval, repeat_weekdays, start_date, end_date, next_date, paused, created_at, updated_at`;

export class SqliteRecurringRepository implements RecurringRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<RecurringTransaction[]> {
    const rows = this.db.getAllSync<RecurringRow>(
      `SELECT t.id, t.type, t.amount_minor, t.note, t.repeat_unit, t.repeat_interval,
              t.repeat_weekdays, t.start_date, t.end_date, t.next_date, t.paused, ${SELECT_REFS}
       FROM recurring_transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN accounts d ON d.id = t.to_account_id
       LEFT JOIN categories c ON c.id = t.category_id
       ORDER BY t.paused, t.next_date IS NULL, t.next_date, t.created_at, t.rowid`,
    );
    return rows.map(toRecurring);
  }

  async get(id: string): Promise<RecurringRecord | null> {
    const row = this.db.getFirstSync<RecurringRecordRow>(
      `SELECT ${COLUMNS} FROM recurring_transactions WHERE id = ?`,
      [id],
    );
    return row === null ? null : toRecurringRecord(row);
  }

  async insert(record: RecurringRecord): Promise<void> {
    this.db.runSync(
      `INSERT INTO recurring_transactions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.type,
        record.amountMinor,
        record.accountId,
        record.toAccountId,
        record.categoryId,
        record.note,
        record.rule.unit,
        record.rule.interval,
        record.rule.weekdays,
        record.startDate,
        record.endDate,
        record.nextDate,
        record.paused ? 1 : 0,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async update(record: RecurringRecord): Promise<void> {
    this.db.runSync(
      `UPDATE recurring_transactions SET type = ?, amount_minor = ?, account_id = ?, to_account_id = ?,
         category_id = ?, note = ?, repeat_unit = ?, repeat_interval = ?, repeat_weekdays = ?,
         start_date = ?, end_date = ?, next_date = ?, paused = ?, updated_at = ?
       WHERE id = ?`,
      [
        record.type,
        record.amountMinor,
        record.accountId,
        record.toAccountId,
        record.categoryId,
        record.note,
        record.rule.unit,
        record.rule.interval,
        record.rule.weekdays,
        record.startDate,
        record.endDate,
        record.nextDate,
        record.paused ? 1 : 0,
        record.updatedAt,
        record.id,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM recurring_transactions WHERE id = ?', [id]);
  }

  async listDue(today: DateKey): Promise<RecurringRecord[]> {
    const rows = this.db.getAllSync<RecurringRecordRow>(
      `SELECT ${COLUMNS} FROM recurring_transactions
       WHERE paused = 0 AND next_date IS NOT NULL AND next_date <= ?
       ORDER BY next_date, created_at, rowid`,
      [today],
    );
    return rows.map(toRecurringRecord);
  }

  async postOccurrences(
    id: string,
    transactions: readonly TransactionRecord[],
    nextDate: DateKey | null,
    updatedAt: number,
  ): Promise<void> {
    this.db.withTransactionSync(() => {
      for (const record of transactions) {
        this.db.runSync(
          `INSERT OR IGNORE INTO transactions (id, type, amount_minor, account_id, to_account_id,
             category_id, note, occurred_at, recurring_id, occurrence_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
          ],
        );
      }
      this.db.runSync(
        'UPDATE recurring_transactions SET next_date = ?, updated_at = ? WHERE id = ?',
        [nextDate, updatedAt, id],
      );
    });
  }
}

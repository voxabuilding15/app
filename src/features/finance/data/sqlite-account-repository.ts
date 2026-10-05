import type { Database } from '@/core';

import type { Account, AccountBalance } from '../domain/entities';
import type { AccountRepository } from '../domain/ports';

import { toAccount, toAccountBalance, type AccountBalanceRow, type AccountRow } from './mappers';

const SELECT_BALANCE = `
  SELECT a.id, a.name, a.type, a.color, a.initial_balance_minor, a.archived_at, a.created_at,
    a.initial_balance_minor
      + COALESCE((SELECT SUM(CASE t.type WHEN 'income' THEN t.amount_minor ELSE -t.amount_minor END)
                  FROM transactions t WHERE t.account_id = a.id), 0)
      + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.to_account_id = a.id), 0)
      AS balance_minor,
    (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id)
      + (SELECT COUNT(*) FROM transactions t WHERE t.to_account_id = a.id) AS transaction_count
  FROM accounts a`;

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: Database) {}

  async list(includeArchived: boolean): Promise<AccountBalance[]> {
    const rows = this.db.getAllSync<AccountBalanceRow>(
      `${SELECT_BALANCE} ${includeArchived ? '' : 'WHERE a.archived_at IS NULL'}
       ORDER BY a.archived_at IS NOT NULL, a.created_at, a.rowid`,
    );
    return rows.map(toAccountBalance);
  }

  async get(id: string): Promise<Account | null> {
    const row = this.db.getFirstSync<AccountRow>(
      `SELECT id, name, type, color, initial_balance_minor, archived_at, created_at
       FROM accounts WHERE id = ?`,
      [id],
    );
    return row === null ? null : toAccount(row);
  }

  async insert(account: Account): Promise<void> {
    this.db.runSync(
      `INSERT INTO accounts (id, name, type, color, initial_balance_minor, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.type,
        account.color,
        account.initialBalanceMinor,
        account.archivedAt,
        account.createdAt,
      ],
    );
  }

  async update(account: Account): Promise<void> {
    this.db.runSync(
      `UPDATE accounts SET name = ?, type = ?, color = ?, initial_balance_minor = ?, archived_at = ?
       WHERE id = ?`,
      [
        account.name,
        account.type,
        account.color,
        account.initialBalanceMinor,
        account.archivedAt,
        account.id,
      ],
    );
  }

  async setArchivedAt(id: string, archivedAt: number | null): Promise<void> {
    this.db.runSync('UPDATE accounts SET archived_at = ? WHERE id = ?', [archivedAt, id]);
  }

  async usageCount(id: string): Promise<number> {
    const row = this.db.getFirstSync<{ total: number }>(
      `SELECT (SELECT COUNT(*) FROM transactions WHERE account_id = ?)
            + (SELECT COUNT(*) FROM transactions WHERE to_account_id = ?)
            + (SELECT COUNT(*) FROM recurring_transactions WHERE account_id = ?)
            + (SELECT COUNT(*) FROM recurring_transactions WHERE to_account_id = ?) AS total`,
      [id, id, id, id],
    );
    return row?.total ?? 0;
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM accounts WHERE id = ?', [id]);
  }
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NO_CATEGORY } from '@/core';
import {
  DEFAULT_FILTER,
  DEFAULT_SORT,
  type TransactionFilter,
  type TransactionSort,
} from '@/features/finance/domain/filters';
import {
  SELECT_TRANSACTION,
  buildOrderBy,
  buildWhere,
} from '@/features/finance/data/transaction-queries';

import { createTestDatabase } from '../tasks/test-database';

const NOW = new Date(2026, 9, 15, 12).getTime();
const db = createTestDatabase();

function explain(sql: string, params: (string | number)[] = []): string {
  return db
    .getAllSync<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params)
    .map((row) => row.detail)
    .join(' | ');
}

function listPlan(
  filter: Partial<TransactionFilter>,
  sort: TransactionSort = DEFAULT_SORT,
): string {
  const where = buildWhere({ ...DEFAULT_FILTER, ...filter }, NOW);
  return explain(
    `${SELECT_TRANSACTION} WHERE ${where.sql} ORDER BY ${buildOrderBy(sort)} LIMIT ?`,
    [...where.params, 100],
  );
}

describe('finance query plans', () => {
  it('lists transactions by date through the date index, with or without a range', () => {
    assert.match(listPlan({}), /USING INDEX idx_transactions_occurred/);
    assert.match(listPlan({ range: 'month' }), /idx_transactions_occurred/);
    assert.match(
      listPlan({ range: 'week' }, { field: 'date', direction: 'asc' }),
      /idx_transactions_occurred/,
    );
  });

  it('finds an account’s transactions through the account indexes', () => {
    const detail = listPlan({ accountId: 'a' });
    assert.match(detail, /idx_transactions_account/);
    assert.match(detail, /idx_transactions_to_account/);
  });

  it('finds a category’s transactions through the category index', () => {
    assert.match(listPlan({ categoryId: 'c' }), /idx_transactions_category/);
    assert.match(
      listPlan({ categoryId: NO_CATEGORY }),
      /idx_transactions_occurred|idx_transactions_category/,
    );
  });

  it('joins accounts and categories by their primary keys, never by scanning', () => {
    const detail = listPlan({ search: 'x', types: ['income'] });
    assert.doesNotMatch(detail, /SCAN (a|d|c)\b/);
  });

  it('totals income, expenses and spending by period without scanning every transaction', () => {
    assert.match(
      explain(
        `SELECT SUM(amount_minor) FROM transactions WHERE type = 'expense' AND occurred_at >= ? AND occurred_at < ?`,
        [0, 1],
      ),
      /SEARCH transactions USING (COVERING )?INDEX idx_transactions_(type_date|occurred)/,
    );
    assert.match(
      explain(
        `SELECT SUM(amount_minor) FROM transactions WHERE type <> 'transfer' AND occurred_at >= ? AND occurred_at < ?`,
        [0, 1],
      ),
      /SEARCH transactions USING (COVERING )?INDEX idx_transactions_(type_date|occurred)/,
    );
  });

  it('computes balances by searching each account’s transactions', () => {
    const detail = explain(
      `SELECT (SELECT SUM(t.amount_minor) FROM transactions t WHERE t.account_id = a.id),
              (SELECT SUM(t.amount_minor) FROM transactions t WHERE t.to_account_id = a.id) FROM accounts a`,
    );
    assert.match(detail, /idx_transactions_account/);
    assert.match(detail, /idx_transactions_to_account/);
  });

  it('finds due recurring transactions through the partial due index', () => {
    assert.match(
      explain(
        `SELECT id FROM recurring_transactions WHERE paused = 0 AND next_date IS NOT NULL AND next_date <= ? ORDER BY next_date`,
        ['2026-10-15'],
      ),
      /idx_recurring_due/,
    );
  });

  it('looks up budget categories by budget without scanning', () => {
    assert.doesNotMatch(
      explain(`SELECT category_id FROM budget_categories WHERE budget_id = ?`, ['b']),
      /SCAN/,
    );
  });
});

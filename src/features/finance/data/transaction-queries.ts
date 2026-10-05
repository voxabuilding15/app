import { NO_CATEGORY } from '@/core';

import { presetRange, type TransactionFilter, type TransactionSort } from '../domain/filters';

import { JOIN_REFS, SELECT_REFS } from './mappers';

export const SELECT_TRANSACTION = `
  SELECT t.id, t.type, t.amount_minor, t.note, t.occurred_at, t.recurring_id, ${SELECT_REFS}
  FROM transactions t ${JOIN_REFS}`;

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** Escapes LIKE wildcards so searching for "50%" matches the text, not everything. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

interface Where {
  sql: string;
  params: (string | number)[];
}

export function buildWhere(filter: TransactionFilter, now: number): Where {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.search !== '') {
    const pattern = likePattern(filter.search);
    clauses.push(
      `(t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\'
        OR a.name LIKE ? ESCAPE '\\' OR d.name LIKE ? ESCAPE '\\')`,
    );
    params.push(pattern, pattern, pattern, pattern);
  }
  if (filter.types.length > 0) {
    clauses.push(`t.type IN (${placeholders(filter.types.length)})`);
    params.push(...filter.types);
  }
  if (filter.accountId !== null) {
    clauses.push('(t.account_id = ? OR t.to_account_id = ?)');
    params.push(filter.accountId, filter.accountId);
  }
  if (filter.categoryId === NO_CATEGORY) {
    clauses.push(`t.category_id IS NULL AND t.type <> 'transfer'`);
  } else if (filter.categoryId !== null) {
    clauses.push('t.category_id = ?');
    params.push(filter.categoryId);
  }
  const range = presetRange(filter.range, now);
  if (range !== null) {
    clauses.push('t.occurred_at >= ? AND t.occurred_at < ?');
    params.push(range.from, range.to);
  }
  return { sql: clauses.length > 0 ? clauses.join(' AND ') : '1 = 1', params };
}

export function buildOrderBy(sort: TransactionSort): string {
  const direction = sort.direction === 'asc' ? 'ASC' : 'DESC';
  return sort.field === 'amount'
    ? `t.amount_minor ${direction}, t.occurred_at DESC, t.rowid DESC`
    : `t.occurred_at ${direction}, t.created_at ${direction}, t.rowid ${direction}`;
}

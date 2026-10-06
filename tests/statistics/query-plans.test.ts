import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTestDatabase } from '../tasks/test-database';

const db = createTestDatabase();
const plan = (sql: string, params: number[]) =>
  db
    .getAllSync<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params)
    .map((row) => row.detail)
    .join(' | ');

describe('statistics query plans', () => {
  it('finds completed tasks through the two completion indexes', () => {
    const text = plan(
      `SELECT at FROM (
         SELECT completed_at AS at FROM tasks
         WHERE completed_at >= ? AND completed_at < ? AND archived_at IS NULL AND deleted_at IS NULL
         UNION ALL
         SELECT completed_at AS at FROM tasks
         WHERE completed_at >= ? AND completed_at < ? AND archived_at IS NOT NULL AND deleted_at IS NULL
       ) ORDER BY at`,
      [0, 1, 0, 1],
    );
    assert.match(text, /idx_tasks_completed_at/);
    assert.match(text, /idx_tasks_done_archived/);
  });

  it('reads due tasks through the due index and recently edited notes through the active index', () => {
    assert.match(
      plan(
        `SELECT due_at, completed_at FROM tasks
         WHERE due_at >= ? AND due_at < ? AND deleted_at IS NULL AND archived_at IS NULL ORDER BY due_at`,
        [0, 1],
      ),
      /idx_tasks_active_due/,
    );
    assert.match(
      plan(
        `SELECT updated_at AS at FROM notes
         WHERE updated_at >= ? AND updated_at < ? AND updated_at > created_at
           AND archived_at IS NULL AND deleted_at IS NULL ORDER BY updated_at`,
        [0, 1],
      ),
      /idx_notes_active/,
    );
  });

  it('sums money through the type and date index', () => {
    assert.match(
      plan(
        `SELECT SUM(amount_minor) FROM transactions WHERE type <> 'transfer' AND occurred_at >= ? AND occurred_at < ?`,
        [0, 1],
      ),
      /idx_transactions_(occurred|type_date)/,
    );
  });
});

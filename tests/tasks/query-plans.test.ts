import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildOrderBy, buildWhere, SELECT_TASK } from '@/features/tasks/data/task-queries';
import {
  DEFAULT_FILTER,
  defaultSortFor,
  type TaskFilter,
  type TaskScope,
} from '@/features/tasks/domain/filters';

import { createTestDatabase } from './test-database';

const NOW = new Date(2026, 9, 5, 12).getTime();

function plan(filter: Partial<TaskFilter>, scope: TaskScope = 'active'): string {
  const db = createTestDatabase();
  const merged = { ...DEFAULT_FILTER, scope, ...filter };
  const where = buildWhere(merged, NOW);
  const rows = db.getAllSync<{ detail: string }>(
    `EXPLAIN QUERY PLAN ${SELECT_TASK} WHERE ${where.sql} ORDER BY ${buildOrderBy(defaultSortFor(scope))} LIMIT ?`,
    [...where.params, 100],
  );
  return rows.map((row) => row.detail).join(' | ');
}

describe('query plans', () => {
  it('uses the active/due index for the default list and due filters', () => {
    assert.match(plan({}), /idx_tasks_active_due/);
    assert.match(plan({ due: 'today' }), /idx_tasks_active_due/);
    assert.match(plan({ due: 'upcoming' }), /idx_tasks_active_due/);
    assert.match(plan({ due: 'overdue' }), /idx_tasks_active_due/);
  });

  it('uses the completed and archived indexes for those scopes', () => {
    assert.match(plan({}, 'completed'), /idx_tasks_completed_at/);
    assert.match(plan({}, 'archived'), /idx_tasks_archived_at/);
  });

  it('never full-scans the labels or subtasks tables for per-task lookups', () => {
    const detail = plan({ labelIds: ['x'], search: 'a' });
    assert.doesNotMatch(detail, /SCAN (task_labels|subtasks|labels)\b/);
  });
});

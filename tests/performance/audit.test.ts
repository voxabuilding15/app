import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Database } from '@/core';
import { SqliteEventRepository } from '@/features/calendar/data/sqlite-event-repository';
import { SqliteTaskAgendaSource } from '@/features/calendar/data/task-agenda-source';
import { SqliteAccountRepository } from '@/features/finance/data/sqlite-account-repository';
import { SqliteTransactionRepository } from '@/features/finance/data/sqlite-transaction-repository';
import {
  DEFAULT_FILTER as MONEY_FILTER,
  DEFAULT_SORT as MONEY_SORT,
} from '@/features/finance/domain/filters';
import { SqliteHabitRepository } from '@/features/habits/data/sqlite-habit-repository';
import { SqliteNoteRepository } from '@/features/notes/data/sqlite-note-repository';
import {
  DEFAULT_FILTER as NOTE_FILTER,
  DEFAULT_SORT as NOTE_SORT,
} from '@/features/notes/domain/filters';
import { SqliteSessionRepository } from '@/features/pomodoro/data/sqlite-session-repository';
import { SqliteTaskRepository } from '@/features/tasks/data/sqlite-task-repository';
import { DEFAULT_FILTER as TASK_FILTER, defaultSortFor } from '@/features/tasks/domain/filters';

import { createTestDatabase } from '../tasks/test-database';

import { LARGE, populate } from './data';

const NOW = new Date(2026, 9, 15, 12).getTime();

interface Recorded {
  sql: string;
  params: (string | number | null)[];
}

/** A database that remembers every SELECT it is asked to run. */
function recording(db: Database, log: Recorded[]): Database {
  const record = (sql: string, params: unknown) => {
    if (/^\s*(SELECT|WITH)/i.test(sql) && !log.some((entry) => entry.sql === sql)) {
      log.push({ sql, params: (params ?? []) as Recorded['params'] });
    }
  };
  const all = db.getAllSync.bind(db) as (sql: string, params?: unknown) => unknown[];
  const first = db.getFirstSync.bind(db) as (sql: string, params?: unknown) => unknown;
  return {
    execSync: db.execSync,
    getAllSync: ((sql: string, params?: unknown) => {
      record(sql, params);
      return all(sql, params);
    }) as unknown as Database['getAllSync'],
    getFirstSync: ((sql: string, params?: unknown) => {
      record(sql, params);
      return first(sql, params);
    }) as unknown as Database['getFirstSync'],
    runSync: db.runSync,
    withTransactionSync: db.withTransactionSync,
  } as Database;
}

const BIG_TABLES = ['tasks', 'habit_logs', 'transactions', 'notes', 'events', 'pomodoro_sessions'];

/**
 * Full scans that are fine: they answer a question about everything (a total, a count of all
 * rows) or run over a table that is always small.
 */
const ALLOWED_SCANS: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /COUNT\(\*\)|SUM\(|MAX\(/i, reason: 'aggregate over the whole table by design' },
];

/** Describes every query that reads a large table from start to finish. */
function fullScans(db: Database, entries: readonly Recorded[]): string[] {
  const scans: string[] = [];
  for (const entry of entries) {
    const plan = db
      .getAllSync<{ detail: string }>(`EXPLAIN QUERY PLAN ${entry.sql}`, entry.params)
      .map((row) => row.detail);
    for (const line of plan) {
      const table = /^SCAN (?:TABLE )?(\w+)(?: AS \w+)?$/.exec(line.trim())?.[1];
      if (table === undefined || !BIG_TABLES.includes(table)) {
        continue;
      }
      if (!ALLOWED_SCANS.some((rule) => rule.pattern.test(entry.sql))) {
        scans.push(`${line}  <-  ${entry.sql.replace(/\s+/g, ' ').slice(0, 140)}`);
      }
    }
  }
  return scans;
}

describe('query audit on a large database', () => {
  const db = createTestDatabase();
  populate(db, LARGE, NOW);
  const log: Recorded[] = [];
  const traced = recording(db, log);

  it('has the data it is meant to', () => {
    const count = (table: string) =>
      db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
    assert.equal(count('tasks'), LARGE.tasks);
    assert.ok(count('habit_logs') > 10_000);
    assert.equal(count('transactions'), LARGE.transactions);
  });

  it('runs the queries of every feature', async () => {
    const tasks = new SqliteTaskRepository(traced);
    for (const scope of ['active', 'completed', 'archived'] as const) {
      await tasks.list({ ...TASK_FILTER, scope }, defaultSortFor(scope), { now: NOW, limit: 100 });
    }
    await tasks.list({ ...TASK_FILTER, search: 'number 12' }, defaultSortFor('active'), {
      now: NOW,
      limit: 100,
    });
    await tasks.stats(NOW);
    await new SqliteHabitRepository(traced).list('active');
    const events = new SqliteEventRepository(traced);
    await events.listInRange(NOW - 30 * 86_400_000, NOW + 30 * 86_400_000);
    await new SqliteTaskAgendaSource(traced).dueBetween(
      NOW - 30 * 86_400_000,
      NOW + 30 * 86_400_000,
    );
    const money = new SqliteTransactionRepository(traced);
    await money.list(MONEY_FILTER, MONEY_SORT, { now: NOW, limit: 100 });
    await money.flow({ from: NOW - 30 * 86_400_000, to: NOW });
    await money.categoryTotals('expense', { from: NOW - 30 * 86_400_000, to: NOW });
    await money.expenseTotal({ from: NOW - 30 * 86_400_000, to: NOW }, []);
    await new SqliteAccountRepository(traced).list(false);
    const notes = new SqliteNoteRepository(traced);
    await notes.list({ ...NOTE_FILTER, folderIds: null, withoutFolder: false }, NOTE_SORT, 100);
    await notes.list(
      { ...NOTE_FILTER, scope: 'trash', folderIds: null, withoutFolder: false },
      NOTE_SORT,
      100,
    );
    const sessions = new SqliteSessionRepository(traced);
    await sessions.list({ scope: 'focus', search: '' }, 200);
    await sessions.listFocus(NOW - 400 * 86_400_000, NOW);
    await sessions.linkTotals(NOW - 30 * 86_400_000, NOW, 5);
    assert.ok(log.length > 20, `${log.length} distinct queries recorded`);
  });

  it('never reads a large table from start to finish without a reason', () => {
    assert.deepEqual(fullScans(db, log), []);
  });

  it('would notice one if it happened', () => {
    const found = fullScans(db, [
      { sql: "SELECT id FROM tasks WHERE title = 'x'", params: [] },
      { sql: 'SELECT id FROM transactions WHERE note = ?', params: ['x'] },
      { sql: 'SELECT COUNT(*) AS n FROM tasks', params: [] },
      { sql: 'SELECT id FROM tasks WHERE id = ?', params: ['task-1'] },
    ]);
    assert.equal(found.length, 2);
    assert.match(found[0] ?? '', /SCAN tasks/);
    assert.match(found[1] ?? '', /SCAN transactions/);
  });
});

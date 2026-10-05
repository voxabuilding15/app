import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getSchemaVersion } from '@/database/migrate';
import { migrations } from '@/database/migrations';

import { createDatabaseAtVersion, createTestDatabase } from './test-database';

describe('migration v3 (habits)', () => {
  function seededV2() {
    const scenario = createDatabaseAtVersion(2);
    const { db } = scenario;
    db.runSync(`INSERT INTO categories VALUES ('c1','task','Work','#111111','folder',1)`);
    db.runSync(`INSERT INTO categories VALUES ('c2','expense','Food','#222222','folder',1)`);
    db.runSync(
      `INSERT INTO tasks (id, title, category_id, created_at, updated_at) VALUES ('t1','Keep me','c1',1,1)`,
    );
    db.runSync(
      `INSERT INTO habits (id,name,icon,color,goal_period,created_at) VALUES ('h1','Read','book','#333','daily',1)`,
    );
    db.runSync(`INSERT INTO habit_logs (habit_id,date,count) VALUES ('h1','2026-01-01',2)`);
    return scenario;
  }

  it('keeps categories, task links and habit history intact while rebuilding the table', () => {
    const { db, upgrade } = seededV2();
    upgrade();

    assert.equal(getSchemaVersion(db), migrations.at(-1)?.version);
    assert.deepEqual(
      db.getAllSync<{ id: string; kind: string }>('SELECT id, kind FROM categories ORDER BY id'),
      [
        { id: 'c1', kind: 'task' },
        { id: 'c2', kind: 'expense' },
      ],
    );
    assert.equal(
      db.getFirstSync<{ category_id: string }>(`SELECT category_id FROM tasks WHERE id='t1'`)
        ?.category_id,
      'c1',
    );
    assert.deepEqual(db.getFirstSync(`SELECT date, count, status FROM habit_logs`), {
      date: '2026-01-01',
      count: 2,
      status: 'done',
    });
    assert.equal(
      db.getFirstSync<{ weekdays: number }>(`SELECT weekdays FROM habits`)?.weekdays,
      127,
    );
  });

  it('leaves foreign key enforcement on and the task->category link working', () => {
    const { db, upgrade } = seededV2();
    upgrade();

    assert.equal(db.getFirstSync<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys, 1);
    assert.throws(() =>
      db.runSync(
        `INSERT INTO tasks (id,title,category_id,created_at,updated_at) VALUES ('x','x','missing',1,1)`,
      ),
    );
    db.runSync(`DELETE FROM categories WHERE id='c1'`);
    assert.equal(
      db.getFirstSync<{ category_id: string | null }>(`SELECT category_id FROM tasks WHERE id='t1'`)
        ?.category_id,
      null,
    );
  });

  it('accepts habit categories and keeps names unique per kind, case-insensitively', () => {
    const { db, upgrade } = seededV2();
    upgrade();
    db.runSync(`INSERT INTO categories VALUES ('h-c','habit','Work','#444','folder',1)`);
    assert.throws(() =>
      db.runSync(`INSERT INTO categories VALUES ('h-c2','habit','work','#444','folder',1)`),
    );
    assert.throws(() =>
      db.runSync(`INSERT INTO categories VALUES ('b','nonsense','x','#444','folder',1)`),
    );
  });

  it('allows only one open pause per habit and valid pause ranges', () => {
    const db = createTestDatabase();
    db.runSync(
      `INSERT INTO habits (id,name,icon,color,goal_period,created_at) VALUES ('h','Run','run','#333','daily',1)`,
    );
    db.runSync(`INSERT INTO habit_pauses (id,habit_id,start_date) VALUES ('p1','h','2026-01-01')`);
    assert.throws(() =>
      db.runSync(
        `INSERT INTO habit_pauses (id,habit_id,start_date) VALUES ('p2','h','2026-02-01')`,
      ),
    );
    db.runSync(`UPDATE habit_pauses SET end_date='2026-01-05' WHERE id='p1'`);
    db.runSync(`INSERT INTO habit_pauses (id,habit_id,start_date) VALUES ('p2','h','2026-02-01')`);
    assert.throws(() => db.runSync(`UPDATE habit_pauses SET end_date='2026-01-31' WHERE id='p2'`));
  });

  it('cascades habit deletion to logs and pauses', () => {
    const db = createTestDatabase();
    db.runSync(
      `INSERT INTO habits (id,name,icon,color,goal_period,created_at) VALUES ('h','Run','run','#333','daily',1)`,
    );
    db.runSync(`INSERT INTO habit_logs (habit_id,date) VALUES ('h','2026-01-01')`);
    db.runSync(`INSERT INTO habit_pauses (id,habit_id,start_date) VALUES ('p','h','2026-01-01')`);
    db.runSync(`DELETE FROM habits WHERE id='h'`);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM habit_logs')?.n, 0);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM habit_pauses')?.n, 0);
  });
});

describe('migration v4 (calendar)', () => {
  it('upgrades a v3 database, keeping all category links and adding event categories', () => {
    const { db, upgrade } = createDatabaseAtVersion(3);
    db.runSync(`INSERT INTO categories VALUES ('c1','task','Work','#111','folder',1)`);
    db.runSync(`INSERT INTO categories VALUES ('c2','habit','Health','#222','folder',1)`);
    db.runSync(
      `INSERT INTO tasks (id,title,category_id,created_at,updated_at) VALUES ('t','T','c1',1,1)`,
    );
    db.runSync(
      `INSERT INTO habits (id,name,icon,color,goal_period,category_id,created_at) VALUES ('h','H','i','#333','daily','c2',1)`,
    );
    upgrade();

    assert.equal(getSchemaVersion(db), 4);
    assert.equal(
      db.getFirstSync<{ category_id: string }>(`SELECT category_id FROM tasks`)?.category_id,
      'c1',
    );
    assert.equal(
      db.getFirstSync<{ category_id: string }>(`SELECT category_id FROM habits`)?.category_id,
      'c2',
    );
    assert.equal(db.getFirstSync<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys, 1);
    db.runSync(`INSERT INTO categories VALUES ('e','event','Work','#444','folder',1)`);
    assert.throws(() =>
      db.runSync(`INSERT INTO categories VALUES ('e2','event','work','#444','folder',1)`),
    );
  });

  it('validates events and cascades their exceptions', () => {
    const db = createTestDatabase();
    const insert = (end: number) =>
      db.runSync(
        `INSERT INTO events (id,title,start_at,end_at,created_at,updated_at) VALUES ('e','x',1000,?,1,1)`,
        [end],
      );
    assert.throws(() => insert(1000)); // zero length
    assert.throws(() => insert(500)); // ends before it starts
    insert(2000);
    db.runSync(`INSERT INTO event_exceptions VALUES ('e','2026-01-01')`);
    assert.throws(() => db.runSync(`INSERT INTO event_exceptions VALUES ('e','2026-01-01')`));
    assert.throws(() =>
      db.runSync(
        `INSERT INTO events (id,title,start_at,end_at,repeat_unit,created_at,updated_at) VALUES ('b','x',1,2,'hour',1,1)`,
      ),
    );
    db.runSync(`DELETE FROM events WHERE id='e'`);
    assert.equal(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM event_exceptions')?.n,
      0,
    );
  });
});

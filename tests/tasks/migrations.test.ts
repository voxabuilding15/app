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

    assert.equal(getSchemaVersion(db), migrations.at(-1)?.version);
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

describe('migration v5 (finance)', () => {
  const account = (db: ReturnType<typeof createTestDatabase>, id: string, name = id) =>
    db.runSync(
      `INSERT INTO accounts (id,name,type,color,created_at) VALUES (?,?,'bank','#111',1)`,
      [id, name],
    );
  const tx = (
    db: ReturnType<typeof createTestDatabase>,
    type: string,
    account_id: string,
    to: string | null,
    category: string | null = null,
  ) =>
    db.runSync(
      `INSERT INTO transactions (id,type,amount_minor,account_id,to_account_id,category_id,occurred_at,created_at,updated_at)
       VALUES (lower(hex(randomblob(4))),?,500,?,?,?,1,1,1)`,
      [type, account_id, to, category],
    );

  it('upgrades a v4 database and keeps categories and their links', () => {
    const { db, upgrade } = createDatabaseAtVersion(4);
    db.runSync(`INSERT INTO categories VALUES ('c1','expense','Food','#111','folder',1)`);
    upgrade();
    assert.equal(getSchemaVersion(db), migrations.at(-1)?.version);
    assert.equal(db.getAllSync('PRAGMA foreign_key_check').length, 0);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM categories')?.n, 1);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM accounts')?.n, 0);
  });

  it('moves transactions from the old schema into a default Cash account', () => {
    const { db, upgrade } = createDatabaseAtVersion(4);
    db.runSync(`INSERT INTO categories VALUES ('c1','expense','Food','#111','folder',1)`);
    db.runSync(
      `INSERT INTO transactions (id,type,amount_minor,category_id,note,occurred_at,created_at)
       VALUES ('t1','expense',1250,'c1','Lunch',5000,4000)`,
    );
    db.runSync(`INSERT INTO budgets VALUES ('2026-03', 30000)`);
    db.runSync(`INSERT INTO budgets VALUES ('2026-04', 0)`);
    upgrade();

    const moved = db.getFirstSync<Record<string, unknown>>(
      `SELECT t.type, t.amount_minor, t.note, t.category_id, t.occurred_at, t.created_at, a.name, a.type AS account_type
       FROM transactions t JOIN accounts a ON a.id = t.account_id`,
    );
    assert.deepEqual(moved, {
      type: 'expense',
      amount_minor: 1250,
      note: 'Lunch',
      category_id: 'c1',
      occurred_at: 5000,
      created_at: 4000,
      name: 'Cash',
      account_type: 'cash',
    });

    // The old per-month amounts become custom budgets; empty ones are dropped.
    const budgets = db.getAllSync<Record<string, unknown>>(
      'SELECT id, period, amount_minor, start_date, end_date FROM budgets',
    );
    assert.deepEqual(budgets, [
      {
        id: 'legacy-2026-03',
        period: 'custom',
        amount_minor: 30000,
        start_date: '2026-03-01',
        end_date: '2026-03-31',
      },
    ]);
  });

  it('validates accounts', () => {
    const db = createTestDatabase();
    account(db, 'a', 'Wallet');
    assert.throws(() => account(db, 'b', 'wallet'), 'names are unique ignoring case');
    assert.throws(() =>
      db.runSync(
        `INSERT INTO accounts (id,name,type,color,created_at) VALUES ('c','X','crypto','#111',1)`,
      ),
    );
  });

  it('validates transactions: amounts, transfers and category rules', () => {
    const db = createTestDatabase();
    account(db, 'a');
    account(db, 'b');
    db.runSync(`INSERT INTO categories VALUES ('c','expense','Food','#111','folder',1)`);

    tx(db, 'expense', 'a', null, 'c');
    tx(db, 'transfer', 'a', 'b');
    assert.throws(() => tx(db, 'transfer', 'a', null), 'a transfer needs a destination');
    assert.throws(() => tx(db, 'expense', 'a', 'b'), 'only transfers have a destination');
    assert.throws(() => tx(db, 'transfer', 'a', 'a'), 'cannot transfer to the same account');
    assert.throws(() => tx(db, 'transfer', 'a', 'b', 'c'), 'transfers have no category');
    assert.throws(() =>
      db.runSync(
        `INSERT INTO transactions (id,type,amount_minor,account_id,occurred_at,created_at,updated_at)
         VALUES ('z','expense',0,'a',1,1,1)`,
      ),
    );
    assert.throws(() => tx(db, 'expense', 'missing', null), 'the account must exist');
  });

  it('protects accounts that have transactions, and unlinks deleted categories', () => {
    const db = createTestDatabase();
    account(db, 'a');
    db.runSync(`INSERT INTO categories VALUES ('c','expense','Food','#111','folder',1)`);
    tx(db, 'expense', 'a', null, 'c');

    assert.throws(() => db.runSync(`DELETE FROM accounts WHERE id='a'`));
    db.runSync(`DELETE FROM categories WHERE id='c'`);
    assert.equal(
      db.getFirstSync<{ category_id: string | null }>('SELECT category_id FROM transactions')
        ?.category_id,
      null,
    );
  });

  it('posts a recurring occurrence only once and unlinks deleted rules', () => {
    const db = createTestDatabase();
    account(db, 'a');
    db.runSync(
      `INSERT INTO recurring_transactions (id,type,amount_minor,account_id,repeat_unit,start_date,next_date,created_at,updated_at)
       VALUES ('r','expense',900,'a','month','2026-01-31','2026-01-31',1,1)`,
    );
    const post = () =>
      db.runSync(
        `INSERT INTO transactions (id,type,amount_minor,account_id,occurred_at,recurring_id,occurrence_date,created_at,updated_at)
         VALUES (lower(hex(randomblob(4))),'expense',900,'a',1,'r','2026-01-31',1,1)`,
      );
    post();
    assert.throws(post, 'the same occurrence cannot be posted twice');

    db.runSync(`DELETE FROM recurring_transactions WHERE id='r'`);
    assert.equal(
      db.getFirstSync<{ recurring_id: string | null }>('SELECT recurring_id FROM transactions')
        ?.recurring_id,
      null,
    );
  });

  it('validates recurring rules and budgets', () => {
    const db = createTestDatabase();
    account(db, 'a');
    const rule = (unit: string, interval: number, end: string | null) =>
      db.runSync(
        `INSERT INTO recurring_transactions (id,type,amount_minor,account_id,repeat_unit,repeat_interval,start_date,end_date,created_at,updated_at)
         VALUES (lower(hex(randomblob(4))),'expense',1,'a',?,?,'2026-02-01',?,1,1)`,
        [unit, interval, end],
      );
    rule('week', 2, null);
    assert.throws(() => rule('hour', 1, null));
    assert.throws(() => rule('day', 0, null));
    assert.throws(() => rule('day', 366, null));
    assert.throws(() => rule('day', 1, '2026-01-01'));

    const budget = (id: string, period: string, start: string | null, end: string | null) =>
      db.runSync(
        `INSERT INTO budgets (id,name,period,amount_minor,start_date,end_date,created_at,updated_at)
         VALUES (?,?,?,1000,?,?,1,1)`,
        [id, id, period, start, end],
      );
    budget('m', 'monthly', null, null);
    budget('c', 'custom', '2026-01-01', '2026-01-10');
    assert.throws(() => budget('c2', 'custom', null, null), 'custom budgets need dates');
    assert.throws(() => budget('m2', 'monthly', '2026-01-01', '2026-01-02'));
    assert.throws(() => budget('c3', 'custom', '2026-02-01', '2026-01-01'));
    assert.throws(() => budget('M', 'monthly', null, null), 'budget names are unique');
  });

  it('cascades budget categories', () => {
    const db = createTestDatabase();
    db.runSync(`INSERT INTO categories VALUES ('c','expense','Food','#111','folder',1)`);
    db.runSync(
      `INSERT INTO budgets (id,name,period,amount_minor,created_at,updated_at) VALUES ('b','B','monthly',1,1,1)`,
    );
    db.runSync(`INSERT INTO budget_categories VALUES ('b','c')`);
    assert.throws(() => db.runSync(`INSERT INTO budget_categories VALUES ('b','c')`));
    db.runSync(`DELETE FROM categories WHERE id='c'`);
    assert.equal(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM budget_categories')?.n,
      0,
    );
    assert.throws(() => db.runSync(`INSERT INTO budget_categories VALUES ('b','nope')`));
  });
});

describe('migration v6 (notes)', () => {
  const run = (
    db: ReturnType<typeof createTestDatabase>,
    sql: string,
    params: (string | number | null)[] = [],
  ) => db.runSync(sql, params);
  const note = (db: ReturnType<typeof createTestDatabase>, id: string, extra = '') =>
    run(
      db,
      `INSERT INTO notes (id,title,created_at,updated_at${extra ? ',' + extra.split('=')[0] : ''}) VALUES (?,?,1,1${extra ? ',' + extra.split('=')[1] : ''})`,
      [id, id],
    );
  const folder = (
    db: ReturnType<typeof createTestDatabase>,
    id: string,
    parent: string | null,
    name = id,
  ) =>
    run(db, `INSERT INTO folders (id,parent_id,name,created_at) VALUES (?,?,?,1)`, [
      id,
      parent,
      name,
    ]);

  it('upgrades a v5 database, keeping notes, folders and flags', () => {
    const { db, upgrade } = createDatabaseAtVersion(5);
    db.runSync(`INSERT INTO folders VALUES ('f1','Work',10)`);
    db.runSync(
      `INSERT INTO notes (id,folder_id,title,body,is_checklist,pinned,favorite,created_at,updated_at)
       VALUES ('n1','f1','Plan','Write code',0,1,1,20,30)`,
    );
    db.runSync(
      `INSERT INTO notes (id,folder_id,title,body,is_checklist,created_at,updated_at)
       VALUES ('n2',NULL,'Groceries','Milk' || char(10) || 'Eggs',1,21,31)`,
    );
    db.runSync(
      `INSERT INTO notes (id,title,body,is_checklist,created_at,updated_at) VALUES ('n3','Empty','',1,22,32)`,
    );
    upgrade();

    assert.equal(getSchemaVersion(db), migrations.at(-1)?.version);
    assert.equal(db.getAllSync('PRAGMA foreign_key_check').length, 0);
    assert.deepEqual(db.getAllSync('SELECT id, parent_id, name, created_at FROM folders'), [
      { id: 'f1', parent_id: null, name: 'Work', created_at: 10 },
    ]);
    const notes = db.getAllSync<Record<string, unknown>>(
      'SELECT id, folder_id, title, body, pinned, favorite, locked, archived_at, deleted_at, created_at, updated_at FROM notes ORDER BY id',
    );
    assert.deepEqual(notes[0], {
      id: 'n1',
      folder_id: 'f1',
      title: 'Plan',
      body: 'Write code',
      pinned: 1,
      favorite: 1,
      locked: 0,
      archived_at: null,
      deleted_at: null,
      created_at: 20,
      updated_at: 30,
    });
    assert.equal(notes[1]?.body, '- [ ] Milk\n- [ ] Eggs', 'checklist notes become Markdown tasks');
    assert.equal(notes[2]?.body, '', 'an empty checklist stays empty');
    assert.equal(db.getFirstSync<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys, 1);
  });

  it('nests folders, rejects self-parenting and duplicate sibling names, and restricts deletes', () => {
    const db = createTestDatabase();
    folder(db, 'a', null, 'Work');
    folder(db, 'b', 'a', 'Plans');
    folder(db, 'c', null, 'Plans'); // same name under a different parent
    assert.throws(() => folder(db, 'd', 'a', 'plans'), 'siblings are unique ignoring case');
    assert.throws(() => folder(db, 'e', null, 'WORK'));
    assert.throws(() => folder(db, 'f', 'f', 'Loop'), 'a folder cannot be its own parent');
    assert.throws(() => folder(db, 'g', 'ghost', 'Orphan'), 'the parent must exist');
    assert.throws(
      () => run(db, `DELETE FROM folders WHERE id='a'`),
      'folders with children cannot be dropped',
    );
    run(db, `DELETE FROM folders WHERE id='b'`);
    run(db, `DELETE FROM folders WHERE id='a'`);
  });

  it('keeps notes when their folder goes, and validates flags', () => {
    const db = createTestDatabase();
    folder(db, 'a', null);
    note(db, 'n');
    run(db, `UPDATE notes SET folder_id='a' WHERE id='n'`);
    run(db, `DELETE FROM folders WHERE id='a'`);
    assert.equal(
      db.getFirstSync<{ folder_id: string | null }>('SELECT folder_id FROM notes')?.folder_id,
      null,
    );
    assert.throws(() => run(db, `UPDATE notes SET pinned=2 WHERE id='n'`));
    assert.throws(() => run(db, `UPDATE notes SET locked=-1 WHERE id='n'`));
  });

  it('tags notes with note categories and cascades both ways', () => {
    const db = createTestDatabase();
    run(db, `INSERT INTO categories VALUES ('t1','note','Idea','#111','folder',1)`);
    run(db, `INSERT INTO categories VALUES ('t2','note','Todo','#222','folder',1)`);
    note(db, 'n');
    run(db, `INSERT INTO note_tags VALUES ('n','t1')`);
    run(db, `INSERT INTO note_tags VALUES ('n','t2')`);
    assert.throws(() => run(db, `INSERT INTO note_tags VALUES ('n','t1')`));
    assert.throws(() => run(db, `INSERT INTO note_tags VALUES ('n','ghost')`));
    run(db, `DELETE FROM categories WHERE id='t1'`);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM note_tags')?.n, 1);
    run(db, `DELETE FROM notes WHERE id='n'`);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM note_tags')?.n, 0);
  });

  it('stores attachments, validating their kind, and removes them with the note', () => {
    const db = createTestDatabase();
    note(db, 'n');
    const attach = (id: string, kind: string, size = 5) =>
      run(
        db,
        `INSERT INTO note_attachments (id,note_id,kind,name,mime,path,size_bytes,created_at) VALUES (?, 'n', ?, 'x', 'm', 'p', ?, 1)`,
        [id, kind, size],
      );
    for (const kind of ['image', 'pdf', 'audio', 'drawing']) {
      attach(kind, kind);
    }
    assert.throws(() => attach('bad', 'video'));
    assert.throws(() => attach('neg', 'image', -1));
    assert.throws(() =>
      run(
        db,
        `INSERT INTO note_attachments (id,note_id,kind,name,mime,path,created_at) VALUES ('o','ghost','image','x','m','p',1)`,
      ),
    );
    assert.throws(() => run(db, `UPDATE note_attachments SET duration_ms = -5 WHERE id='audio'`));
    run(db, `DELETE FROM notes WHERE id='n'`);
    assert.equal(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM note_attachments')?.n,
      0,
    );
  });
});

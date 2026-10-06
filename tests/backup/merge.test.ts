import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { checksumOf, type Backup, type TableData } from '@/features/backup/domain/format';
import { planMerge, totals } from '@/features/backup/domain/merge';
import { project, projectAll, primaryKeyOf, keyOf } from '@/features/backup/domain/schema';

import { at, createBackups, type BackupFixture } from './setup';

let local: BackupFixture;
let other: BackupFixture;
beforeEach(() => {
  local = createBackups(at(2026, 10, 15, 18));
  other = createBackups(at(2026, 10, 15, 18));
});

async function backupOf(fixture: BackupFixture): Promise<Backup> {
  const result = fixture.backups.inspect(
    await fixture.files.readText(
      'documents',
      (await fixture.backups.create('manual', true)).file.path,
    ),
  );
  assert.ok(result.ok);
  return result.backup;
}

function altered(backup: Backup, change: (tables: TableData) => void): Backup {
  const tables = structuredClone(backup.tables);
  change(tables);
  return { ...backup, tables, checksum: checksumOf(tables) };
}

const titleOf = (fixture: BackupFixture, id: string) =>
  fixture.db.getFirstSync<{ title: string }>('SELECT title FROM tasks WHERE id = ?', [id])?.title;

/** The same task on both devices, edited differently. */
function sharedTask(localEdit: number, otherEdit: number) {
  for (const [fixture, title, edited] of [
    [local, 'Local title', localEdit],
    [other, 'Backup title', otherEdit],
  ] as const) {
    fixture.run(
      `INSERT INTO tasks (id, title, created_at, updated_at) VALUES ('shared', ?, 1000, ?)`,
      [title, edited],
    );
  }
}

describe('comparing a backup with this device', () => {
  it('counts what is new, what is the same and what differs, per table', async () => {
    local.seed.addTask('Same', { createdAt: 5 });
    sharedTask(2000, 3000);
    other.run(`INSERT INTO tasks (id, title, created_at, updated_at) VALUES ('new', 'New', 1, 1)`);
    const backup = await backupOf(other);
    // The "same" task has a different id on the other device, so it counts as new there too.
    const { tables, totals: sum } = await local.backups.analyze(backup, 'keep-local');
    const tasks = tables.find((entry) => entry.table === 'tasks');
    assert.deepEqual(
      [tasks?.added, tasks?.identical, tasks?.conflicts, tasks?.takenFromBackup],
      [1, 0, 1, 0],
    );
    assert.equal(sum.conflicts, 1);
    assert.equal(totals([]).added, 0);
  });

  it('recognises identical items even when other columns would differ in order', async () => {
    await local.seedEverything();
    const backup = await backupOf(local);
    const { totals: sum } = await local.backups.analyze(backup, 'newest');
    assert.equal(sum.added, 0);
    assert.equal(sum.conflicts, 0);
    assert.ok(sum.identical > 15);
  });
});

describe('merging with a policy', () => {
  it('keeps this device’s version with keep-local, and still adds what is missing', async () => {
    sharedTask(2000, 3000);
    other.run(`INSERT INTO tasks (id, title, created_at, updated_at) VALUES ('new', 'New', 1, 1)`);
    const result = await local.backups.restore(await backupOf(other), {
      mode: 'merge',
      policy: 'keep-local',
    });
    assert.equal(titleOf(local, 'shared'), 'Local title');
    assert.equal(titleOf(local, 'new'), 'New');
    assert.deepEqual([result.inserted, result.updated], [1, 0]);
  });

  it('takes the backup’s version with keep-backup', async () => {
    sharedTask(5000, 1500);
    const result = await local.backups.restore(await backupOf(other), {
      mode: 'merge',
      policy: 'keep-backup',
    });
    assert.equal(titleOf(local, 'shared'), 'Backup title');
    assert.equal(result.updated, 1);
  });

  it('takes whichever was edited last with newest, and prefers this device on a tie', async () => {
    sharedTask(2000, 3000);
    await local.backups.restore(await backupOf(other), { mode: 'merge', policy: 'newest' });
    assert.equal(titleOf(local, 'shared'), 'Backup title');

    local.run(`UPDATE tasks SET title = 'Local title', updated_at = 9000`);
    await local.backups.restore(await backupOf(other), { mode: 'merge', policy: 'newest' });
    assert.equal(titleOf(local, 'shared'), 'Local title');

    local.run(`UPDATE tasks SET updated_at = 3000`);
    await local.backups.restore(await backupOf(other), { mode: 'merge', policy: 'newest' });
    assert.equal(titleOf(local, 'shared'), 'Local title');
  });

  it('never deletes anything that is only on this device', async () => {
    local.seed.addTask('Mine', { createdAt: 5 });
    local.run(`INSERT INTO notes (id, title, created_at, updated_at) VALUES ('n', 'Mine', 1, 1)`);
    await local.backups.restore(await backupOf(other), { mode: 'merge', policy: 'keep-backup' });
    assert.equal(local.count('tasks'), 1);
    assert.equal(local.count('notes'), 1);
  });

  it('adds missing link rows to an item that exists on both sides, without touching its content', async () => {
    for (const fixture of [local, other]) {
      fixture.run(
        `INSERT INTO notes (id, title, created_at, updated_at) VALUES ('n', 'Same note', 1, 1)`,
      );
    }
    other.run(
      `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES ('t', 'note', 'Tag', '#111', 'x', 1)`,
    );
    other.run(`INSERT INTO note_tags (note_id, category_id) VALUES ('n', 't')`);
    await local.backups.restore(await backupOf(other), { mode: 'merge', policy: 'keep-local' });
    assert.equal(local.count('note_tags'), 1);
    assert.equal(local.count('notes'), 1);
  });

  it('is repeatable: merging the same backup twice changes nothing the second time', async () => {
    await other.seedEverything();
    const backup = await backupOf(other);
    const first = await local.backups.restore(backup, { mode: 'merge', policy: 'newest' });
    assert.ok(first.inserted > 15);
    const second = await local.backups.restore(backup, { mode: 'merge', policy: 'newest' });
    assert.deepEqual(
      [second.inserted, second.updated, second.skipped, second.repaired],
      [0, 0, 0, 0],
    );
    assert.deepEqual(await local.store.readAll(), await other.store.readAll());
  });

  it('keeps the larger XP record, whatever the policy', async () => {
    local.run('UPDATE achievement_state SET peak_xp = 500');
    other.run('UPDATE achievement_state SET peak_xp = 300');
    await local.backups.restore(await backupOf(other), { mode: 'merge', policy: 'keep-backup' });
    assert.equal(
      local.db.getFirstSync<{ peak_xp: number }>('SELECT peak_xp FROM achievement_state')?.peak_xp,
      500,
    );
    other.run('UPDATE achievement_state SET peak_xp = 900');
    await local.backups.restore(await backupOf(other), { mode: 'merge', policy: 'keep-local' });
    assert.equal(
      local.db.getFirstSync<{ peak_xp: number }>('SELECT peak_xp FROM achievement_state')?.peak_xp,
      900,
    );
  });
});

describe('items that clash with something on this device', () => {
  it('skips a category whose name is taken, and unlinks what used it instead of losing it', async () => {
    local.run(
      `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES ('mine', 'task', 'Work', '#111', 'x', 1)`,
    );
    other.run(
      `INSERT INTO categories (id, kind, name, color, icon, created_at) VALUES ('theirs', 'task', 'work', '#222', 'x', 1)`,
    );
    other.run(
      `INSERT INTO tasks (id, title, category_id, created_at, updated_at) VALUES ('t', 'Uses it', 'theirs', 1, 1)`,
    );
    const result = await local.backups.restore(await backupOf(other), {
      mode: 'merge',
      policy: 'keep-local',
    });
    assert.equal(result.skipped, 1);
    assert.equal(result.repaired, 1);
    const task = local.db.getFirstSync<{ title: string; category_id: string | null }>(
      `SELECT title, category_id FROM tasks WHERE id = 't'`,
    );
    assert.deepEqual([task?.title, task?.category_id], ['Uses it', null]);
    assert.equal(local.count('categories'), 1);
  });

  it('drops rows that cannot exist without a skipped parent, such as a transaction without its account', async () => {
    local.run(
      `INSERT INTO accounts (id, name, type, color, initial_balance_minor, created_at) VALUES ('a1', 'Cash', 'cash', '#111', 0, 1)`,
    );
    other.run(
      `INSERT INTO accounts (id, name, type, color, initial_balance_minor, created_at) VALUES ('a2', 'cash', 'cash', '#222', 0, 1)`,
    );
    other.run(
      `INSERT INTO transactions (id, type, amount_minor, account_id, occurred_at, created_at, updated_at) VALUES ('x', 'expense', 100, 'a2', 5, 5, 5)`,
    );
    const result = await local.backups.restore(await backupOf(other), {
      mode: 'merge',
      policy: 'keep-local',
    });
    assert.equal(result.skipped, 1);
    assert.equal(result.repaired, 1);
    assert.equal(local.count('transactions'), 0);
    assert.equal(local.count('accounts'), 1);
  });

  it('moves a folder whose parent was dropped to the top level, keeping its notes', async () => {
    local.run(
      `INSERT INTO folders (id, name, parent_id, created_at) VALUES ('f1', 'Ideas', NULL, 1)`,
    );
    other.run(
      `INSERT INTO folders (id, name, parent_id, created_at) VALUES ('f2', 'ideas', NULL, 1)`,
    );
    other.run(
      `INSERT INTO folders (id, name, parent_id, created_at) VALUES ('f3', 'Child', 'f2', 1)`,
    );
    other.run(
      `INSERT INTO notes (id, folder_id, title, created_at, updated_at) VALUES ('n', 'f3', 'In child', 1, 1)`,
    );
    const result = await local.backups.restore(await backupOf(other), {
      mode: 'merge',
      policy: 'keep-local',
    });
    assert.equal(result.skipped, 1);
    assert.equal(result.repaired, 1);
    assert.equal(local.count('folders'), 2);
    assert.equal(
      local.db.getFirstSync<{ parent_id: string | null }>(
        `SELECT parent_id FROM folders WHERE id = 'f3'`,
      )?.parent_id,
      null,
    );
    assert.equal(
      local.db.getFirstSync<{ folder_id: string }>(`SELECT folder_id FROM notes WHERE id = 'n'`)
        ?.folder_id,
      'f3',
    );
  });

  it('removes rows level by level when each needs the one above it', async () => {
    local.run(
      `INSERT INTO accounts (id, name, type, color, initial_balance_minor, created_at) VALUES ('a1', 'Cash', 'cash', '#111', 0, 1)`,
    );
    other.run(
      `INSERT INTO accounts (id, name, type, color, initial_balance_minor, created_at) VALUES ('a2', 'cash', 'cash', '#222', 0, 1)`,
    );
    other.run(
      `INSERT INTO accounts (id, name, type, color, initial_balance_minor, created_at) VALUES ('a3', 'Bank', 'bank', '#222', 0, 1)`,
    );
    other.run(
      `INSERT INTO transactions (id, type, amount_minor, account_id, to_account_id, occurred_at, created_at, updated_at) VALUES ('t', 'transfer', 100, 'a3', 'a2', 5, 5, 5)`,
    );
    const result = await local.backups.restore(await backupOf(other), {
      mode: 'merge',
      policy: 'keep-local',
    });
    assert.equal(local.count('transactions'), 0);
    assert.equal(local.count('accounts'), 2);
    assert.ok(result.repaired >= 1);
  });
});

describe('merging settings and files', () => {
  it('fills in missing settings and leaves existing ones, unless the backup is preferred', async () => {
    other.storage.setString('finance.currency', 'EUR');
    other.storage.setString('pomodoro.settings', '{"focusMinutes":50}');
    local.storage.setString('finance.currency', 'GBP');
    const backup = await backupOf(other);
    await local.backups.restore(backup, { mode: 'merge', policy: 'keep-local' });
    assert.equal(local.storage.getString('finance.currency'), 'GBP');
    assert.equal(local.storage.getString('pomodoro.settings'), '{"focusMinutes":50}');
    await local.backups.restore(backup, { mode: 'merge', policy: 'keep-backup' });
    assert.equal(local.storage.getString('finance.currency'), 'EUR');
  });

  it('only writes attachment files that are missing, unless the backup is preferred', async () => {
    other.run(`INSERT INTO notes (id, title, created_at, updated_at) VALUES ('n', 'N', 1, 1)`);
    await other.addAttachment('n', 'notes/n/a.png', 'FROM BACKUP');
    await local.files.writeText('documents', 'notes/n/a.png', 'LOCAL');
    const backup = await backupOf(other);
    const first = await local.backups.restore(backup, { mode: 'merge', policy: 'keep-local' });
    assert.equal(await local.files.readText('documents', 'notes/n/a.png'), 'LOCAL');
    assert.equal(first.filesRestored, 0);
    const second = await local.backups.restore(backup, { mode: 'merge', policy: 'keep-backup' });
    assert.equal(await local.files.readText('documents', 'notes/n/a.png'), 'FROM BACKUP');
    assert.equal(second.filesRestored, 1);
  });
});

describe('table helpers', () => {
  it('keeps only known columns and builds keys from the primary key', async () => {
    const schema = await local.store.schema();
    const logs = schema.find((table) => table.name === 'habit_logs')!;
    assert.deepEqual(primaryKeyOf(logs), ['habit_id', 'date']);
    assert.deepEqual(
      project(logs, { habit_id: 'h', date: 'd', count: 1, status: 'done', extra: 'x' }),
      {
        habit_id: 'h',
        date: 'd',
        count: 1,
        status: 'done',
      },
    );
    assert.equal(keyOf(logs, { habit_id: 'h', date: 'd' }), '["h","d"]');
    const all = projectAll(schema, { tasks: [{ id: 't', nope: 1 }], unknown_table: [{ id: 'x' }] });
    assert.deepEqual(all.tasks, [{ id: 't' }]);
    assert.equal(all.unknown_table, undefined);
    assert.equal(all.notes?.length, 0);
  });

  it('ignores tables the app does not have and duplicate keys in a backup', async () => {
    const schema = await local.store.schema();
    const { analysis, plan } = planMerge(
      schema,
      {},
      {
        nowhere: [{ id: 'x' }],
        tasks: [
          { id: 'a', title: 'A', created_at: 1, updated_at: 1 },
          { id: 'a', title: 'B', created_at: 1, updated_at: 1 },
        ],
      },
      'keep-local',
    );
    assert.equal(analysis.length, 1);
    assert.equal(plan.inserts.length, 1);
  });

  it('merges a backup edited to be harmless-looking but with unknown columns', async () => {
    const backup = altered(await backupOf(other), (tables) => {
      tables.tasks = [
        { id: 'z', title: 'Z', created_at: 1, updated_at: 1, 'evil"; DROP TABLE tasks; --': 'x' },
      ];
    });
    const result = await local.backups.restore(backup, { mode: 'merge', policy: 'keep-local' });
    assert.equal(result.inserted, 1);
    assert.equal(local.count('tasks'), 1);
  });
});

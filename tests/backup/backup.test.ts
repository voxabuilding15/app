import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  BACKUP_VERSION,
  checksumOf,
  isSafePath,
  parseBackup,
  serializeBackup,
  type Backup,
  type TableData,
} from '@/features/backup/domain/format';
import { backupPath, kindOfName } from '@/features/backup/domain/names';
import { RestoreError } from '@/features/backup/domain/ports';
import type { RestoreOptions } from '@/features/backup/domain/usecases';

import { at, createBackups, type BackupFixture } from './setup';

let a: BackupFixture;
beforeEach(() => {
  a = createBackups();
});

const REPLACE: RestoreOptions = { mode: 'replace', policy: 'keep-local' };

/** Reads a backup file back as an object. */
async function stored(fixture: BackupFixture, path: string): Promise<Backup> {
  const result = fixture.backups.inspect(await fixture.files.readText('documents', path));
  assert.ok(result.ok, 'the backup reads back');
  return result.backup;
}

/** A copy of a backup with its tables changed and the checksum made to match. */
function altered(backup: Backup, change: (tables: TableData) => void): Backup {
  const tables = structuredClone(backup.tables);
  change(tables);
  return { ...backup, tables, checksum: checksumOf(tables) };
}

async function everything(fixture: BackupFixture): Promise<TableData> {
  return fixture.store.readAll();
}

describe('the database schema', () => {
  it('lists every table, with keys and links, so nothing can be forgotten in a backup', async () => {
    const schema = await a.store.schema();
    const names = a.db
      .getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .map((row) => row.name)
      .sort();
    assert.deepEqual(schema.map((table) => table.name).sort(), names);
    assert.ok(names.length >= 20, `${names.length} tables`);
    const notes = schema.find((table) => table.name === 'notes');
    assert.ok(notes?.foreignKeys.some((key) => key.parent === 'folders'));
    assert.ok(
      schema
        .find((table) => table.name === 'habit_logs')
        ?.columns.some((column) => column.pk === 1),
    );
    assert.equal(a.store.schemaVersion() >= 9, true);
  });
});

describe('creating a backup', () => {
  it('writes every table, the settings that belong to it and a checksum, under the backups folder', async () => {
    await a.seedEverything();
    a.storage.setString('finance.currency', 'EUR');
    a.storage.setString('notes.lock', '{"method":"pin"}');
    const made = await a.backups.create('manual', true);
    assert.equal(made.file.path, backupPath(a.state.now, 'manual'));
    assert.match(made.file.path, /^backups\/focusflow-20261015-180000-manual\.json$/);

    const backup = await stored(a, made.file.path);
    assert.equal(backup.format, 'focusflow-backup');
    assert.equal(backup.version, BACKUP_VERSION);
    assert.equal(backup.schemaVersion, a.store.schemaVersion());
    assert.equal(backup.createdAt, a.state.now);
    assert.equal(backup.tables.tasks?.length, 1);
    assert.equal(backup.tables.habit_logs?.length, 2);
    assert.equal(backup.tables.transactions?.length, 2);
    assert.equal(backup.tables.pomodoro_sessions?.length, 1);
    assert.equal(backup.tables.achievement_unlocks?.length, 1);
    assert.deepEqual(backup.preferences, { 'finance.currency': 'EUR' });
    assert.equal(backup.checksum, checksumOf(backup.tables));
  });

  it('describes what is inside without changing anything', async () => {
    await a.seedEverything();
    const { file } = await a.backups.create('manual', false);
    const result = a.backups.inspect(await a.files.readText('documents', file.path));
    assert.ok(result.ok);
    assert.equal(result.summary.appVersion, '1.0.0');
    assert.ok(result.summary.rows > 15);
    assert.deepEqual(
      result.summary.tables.find((entry) => entry.table === 'notes'),
      { table: 'notes', rows: 1 },
    );
    assert.ok(result.summary.tables.every((entry) => entry.rows > 0));
  });

  it('includes attachment files, and leaves out files that are too large or missing', async () => {
    const { note } = await a.seedEverything();
    await a.addAttachment(note, 'notes/n1/photo.png', 'PIXELS');
    await a.addAttachment(note, 'notes/n1/big.png', 'x'.repeat(10 * 1024 * 1024 + 10));
    a.run(
      `INSERT INTO note_attachments (id, note_id, kind, name, mime, path, size_bytes, created_at)
       VALUES ('ghost', ?, 'pdf', 'ghost.pdf', 'application/pdf', 'notes/n1/ghost.pdf', 0, 1)`,
      [note],
    );
    const backup = await stored(a, (await a.backups.create('manual', true)).file.path);
    assert.deepEqual(
      backup.files.map((file) => file.path),
      ['notes/n1/photo.png'],
    );
    assert.equal(Buffer.from(backup.files[0]!.base64, 'base64').toString(), 'PIXELS');
    assert.equal(backup.skippedFiles, 2);
    // Rows without their file would come back as broken attachments, so they are not saved.
    assert.deepEqual(
      backup.tables.note_attachments?.map((row) => row.path),
      ['notes/n1/photo.png'],
    );
  });

  it('can leave attachments out altogether', async () => {
    const { note } = await a.seedEverything();
    await a.addAttachment(note, 'notes/n1/photo.png', 'PIXELS');
    const backup = await stored(a, (await a.backups.create('manual', false)).file.path);
    assert.deepEqual(
      [backup.files.length, backup.tables.note_attachments?.length, backup.skippedFiles],
      [0, 0, 1],
    );
  });

  it('exports and shares, and says when nothing can take the file', async () => {
    const result = await a.backups.exportAndShare(false, 'Share backup');
    assert.equal(result.shared, true);
    assert.equal(a.files.shared[0]?.mimeType, 'application/json');
    a.files.canShare = false;
    assert.equal((await a.backups.exportAndShare(false, 'x')).shared, false);
  });

  it('names and sorts stored backups by when they were made', async () => {
    await a.backups.create('manual', false);
    a.state.now += 60_000;
    await a.backups.create('auto', false);
    const listed = await a.backups.list();
    assert.deepEqual(
      listed.map((entry) => entry.kind),
      ['auto', 'manual'],
    );
    await a.backups.remove(listed[0]!.file.path);
    assert.equal((await a.backups.list()).length, 1);
    assert.equal(kindOfName('focusflow-20260101-000000-safety.json'), 'safety');
    assert.equal(kindOfName('mine.json'), 'manual');
  });
});

describe('reading a backup', () => {
  let cached: string | null = null;
  beforeEach(() => {
    cached = null;
  });
  const text = async () => {
    if (cached === null) {
      await a.seedEverything();
      cached = serializeBackup(
        await stored(a, (await a.backups.create('manual', false)).file.path),
      );
    }
    return cached;
  };
  const reason = (value: string) => {
    const result = a.backups.inspect(value);
    return result.ok ? 'ok' : result.reason;
  };

  it('refuses what is not a backup', async () => {
    assert.equal(reason('{nope'), 'not-json');
    assert.equal(reason('[]'), 'not-backup');
    assert.equal(reason('{"format":"other"}'), 'not-backup');
    assert.equal(
      reason(JSON.stringify({ format: 'focusflow-backup', version: 'x', schemaVersion: 1 })),
      'not-backup',
    );
  });

  it('refuses backups from a newer app', async () => {
    const original = JSON.parse(await text());
    assert.equal(reason(JSON.stringify({ ...original, version: BACKUP_VERSION + 1 })), 'too-new');
    assert.equal(
      reason(JSON.stringify({ ...original, schemaVersion: a.store.schemaVersion() + 1 })),
      'too-new',
    );
  });

  it('notices damage: edited rows, wrong shapes and unsafe file paths', async () => {
    const original = JSON.parse(await text());
    const edited = structuredClone(original);
    edited.tables.tasks[0].title = 'Hacked';
    assert.equal(reason(JSON.stringify(edited)), 'corrupt');
    assert.equal(reason(JSON.stringify({ ...original, tables: { tasks: 'x' } })), 'corrupt');
    assert.equal(
      reason(JSON.stringify({ ...original, tables: { tasks: [{ a: { b: 1 } }] } })),
      'corrupt',
    );
    assert.equal(reason(JSON.stringify({ ...original, preferences: { a: 1 } })), 'corrupt');
    assert.equal(
      reason(JSON.stringify({ ...original, files: [{ path: '../../etc/passwd', base64: '' }] })),
      'corrupt',
    );
    assert.equal(reason(JSON.stringify({ ...original, files: 'x' })), 'corrupt');
    assert.equal(reason(JSON.stringify({ ...original, checksum: 'abc' })), 'corrupt');
    const truncated = (await text()).slice(0, 500);
    assert.equal(reason(truncated), 'not-json');
  });

  it('accepts only safe file paths', () => {
    for (const path of ['notes/a/b.png', 'notes/My File (1).pdf']) {
      assert.equal(isSafePath(path), true, path);
    }
    for (const path of ['', '/abs', '../x', 'a/../b', 'a\\b', 'a//b', './a', 'a/./b', 'bad|name']) {
      assert.equal(isSafePath(path), false, path);
    }
  });

  it('tolerates an unknown newer-looking app name and missing optional counts', async () => {
    const original = JSON.parse(await text());
    delete original.skippedFiles;
    const result = parseBackup(JSON.stringify(original), a.store.schemaVersion());
    assert.ok(result.ok);
    assert.equal(result.backup.skippedFiles, 0);
  });
});

describe('restoring over everything', () => {
  it('brings back exactly what was backed up, in an empty app', async () => {
    await a.seedEverything();
    const { file } = await a.backups.create('manual', true);
    const text = await a.files.readText('documents', file.path);

    const fresh = createBackups(a.state.now);
    const inspected = fresh.backups.inspect(text);
    assert.ok(inspected.ok);
    const result = await fresh.backups.restore(inspected.backup, REPLACE);
    assert.equal(result.mode, 'replace');
    assert.ok(result.inserted > 15);
    assert.deepEqual(await everything(fresh), await everything(a));
  });

  it('replaces what was there, leaving no trace of it', async () => {
    await a.seedEverything();
    const { file } = await a.backups.create('manual', false);
    const backup = await stored(a, file.path);

    a.seed.addTask('Added later', { createdAt: at(2026, 10, 15) });
    a.run('DELETE FROM notes');
    a.run(`UPDATE categories SET name = 'Renamed' WHERE kind = 'task'`);
    const result = await a.backups.restore(backup, REPLACE);
    assert.equal(a.count('tasks'), 1);
    assert.equal(a.count('notes'), 1);
    assert.equal(
      a.db.getFirstSync<{ name: string }>(`SELECT name FROM categories WHERE kind = 'task'`)?.name,
      'Work',
    );
    assert.equal(result.skipped + result.repaired, 0);
  });

  it('copies the current data aside first, keeps only the last few copies, and tidies up after itself', async () => {
    await a.seedEverything();
    const backup = await stored(a, (await a.backups.create('manual', false)).file.path);
    a.storage.setString('pomodoro.timer', '{"status":"running"}');
    a.storage.setString('pomodoro.alerts', '["x"]');
    a.seed.addTask('Only here', { createdAt: at(2026, 10, 15) });

    const result = await a.backups.restore(backup, REPLACE);
    const copy = await stored(a, result.safetyCopy.path);
    assert.equal(copy.tables.tasks?.length, 2);
    assert.match(result.safetyCopy.path, /-safety\.json$/);
    assert.equal(a.storage.getString('pomodoro.timer'), undefined);
    assert.equal(a.storage.getString('pomodoro.alerts'), undefined);
    assert.equal(a.cancelled.count, 1);

    for (let index = 0; index < 5; index += 1) {
      a.state.now += 1000;
      await a.backups.restore(backup, REPLACE);
    }
    assert.equal((await a.backups.list()).filter((entry) => entry.kind === 'safety').length, 3);
  });

  it('restores attachment files, and removes the files of notes that are gone', async () => {
    const { note } = await a.seedEverything();
    await a.addAttachment(note, 'notes/n1/keep.png', 'KEEP');
    const backup = await stored(a, (await a.backups.create('manual', true)).file.path);

    await a.files.remove('documents', 'notes/n1/keep.png');
    a.run('DELETE FROM note_attachments');
    await a.files.writeText('documents', 'notes/other/old.png', 'OLD');
    a.run(
      `INSERT INTO note_attachments (id, note_id, kind, name, mime, path, size_bytes, created_at)
       VALUES ('old', ?, 'image', 'old.png', 'image/png', 'notes/other/old.png', 3, 1)`,
      [note],
    );

    const result = await a.backups.restore(backup, REPLACE);
    assert.equal(result.filesRestored, 1);
    assert.equal(await a.files.readText('documents', 'notes/n1/keep.png'), 'KEEP');
    assert.equal(await a.files.exists('documents', 'notes/other/old.png'), false);
    assert.deepEqual(
      a.db.getAllSync<{ path: string }>('SELECT path FROM note_attachments').map((row) => row.path),
      ['notes/n1/keep.png'],
    );
  });

  it('puts the settings back', async () => {
    a.storage.setString('finance.currency', 'EUR');
    a.storage.setString('pomodoro.settings', '{"focusMinutes":50}');
    const backup = await stored(a, (await a.backups.create('manual', false)).file.path);
    a.storage.setString('finance.currency', 'GBP');
    a.storage.remove('pomodoro.settings');
    a.storage.setString('notes.lock', 'local-secret');
    await a.backups.restore(
      {
        ...backup,
        preferences: { ...backup.preferences, 'notes.lock': 'from-file', stranger: 'x' },
      },
      REPLACE,
    );
    assert.equal(a.storage.getString('finance.currency'), 'EUR');
    assert.equal(a.storage.getString('pomodoro.settings'), '{"focusMinutes":50}');
    assert.equal(a.storage.getString('notes.lock'), 'local-secret');
    assert.equal(a.storage.getString('stranger'), undefined);
  });

  it('restores a backup made by an older version, filling in what it lacked', async () => {
    await a.seedEverything();
    const backup = await stored(a, (await a.backups.create('manual', false)).file.path);
    const old = altered(backup, (tables) => {
      for (const row of tables.tasks ?? []) {
        delete row.deleted_at;
        delete row.repeat_unit;
      }
      delete tables.achievement_unlocks;
      tables.dropped_long_ago = [{ id: 'x' }];
    });
    const fresh = createBackups(a.state.now);
    const result = await fresh.backups.restore({ ...old, schemaVersion: 5 }, REPLACE);
    assert.equal(fresh.count('tasks'), 1);
    assert.equal(fresh.count('achievement_unlocks'), 0);
    assert.equal(
      fresh.db.getFirstSync<{ deleted_at: number | null }>('SELECT deleted_at FROM tasks')
        ?.deleted_at,
      null,
    );
    assert.ok(result.inserted > 0);
  });
});

describe('a restore that cannot finish', () => {
  async function failing(change: (tables: TableData) => void) {
    await a.seedEverything();
    const backup = await stored(a, (await a.backups.create('manual', false)).file.path);
    const before = await everything(a);
    return { bad: altered(backup, change), before };
  }

  it('changes nothing when a row points at something the backup does not contain', async () => {
    const { bad, before } = await failing((tables) => {
      tables.note_tags?.push({ note_id: 'missing', category_id: 'missing' });
    });
    await assert.rejects(a.backups.restore(bad, REPLACE), (error) => {
      assert.ok(error instanceof RestoreError);
      assert.equal(error.reason, 'invalid');
      return true;
    });
    assert.deepEqual(await everything(a), before);
  });

  it('changes nothing when a row breaks a rule of the database', async () => {
    const { bad, before } = await failing((tables) => {
      tables.tasks![0]!.priority = 99;
    });
    await assert.rejects(a.backups.restore(bad, REPLACE), (error) => {
      assert.ok(error instanceof RestoreError);
      assert.equal(error.reason, 'incompatible');
      return true;
    });
    assert.deepEqual(await everything(a), before);
  });

  it('keeps the safety copy so the person can still get back', async () => {
    const { bad } = await failing((tables) => {
      tables.tasks![0]!.priority = 99;
    });
    await assert.rejects(a.backups.restore(bad, REPLACE));
    assert.equal((await a.backups.list()).filter((entry) => entry.kind === 'safety').length, 1);
  });
});

describe('automatic backups', () => {
  const HOUR = 3_600_000;

  it('is on, weekly and without attachments until changed', () => {
    assert.deepEqual(a.backups.autoSettings(), {
      enabled: true,
      frequency: 'weekly',
      keep: 5,
      includeFiles: false,
    });
  });

  it('makes a backup the first time and then waits for the interval', async () => {
    const first = await a.backups.runAutoBackupIfDue();
    assert.equal(first?.kind, 'auto');
    assert.equal(a.backups.lastAutoBackupAt(), a.state.now);

    a.state.now += 6 * 24 * HOUR;
    assert.equal(await a.backups.runAutoBackupIfDue(), null);
    a.state.now += 24 * HOUR;
    assert.notEqual(await a.backups.runAutoBackupIfDue(), null);
    assert.equal((await a.backups.list()).length, 2);
  });

  it('can run daily, and can be turned off', async () => {
    a.backups.saveAutoSettings({ enabled: true, frequency: 'daily', keep: 5, includeFiles: false });
    await a.backups.runAutoBackupIfDue();
    a.state.now += 23 * HOUR;
    assert.equal(await a.backups.runAutoBackupIfDue(), null);
    a.state.now += 2 * HOUR;
    assert.notEqual(await a.backups.runAutoBackupIfDue(), null);

    a.backups.saveAutoSettings({ ...a.backups.autoSettings(), enabled: false });
    a.state.now += 100 * HOUR;
    assert.equal(await a.backups.runAutoBackupIfDue(), null);
  });

  it('keeps the newest few and never deletes backups made by hand', async () => {
    a.backups.saveAutoSettings({ enabled: true, frequency: 'daily', keep: 2, includeFiles: false });
    await a.backups.create('manual', false);
    for (let day = 0; day < 5; day += 1) {
      a.state.now += 25 * HOUR;
      await a.backups.runAutoBackupIfDue();
    }
    const kinds = (await a.backups.list()).map((entry) => entry.kind).sort();
    assert.deepEqual(kinds, ['auto', 'auto', 'manual']);
  });

  it('can include attachments when asked', async () => {
    const { note } = await a.seedEverything();
    await a.addAttachment(note, 'notes/n1/a.png', 'A');
    a.backups.saveAutoSettings({ enabled: true, frequency: 'daily', keep: 3, includeFiles: true });
    const made = await a.backups.runAutoBackupIfDue();
    assert.equal((await stored(a, made!.file.path)).files.length, 1);
  });

  it('copes with damaged or out-of-range settings', () => {
    a.storage.setString('backup.settings', '{broken');
    assert.equal(a.backups.autoSettings().keep, 5);
    a.storage.setString(
      'backup.settings',
      JSON.stringify({ enabled: 'yes', frequency: 'hourly', keep: 99, includeFiles: 1 }),
    );
    assert.deepEqual(a.backups.autoSettings(), {
      enabled: true,
      frequency: 'weekly',
      keep: 5,
      includeFiles: false,
    });
    a.backups.saveAutoSettings({ enabled: false, frequency: 'daily', keep: 0, includeFiles: true });
    assert.deepEqual(a.backups.autoSettings(), {
      enabled: false,
      frequency: 'daily',
      keep: 5,
      includeFiles: true,
    });
  });
});

describe('file names', () => {
  it('uses local time and keeps names sortable', () => {
    assert.equal(
      backupPath(at(2026, 1, 2, 3, 4), 'auto'),
      'backups/focusflow-20260102-030400-auto.json',
    );
    assert.ok(backupPath(at(2026, 10, 1), 'manual') < backupPath(at(2026, 10, 2), 'manual'));
  });
});

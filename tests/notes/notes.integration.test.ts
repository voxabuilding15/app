import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  DEFAULT_FILTER,
  DEFAULT_SORT,
  NO_FOLDER,
  type NoteFilter,
  type NoteSort,
} from '@/features/notes/domain/filters';

import { at, createNotes, draft, mustSave, type Notes } from './setup';

let n: Notes;
beforeEach(() => {
  n = createNotes(at(2026, 10, 15));
});

const list = (filter: Partial<NoteFilter> = {}, sort: NoteSort = DEFAULT_SORT, limit = 100) =>
  n.notes.list({ ...DEFAULT_FILTER, ...filter }, sort, limit);
const titles = async (filter: Partial<NoteFilter> = {}, sort?: NoteSort) =>
  (await list(filter, sort)).map((note) => note.title);

async function add(title: string, overrides: Parameters<typeof draft>[0] = {}, minutesLater = 0) {
  n.state.now += minutesLater * 60_000;
  const saved = await mustSave(
    n.notes.save(draft({ title, body: `${title} body`, ...overrides }), null),
  );
  return saved.id;
}

describe('creating and editing', () => {
  it('stores a note with a trimmed title and a normalised body', async () => {
    const id = await add('  Plan  ', { body: '- [X] done\r\n- [ ] todo' });
    const note = await n.notes.get(id);
    assert.equal(note?.title, 'Plan');
    assert.equal(note?.body, '- [x] done\n- [ ] todo');
    assert.equal(note?.createdAt, n.state.now);
    assert.deepEqual(
      [note?.pinned, note?.favorite, note?.locked, note?.color],
      [false, false, false, null],
    );
  });

  it('keeps the creation time and bumps the edit time when edited', async () => {
    const id = await add('One');
    const created = n.state.now;
    n.state.now += 60_000;
    await mustSave(n.notes.save(draft({ title: 'One edited', body: 'new' }), id));
    const note = await n.notes.get(id);
    assert.deepEqual(
      [note?.title, note?.createdAt, note?.updatedAt],
      ['One edited', created, created + 60_000],
    );
    await assert.rejects(n.notes.save(draft(), 'ghost'));
  });

  it('explains what is wrong without saving', async () => {
    const attempt = (overrides: Parameters<typeof draft>[0]) =>
      n.notes.save(draft(overrides), null);
    assert.deepEqual(await attempt({ title: ' ', body: '  ' }), {
      ok: false,
      errors: { content: 'Add a title or some text' },
    });
    assert.equal((await attempt({ title: 'x'.repeat(201) })).ok, false);
    assert.equal((await attempt({ body: 'x'.repeat(100_001) })).ok, false);
    assert.equal((await attempt({ color: 'red' })).ok, false);
    assert.equal((await attempt({ color: '#12345' })).ok, false);
    assert.equal((await attempt({ folderId: 'ghost' })).ok, false);
    assert.deepEqual(await attempt({ reminderAt: n.state.now - 1 }), {
      ok: false,
      errors: { reminder: 'Choose a time in the future' },
    });
    assert.equal((await attempt({ reminderAt: Number.NaN })).ok, false);
    assert.equal((await list()).length, 0);
    assert.ok((await attempt({ title: '', body: 'only a body' })).ok);
    assert.ok((await attempt({ title: 'only a title', body: '' })).ok);
  });

  it('lets a note with only attachments be saved empty', async () => {
    const id = await add('Pics');
    n.files.sources.set('file:///a.png', 'x');
    n.picker.next = { uri: 'file:///a.png', name: 'a.png', mime: 'image/png', sizeBytes: 1 };
    await n.attachments.pickAndAdd(id, 'image');
    assert.ok((await n.notes.save(draft({ title: '', body: '' }), id)).ok);
    const fresh = await n.notes.save(draft({ title: '', body: '' }), null);
    assert.equal(fresh.ok, false);
  });

  it('does not complain about a reminder time that is already stored', async () => {
    const id = await add('R', { reminderAt: at(2026, 10, 20) });
    n.state.now = at(2026, 10, 25);
    assert.ok((await n.notes.save(draft({ title: 'R2', reminderAt: at(2026, 10, 20) }), id)).ok);
  });
});

describe('pin, favorite, archive and trash', () => {
  it('pins to the top of the list without changing the edit time', async () => {
    const a = await add('A');
    await add('B', {}, 1);
    const before = (await n.notes.get(a))?.updatedAt;
    assert.deepEqual(await titles(), ['B', 'A']);
    await n.notes.setPinned(a, true);
    assert.deepEqual(await titles(), ['A', 'B']);
    assert.equal((await n.notes.get(a))?.updatedAt, before);
    await n.notes.setPinned(a, false);
    assert.deepEqual(await titles(), ['B', 'A']);
  });

  it('lists favorites separately', async () => {
    const a = await add('A');
    await add('B');
    await n.notes.setFavorite(a, true);
    assert.deepEqual(await titles({ scope: 'favorites' }), ['A']);
    assert.deepEqual((await titles()).sort(), ['A', 'B']);
    await n.notes.setFavorite(a, false);
    assert.deepEqual(await titles({ scope: 'favorites' }), []);
  });

  it('moves notes between the main list, the archive and the trash', async () => {
    const a = await add('A');
    const b = await add('B');
    await n.notes.setFavorite(a, true);

    await n.notes.archive([a]);
    assert.deepEqual(await titles(), ['B']);
    assert.deepEqual(await titles({ scope: 'archived' }), ['A']);
    assert.deepEqual(
      await titles({ scope: 'favorites' }),
      [],
      'archived notes are not favorites in the list',
    );

    await n.notes.unarchive([a]);
    assert.deepEqual((await titles()).sort(), ['A', 'B']);

    await n.notes.trash([a, b]);
    assert.deepEqual(await titles(), []);
    assert.deepEqual((await titles({ scope: 'trash' })).sort(), ['A', 'B']);
    assert.equal(
      (await n.notes.get(a))?.deletedAt,
      n.state.now,
      'trashed notes can still be opened',
    );

    await n.notes.restore([a]);
    assert.deepEqual(await titles(), ['A']);
    assert.deepEqual(await titles({ scope: 'trash' }), ['B']);
  });

  it('keeps archived and trashed notes out of each other’s lists', async () => {
    const a = await add('A');
    await n.notes.archive([a]);
    await n.notes.trash([a]);
    assert.deepEqual(await titles({ scope: 'archived' }), []);
    assert.deepEqual(await titles({ scope: 'trash' }), ['A']);
    await n.notes.restore([a]);
    assert.deepEqual(
      await titles({ scope: 'archived' }),
      ['A'],
      'it was archived before it was trashed',
    );
  });

  it('deletes forever, taking tags, attachments and files with it', async () => {
    const tag = await mustSave(n.tags.save({ id: null, name: 'Idea', color: '#111' }));
    const id = await add('Gone', { tagIds: [tag.id] });
    n.files.sources.set('file:///a.pdf', 'pdf');
    n.picker.next = { uri: 'file:///a.pdf', name: 'a.pdf', mime: 'application/pdf', sizeBytes: 3 };
    await n.attachments.pickAndAdd(id, 'pdf');
    assert.equal(n.files.files.size, 1);

    await n.notes.trash([id]);
    await n.notes.deleteForever([id]);
    assert.equal(await n.notes.get(id), null);
    assert.equal(n.files.files.size, 0);
    for (const table of ['note_tags', 'note_attachments', 'notes']) {
      assert.equal(
        n.db.getFirstSync<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`)?.c,
        0,
        table,
      );
    }
    await n.notes.deleteForever([]); // nothing to do
  });

  it('empties the trash and purges notes after 30 days', async () => {
    const old = await add('Old');
    await n.notes.trash([old]);
    n.state.now += 29 * 86_400_000;
    const recent = await add('Recent');
    await n.notes.trash([recent]);
    const keep = await add('Keep');

    n.state.now += 86_400_000 - 1;
    assert.equal(await n.notes.purgeExpired(), 0, 'just under 30 days');
    n.state.now += 2;
    assert.equal(await n.notes.purgeExpired(), 1);
    assert.deepEqual(await titles({ scope: 'trash' }), ['Recent']);

    assert.equal(await n.notes.emptyTrash(), 1);
    assert.deepEqual(await titles({ scope: 'trash' }), []);
    assert.deepEqual(await titles(), ['Keep']);
    assert.ok(await n.notes.get(keep));
  });
});

describe('search, filters and sorting', () => {
  it('searches titles, bodies and tag names, treating wildcards literally', async () => {
    const tag = await mustSave(n.tags.save({ id: null, name: 'Recipes', color: '#111' }));
    await add('Pasta', { body: 'boil water' });
    await add('Shopping', { body: 'milk, 50% off' });
    await add('Soup', { body: 'x', tagIds: [tag.id] });

    assert.deepEqual(await titles({ search: 'pasta' }), ['Pasta']);
    assert.deepEqual(await titles({ search: 'WATER' }), ['Pasta']);
    assert.deepEqual(await titles({ search: 'recip' }), ['Soup']);
    assert.deepEqual(await titles({ search: '50%' }), ['Shopping']);
    assert.deepEqual(await titles({ search: '%' }), ['Shopping'], 'a lone % is not a wildcard');
    assert.deepEqual(await titles({ search: '_' }), []);
    assert.deepEqual(await titles({ search: 'nothing' }), []);
  });

  it('does not let search reveal the text of locked notes', async () => {
    await add('Visible', { body: 'secret word' });
    const locked = await add('Diary', { body: 'secret word', locked: true });
    assert.deepEqual(await titles({ search: 'secret' }), ['Visible']);
    assert.deepEqual(await titles({ search: 'diary' }), ['Diary'], 'the title is still searchable');
    const [summary] = await list({ search: 'diary' });
    assert.equal(summary?.id, locked);
    assert.equal(summary?.preview, '');
    assert.equal(summary?.locked, true);
  });

  it('filters by folder (with subfolders), no folder, tags, color, attachments and reminders', async () => {
    const work = await mustSave(n.folders.save({ name: 'Work', parentId: null }, null));
    const projects = await mustSave(n.folders.save({ name: 'Projects', parentId: work.id }, null));
    const home = await mustSave(n.folders.save({ name: 'Home', parentId: null }, null));
    const t1 = await mustSave(n.tags.save({ id: null, name: 'A', color: '#111' }));
    const t2 = await mustSave(n.tags.save({ id: null, name: 'B', color: '#222' }));

    await add('in work', { folderId: work.id });
    await add('in projects', { folderId: projects.id, tagIds: [t1.id], color: '#2563EB' });
    await add('in home', { folderId: home.id, tagIds: [t1.id, t2.id] });
    const loose = await add('loose', { reminderAt: at(2026, 11, 1) });
    n.files.sources.set('file:///i.png', 'x');
    n.picker.next = { uri: 'file:///i.png', name: 'i.png', mime: 'image/png', sizeBytes: 1 };
    await n.attachments.pickAndAdd(loose, 'image');

    const sorted = async (filter: Partial<NoteFilter>) => (await titles(filter)).sort();
    assert.deepEqual(await sorted({ folderId: work.id }), ['in projects', 'in work']);
    assert.deepEqual(await sorted({ folderId: projects.id }), ['in projects']);
    assert.deepEqual(await sorted({ folderId: NO_FOLDER }), ['loose']);
    assert.deepEqual(await sorted({ tagIds: [t1.id] }), ['in home', 'in projects']);
    assert.deepEqual(await sorted({ tagIds: [t2.id, 'ghost'] }), ['in home']);
    assert.deepEqual(await sorted({ color: '#2563EB' }), ['in projects']);
    assert.deepEqual(await sorted({ withAttachments: true }), ['loose']);
    assert.deepEqual(await sorted({ withReminder: true }), ['loose']);
    assert.deepEqual(await sorted({ folderId: work.id, tagIds: [t1.id] }), ['in projects']);
    assert.deepEqual(await sorted({ folderId: 'ghost' }), []);
  });

  it('sorts by edit time, creation time and title, with pinned notes first', async () => {
    const b = await add('banana', {}, 1);
    await add('Apple', {}, 1);
    await add('', { body: 'untitled body' }, 1);
    await add('cherry', {}, 1);
    n.state.now += 60_000;
    await mustSave(n.notes.save(draft({ title: 'banana', body: 'edited' }), b)); // edited last

    const order = async (field: NoteSort['field'], direction: NoteSort['direction']) =>
      titles({}, { field, direction });
    assert.deepEqual(await order('updated', 'desc'), ['banana', 'cherry', '', 'Apple']);
    assert.deepEqual(await order('updated', 'asc'), ['Apple', '', 'cherry', 'banana']);
    assert.deepEqual(await order('created', 'desc'), ['cherry', '', 'Apple', 'banana']);
    assert.deepEqual(await order('created', 'asc'), ['banana', 'Apple', '', 'cherry']);
    assert.deepEqual(
      await order('title', 'asc'),
      ['Apple', 'banana', 'cherry', ''],
      'untitled notes go last',
    );
    assert.deepEqual(await order('title', 'desc'), ['cherry', 'banana', 'Apple', '']);

    await n.notes.setPinned(b, true);
    assert.equal((await order('title', 'desc'))[0], 'banana');
    assert.equal((await order('created', 'desc'))[0], 'banana');
    await n.notes.archive([b]);
    assert.equal((await titles({ scope: 'archived' })).length, 1);
  });

  it('limits the number of notes returned', async () => {
    for (const title of ['a', 'b', 'c']) {
      await add(title, {}, 1);
    }
    assert.equal((await list({}, DEFAULT_SORT, 2)).length, 2);
  });
});

describe('summaries', () => {
  it('shows a plain-text preview, checklist progress and attachment counts', async () => {
    const id = await add('Plan', {
      body: '# Heading\nSome **bold** text\n- [x] done\n- [ ] todo\n  - [ ] nested',
    });
    const [summary] = await list();
    assert.equal(summary?.id, id);
    assert.equal(summary?.preview, 'Heading · Some bold text · ☑ done · ☐ todo · ☐ nested');
    assert.deepEqual(
      [summary?.checklistTotal, summary?.checklistDone, summary?.attachmentCount],
      [3, 1, 0],
    );
  });

  it('hides everything private about a locked note', async () => {
    await add('Secret', { body: '- [ ] one\n- [x] two', locked: true });
    const [summary] = await list();
    assert.deepEqual(
      [summary?.preview, summary?.checklistTotal, summary?.checklistDone],
      ['', 0, 0],
    );
  });

  it('ticks a task in place and reports the new text', async () => {
    const id = await add('List', { body: 'intro\n- [ ] a\n- [ ] b' });
    n.state.now += 1000;
    assert.equal(await n.notes.toggleTask(id, 2), 'intro\n- [ ] a\n- [x] b');
    assert.equal((await list())[0]?.checklistDone, 1);
    assert.equal((await n.notes.get(id))?.updatedAt, n.state.now);
    assert.equal(
      await n.notes.toggleTask(id, 0),
      'intro\n- [ ] a\n- [x] b',
      'a plain line is left alone',
    );
    assert.equal(await n.notes.toggleTask('ghost', 0), null);
  });

  it('lists folders and tags on the note', async () => {
    const folder = await mustSave(n.folders.save({ name: 'Ideas', parentId: null }, null));
    const z = await mustSave(n.tags.save({ id: null, name: 'zeta', color: '#111' }));
    const a = await mustSave(n.tags.save({ id: null, name: 'Alpha', color: '#222' }));
    await add('N', { folderId: folder.id, tagIds: [z.id, a.id, a.id] });
    const [summary] = await list();
    assert.deepEqual(summary?.folder, { id: folder.id, name: 'Ideas' });
    assert.deepEqual(
      summary?.tags.map((tag) => tag.name),
      ['Alpha', 'zeta'],
      'sorted by name, no duplicates',
    );
  });

  it('replaces tags when edited and drops a tag everywhere when it is deleted', async () => {
    const t1 = await mustSave(n.tags.save({ id: null, name: 'One', color: '#111' }));
    const t2 = await mustSave(n.tags.save({ id: null, name: 'Two', color: '#222' }));
    const id = await add('N', { tagIds: [t1.id] });
    await mustSave(n.notes.save(draft({ title: 'N', tagIds: [t2.id] }), id));
    assert.deepEqual(
      (await n.notes.get(id))?.tags.map((t) => t.name),
      ['Two'],
    );
    await n.tags.delete(t2.id);
    assert.deepEqual((await n.notes.get(id))?.tags, []);
  });

  it('moves notes between folders', async () => {
    const folder = await mustSave(n.folders.save({ name: 'F', parentId: null }, null));
    const a = await add('A');
    const b = await add('B');
    await n.notes.setFolder([a, b], folder.id);
    assert.equal((await n.notes.get(a))?.folder?.name, 'F');
    await n.notes.setFolder([a], null);
    assert.equal((await n.notes.get(a))?.folder, null);
    await assert.rejects(n.notes.setFolder([a], 'ghost'));
  });
});

describe('reminders', () => {
  const when = at(2026, 10, 20, 9);

  it('schedules a reminder for a future time and stores the notification id', async () => {
    const saved = await mustSave(
      n.notes.save(draft({ title: 'Call', body: 'Call mum', reminderAt: when }), null),
    );
    assert.equal(saved.reminder, 'scheduled');
    const [[id, reminder]] = [...n.reminders.active];
    assert.deepEqual(reminder, { noteId: saved.id, title: 'Call', body: 'Call mum', fireAt: when });
    assert.equal((await n.notes.get(saved.id))?.notificationId, id);
  });

  it('reschedules when the time changes and cancels when it is cleared', async () => {
    const { id } = await mustSave(n.notes.save(draft({ reminderAt: when }), null));
    await mustSave(n.notes.save(draft({ reminderAt: when + 3_600_000 }), id));
    assert.equal(n.reminders.active.size, 1);
    assert.equal([...n.reminders.active.values()][0]?.fireAt, when + 3_600_000);
    await mustSave(n.notes.save(draft({ reminderAt: null }), id));
    assert.equal(n.reminders.active.size, 0);
    assert.equal((await n.notes.get(id))?.notificationId, null);
    assert.equal((await n.notes.get(id))?.reminderAt, null);
  });

  it('keeps the reminder time but stops the notification while archived or trashed, and resumes on restore', async () => {
    const { id } = await mustSave(n.notes.save(draft({ reminderAt: when }), null));
    await n.notes.archive([id]);
    assert.equal(n.reminders.active.size, 0);
    assert.equal((await n.notes.get(id))?.reminderAt, when);
    await n.notes.unarchive([id]);
    assert.equal(n.reminders.active.size, 1);
    await n.notes.trash([id]);
    assert.equal(n.reminders.active.size, 0);
    await n.notes.restore([id]);
    assert.equal(n.reminders.active.size, 1);
    n.state.now = when + 1;
    await n.notes.archive([id]);
    await n.notes.unarchive([id]);
    assert.equal(n.reminders.active.size, 0, 'a reminder in the past is not scheduled again');
  });

  it('cancels the reminder when a note is deleted forever', async () => {
    const { id } = await mustSave(n.notes.save(draft({ reminderAt: when }), null));
    await n.notes.trash([id]);
    await n.notes.deleteForever([id]);
    assert.equal(n.reminders.active.size, 0);
  });

  it('still saves the note when notifications are blocked', async () => {
    n.reminders.blocked = true;
    const saved = await mustSave(n.notes.save(draft({ reminderAt: when }), null));
    assert.equal(saved.reminder, 'blocked');
    assert.equal((await n.notes.get(saved.id))?.reminderAt, when);
  });

  it('keeps a locked note’s text out of the notification', async () => {
    const { id } = await mustSave(n.notes.save(draft({ body: 'private', reminderAt: when }), null));
    assert.equal([...n.reminders.active.values()][0]?.body, 'private');
    await n.notes.setLocked(id, true);
    assert.equal([...n.reminders.active.values()][0]?.body, 'Locked note');
  });

  it('uses a placeholder title and body when there are none', async () => {
    await mustSave(n.notes.save(draft({ title: '', body: '- [ ] x', reminderAt: when }), null));
    await mustSave(n.notes.save(draft({ title: 'T', body: '', reminderAt: when }), null));
    const reminders = [...n.reminders.active.values()];
    assert.deepEqual(reminders.map((r) => r.title).sort(), ['Note', 'T']);
    assert.ok(reminders.some((r) => r.body === 'Open your note'));
  });
});

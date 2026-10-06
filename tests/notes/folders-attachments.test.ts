import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  MAX_FOLDER_DEPTH,
  buildFolderTree,
  depthOf,
  flattenFolderTree,
  folderAndDescendantIds,
  folderPath,
  heightBelow,
  moveProblem,
} from '@/features/notes/domain/folders';
import {
  AttachmentError,
  MAX_ATTACHMENTS_PER_NOTE,
  MAX_ATTACHMENT_BYTES,
  attachmentPath,
} from '@/features/notes/domain/attachment-usecases';
import {
  parseDrawing,
  serializeDrawing,
  strokePath,
  thin,
  type Drawing,
} from '@/features/notes/domain/drawing';

import { at, createNotes, draft, mustSave, type Notes } from './setup';

let n: Notes;
beforeEach(() => {
  n = createNotes(at(2026, 10, 15));
});

const folder = (name: string, parentId: string | null = null) =>
  mustSave(n.folders.save({ name, parentId }, null)).then((saved) => saved.id);

describe('folders', () => {
  it('nests folders and orders each level by name', async () => {
    const work = await folder('Work');
    await folder('archive');
    const b = await folder('Beta', work);
    await folder('Alpha', work);
    await folder('Deep', b);
    const tree = await n.folders.tree();
    assert.deepEqual(
      tree.map((f) => f.name),
      ['archive', 'Work'],
    );
    assert.deepEqual(
      tree[1]?.children.map((f) => [f.name, f.depth]),
      [
        ['Alpha', 1],
        ['Beta', 1],
      ],
    );
    assert.deepEqual(
      flattenFolderTree(tree).map((f) => f.name),
      ['archive', 'Work', 'Alpha', 'Beta', 'Deep'],
    );
  });

  it('allows the same name under different parents but not among siblings', async () => {
    const a = await folder('A');
    const b = await folder('B');
    await folder('Notes', a);
    await folder('Notes', b);
    assert.deepEqual(await n.folders.save({ name: ' notes ', parentId: a }, null), {
      ok: false,
      errors: { name: 'A folder with this name already exists here' },
    });
    assert.equal((await n.folders.save({ name: '', parentId: null }, null)).ok, false);
    assert.equal((await n.folders.save({ name: 'x'.repeat(41), parentId: null }, null)).ok, false);
    assert.equal((await n.folders.save({ name: 'Ok', parentId: 'ghost' }, null)).ok, false);
  });

  it('renames and moves folders, refusing cycles and excessive depth', async () => {
    const a = await folder('A');
    const b = await folder('B', a);
    const c = await folder('C', b);
    assert.ok((await n.folders.save({ name: 'A2', parentId: null }, a)).ok);
    assert.deepEqual(await n.folders.save({ name: 'A2', parentId: c }, a), {
      ok: false,
      errors: { parent: 'A folder cannot be moved inside itself' },
    });
    assert.equal(
      (await n.folders.save({ name: 'B', parentId: b }, b)).ok,
      false,
      'not inside itself',
    );
    assert.ok((await n.folders.save({ name: 'C', parentId: null }, c)).ok, 'moving out to the top');

    let parent: string | null = null;
    for (let depth = 0; depth <= MAX_FOLDER_DEPTH; depth += 1) {
      parent = await folder(`L${depth}`, parent);
    }
    const tooDeep = await n.folders.save({ name: 'Extra', parentId: parent }, null);
    assert.deepEqual(tooDeep, {
      ok: false,
      errors: { parent: 'Folders can only be nested a few levels deep' },
    });
    await assert.rejects(n.folders.save({ name: 'x', parentId: null }, 'ghost'));
  });

  it('counts only active notes directly inside each folder', async () => {
    const f = await folder('F');
    const sub = await folder('Sub', f);
    const add = (folderId: string) =>
      mustSave(n.notes.save(draft({ folderId }), null)).then((r) => r.id);
    await add(f);
    const archived = await add(f);
    const trashed = await add(f);
    await add(sub);
    await n.notes.archive([archived]);
    await n.notes.trash([trashed]);
    const counts = Object.fromEntries((await n.folders.list()).map((x) => [x.name, x.noteCount]));
    assert.deepEqual(counts, { F: 1, Sub: 1 });
  });

  it('moves a deleted folder’s notes and subfolders up to its parent', async () => {
    const a = await folder('A');
    const b = await folder('B', a);
    const c = await folder('C', b);
    const note = (await mustSave(n.notes.save(draft({ folderId: b }), null))).id;
    assert.equal(await n.folders.remove(b), a);
    assert.equal((await n.notes.get(note))?.folder?.id, a);
    assert.deepEqual((await n.folders.list()).map((x) => [x.name, x.parentId]).sort(), [
      ['A', null],
      ['C', a],
    ]);
    assert.equal(await n.folders.remove(a), null);
    assert.equal((await n.notes.get(note))?.folder, null);
    assert.equal((await n.folders.list())[0]?.parentId, null);
    assert.equal(c.length > 0, true);
    await assert.rejects(n.folders.remove('ghost'));
  });

  it('keeps trashed notes when their folder goes, and refuses a name clash on the way up', async () => {
    const a = await folder('A');
    const trashed = (await mustSave(n.notes.save(draft({ folderId: a }), null))).id;
    await n.notes.trash([trashed]);
    await n.folders.remove(a);
    assert.equal((await n.notes.get(trashed))?.folder, null);

    const root = await folder('Root');
    const mid = await folder('Mid', root);
    await folder('Same', mid);
    await folder('Same', root);
    await assert.rejects(n.folders.remove(mid), /already exists/);
    assert.equal((await n.folders.list()).length, 4, 'nothing was moved');
  });
});

describe('folder helpers', () => {
  const folders = [
    { id: 'a', name: 'A', parentId: null, createdAt: 1 },
    { id: 'b', name: 'B', parentId: 'a', createdAt: 1 },
    { id: 'c', name: 'C', parentId: 'b', createdAt: 1 },
    { id: 'd', name: 'D', parentId: null, createdAt: 1 },
  ];

  it('finds descendants, depth, height and paths', () => {
    assert.deepEqual(folderAndDescendantIds(folders, 'a'), ['a', 'b', 'c']);
    assert.deepEqual(folderAndDescendantIds(folders, 'd'), ['d']);
    assert.deepEqual(
      [depthOf(folders, null), depthOf(folders, 'a'), depthOf(folders, 'c')],
      [0, 0, 2],
    );
    assert.deepEqual([heightBelow(folders, 'a'), heightBelow(folders, 'c')], [2, 0]);
    assert.equal(folderPath(folders, 'c'), 'A / B / C');
    assert.equal(folderPath(folders, 'ghost'), '');
  });

  it('judges moves', () => {
    assert.equal(moveProblem(folders, 'a', 'c'), 'cycle');
    assert.equal(moveProblem(folders, 'a', 'a'), 'cycle');
    assert.equal(moveProblem(folders, 'c', 'd'), null);
    assert.equal(moveProblem(folders, null, 'c'), null);
    assert.equal(moveProblem(folders, 'a', null), null);
    assert.equal(moveProblem(folders, 'a', 'd'), null);
  });

  it('survives corrupt data: orphans become roots and loops do not hang', () => {
    const odd = [
      { id: 'x', name: 'X', parentId: 'missing', createdAt: 1, noteCount: 0 },
      { id: 'p', name: 'P', parentId: 'q', createdAt: 1, noteCount: 0 },
      { id: 'q', name: 'Q', parentId: 'p', createdAt: 1, noteCount: 0 },
    ];
    assert.deepEqual(
      buildFolderTree(odd).map((f) => f.name),
      ['X'],
    );
    assert.ok(depthOf(odd, 'p') >= 0);
  });
});

describe('attachments', () => {
  async function note() {
    return (await mustSave(n.notes.save(draft(), null))).id;
  }
  const pick = (uri: string, name: string, mime: string, size = 5, content = 'data') => {
    n.files.sources.set(uri, content);
    n.picker.next = { uri, name, mime, sizeBytes: size };
  };

  it('copies a picked image into app storage and records it', async () => {
    const id = await note();
    pick('content://photos/1', 'holiday.jpg', 'image/jpeg', 9, 'jpegbytes');
    const added = await n.attachments.pickAndAdd(id, 'image');
    assert.ok(added);
    assert.deepEqual(
      [added.kind, added.name, added.mime, added.sizeBytes, added.durationMs],
      ['image', 'holiday.jpg', 'image/jpeg', 9, null],
    );
    assert.equal(added.path, attachmentPath(id, added.id, 'image/jpeg'));
    assert.match(added.path, new RegExp(`^notes/${id}/.+\\.jpg$`));
    assert.equal(n.files.files.get(added.path), 'jpegbytes');
    assert.deepEqual(n.picker.requested, [['image/*']]);
    assert.equal(n.attachments.uriOf(added), `file:///docs/${added.path}`);
    assert.deepEqual(
      (await n.notes.get(id))?.attachments.map((a) => a.id),
      [added.id],
    );
  });

  it('accepts PDFs and checks the type the user picked', async () => {
    const id = await note();
    pick('content://docs/1', 'a/b\\c.pdf', 'application/pdf');
    const pdf = await n.attachments.pickAndAdd(id, 'pdf');
    assert.equal(pdf?.name, 'a_b_c.pdf', 'path separators are removed');
    assert.deepEqual(n.picker.requested[0], ['application/pdf']);
    pick('content://docs/2', 'x.txt', 'text/plain');
    await assert.rejects(n.attachments.pickAndAdd(id, 'pdf'), /Choose a PDF/);
    pick('content://docs/3', 'x.pdf', 'application/pdf');
    await assert.rejects(n.attachments.pickAndAdd(id, 'image'), /Choose an image/);
    assert.equal((await n.attachments.list(id)).length, 1);
  });

  it('does nothing when the picker is cancelled', async () => {
    const id = await note();
    n.picker.next = null;
    assert.equal(await n.attachments.pickAndAdd(id, 'image'), null);
    assert.equal((await n.attachments.list(id)).length, 0);
  });

  it('refuses files that are too large, even if the picker under-reports the size', async () => {
    const id = await note();
    pick('content://big', 'big.png', 'image/png', MAX_ATTACHMENT_BYTES + 1);
    await assert.rejects(n.attachments.pickAndAdd(id, 'image'), /too large/);
    pick('content://liar', 'liar.png', 'image/png', 10, 'x'.repeat(MAX_ATTACHMENT_BYTES + 1));
    await assert.rejects(n.attachments.pickAndAdd(id, 'image'), AttachmentError);
    assert.equal(n.files.files.size, 0, 'the oversized copy is removed');
  });

  it('limits attachments per note and needs an existing note', async () => {
    const id = await note();
    for (let index = 0; index < MAX_ATTACHMENTS_PER_NOTE; index += 1) {
      pick(`content://f${index}`, `f${index}.png`, 'image/png');
      await n.attachments.pickAndAdd(id, 'image');
    }
    pick('content://one-more', 'more.png', 'image/png');
    await assert.rejects(n.attachments.pickAndAdd(id, 'image'), /up to 20/);
    await assert.rejects(n.attachments.pickAndAdd('ghost', 'image'), /no longer exists/);
    await assert.rejects(
      n.attachments.addRecording('ghost', { uri: 'x', durationMs: 1 }),
      AttachmentError,
    );
  });

  it('leaves nothing behind when the copy fails', async () => {
    const id = await note();
    n.picker.next = { uri: 'content://missing', name: 'x.png', mime: 'image/png', sizeBytes: 1 };
    await assert.rejects(n.attachments.pickAndAdd(id, 'image'));
    assert.equal((await n.attachments.list(id)).length, 0);
    assert.equal(n.files.files.size, 0);
  });

  it('records voice notes with their length', async () => {
    const id = await note();
    n.files.sources.set('file:///cache/rec.m4a', 'audio');
    const rec = await n.attachments.addRecording(id, {
      uri: 'file:///cache/rec.m4a',
      durationMs: 12_345.6,
    });
    assert.deepEqual(
      [rec.kind, rec.mime, rec.durationMs, rec.sizeBytes],
      ['audio', 'audio/mp4', 12_346, 5],
    );
    assert.match(rec.name, /^Voice note /);
    assert.match(rec.path, /\.m4a$/);
    const negative = await n.attachments.addRecording(id, {
      uri: 'file:///cache/rec.m4a',
      durationMs: -5,
    });
    assert.equal(negative.durationMs, 0);
  });

  const sketch: Drawing = {
    width: 300,
    height: 200,
    strokes: [
      {
        color: '#7B2FF7',
        width: 4,
        points: [
          { x: 1, y: 2 },
          { x: 5, y: 9 },
        ],
      },
    ],
  };

  it('saves a drawing, reads it back and replaces it in place when edited', async () => {
    const id = await note();
    const saved = await n.attachments.saveDrawing(id, sketch, null);
    assert.deepEqual(
      [saved.kind, saved.mime],
      ['drawing', 'application/vnd.focusflow.drawing+json'],
    );
    assert.match(saved.path, /\.sketch\.json$/);
    assert.deepEqual(await n.attachments.readDrawing(saved), sketch);

    const edited = {
      ...sketch,
      strokes: [...sketch.strokes, { color: '#000000', width: 2, points: [{ x: 0, y: 0 }] }],
    };
    const again = await n.attachments.saveDrawing(id, edited, saved.id);
    assert.equal(again.id, saved.id);
    assert.equal((await n.attachments.list(id)).length, 1);
    assert.equal((await n.attachments.list(id))[0]?.sizeBytes, serializeDrawing(edited).length);
    assert.deepEqual(await n.attachments.readDrawing(again), edited);
    await assert.rejects(n.attachments.saveDrawing(id, sketch, 'ghost'), AttachmentError);
  });

  it('returns null for a drawing that is missing or damaged', async () => {
    const id = await note();
    const saved = await n.attachments.saveDrawing(id, sketch, null);
    n.files.files.set(saved.path, '{not json');
    assert.equal(await n.attachments.readDrawing(saved), null);
    n.files.files.delete(saved.path);
    assert.equal(await n.attachments.readDrawing(saved), null);
  });

  it('removes an attachment’s file and row', async () => {
    const id = await note();
    pick('content://1', 'a.png', 'image/png');
    const added = await n.attachments.pickAndAdd(id, 'image');
    await n.attachments.remove(added!.id);
    assert.equal(n.files.files.size, 0);
    assert.equal((await n.attachments.list(id)).length, 0);
    await n.attachments.remove('ghost');
  });

  it('tells the app when something changed', async () => {
    const id = await note();
    const before = n.changes.count;
    pick('content://1', 'a.png', 'image/png');
    await n.attachments.pickAndAdd(id, 'image');
    assert.equal(n.changes.count, before + 1);
  });
});

describe('drawing format', () => {
  it('rejects data it cannot trust and drops bad strokes and points', () => {
    assert.equal(parseDrawing('nope'), null);
    assert.equal(parseDrawing('{"version":2,"width":1,"height":1,"strokes":[]}'), null);
    assert.equal(parseDrawing('{"version":1,"width":0,"height":1,"strokes":[]}'), null);
    assert.equal(parseDrawing('{"version":1,"width":1,"height":1}'), null);
    const parsed = parseDrawing(
      JSON.stringify({
        version: 1,
        width: 10,
        height: 10,
        strokes: [
          {
            color: '#fff',
            width: 2,
            points: [{ x: 1, y: 1 }, { x: 'a', y: 2 }, null, { x: Infinity, y: 0 }],
          },
          { color: 5, width: 2, points: [{ x: 1, y: 1 }] },
          { color: '#000', width: -1, points: [{ x: 1, y: 1 }] },
          { color: '#000', width: 2, points: [] },
          'junk',
        ],
      }),
    );
    assert.deepEqual(parsed?.strokes, [{ color: '#fff', width: 2, points: [{ x: 1, y: 1 }] }]);
  });

  it('builds smooth SVG paths', () => {
    assert.equal(strokePath([]), '');
    assert.equal(strokePath([{ x: 1, y: 2 }]), 'M1 2l0.01 0');
    assert.equal(
      strokePath([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]),
      'M0 0L10 10',
    );
    assert.equal(
      strokePath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
      'M0 0Q10 0 10 5L10 10',
    );
  });

  it('thins points while keeping the ends', () => {
    const points = [0, 1, 2, 3, 10, 11].map((x) => ({ x, y: 0 }));
    assert.deepEqual(
      thin(points, 3).map((p) => p.x),
      [0, 3, 10, 11],
    );
    assert.deepEqual(thin([], 3), []);
    assert.deepEqual(thin([{ x: 1, y: 1 }], 3), [{ x: 1, y: 1 }]);
  });
});

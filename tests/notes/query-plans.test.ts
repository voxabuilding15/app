import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_FILTER,
  DEFAULT_SORT,
  type NoteQuery,
  type NoteSort,
} from '@/features/notes/domain/filters';
import { SELECT_SUMMARY, buildOrderBy, buildWhere } from '@/features/notes/data/note-queries';

import { createTestDatabase } from '../tasks/test-database';

const db = createTestDatabase();
const base: NoteQuery = { ...DEFAULT_FILTER, folderIds: null, withoutFolder: false };

function plan(query: Partial<NoteQuery>, sort: NoteSort = DEFAULT_SORT): string {
  const merged = { ...base, ...query };
  const where = buildWhere(merged);
  return db
    .getAllSync<{ detail: string }>(
      `EXPLAIN QUERY PLAN ${SELECT_SUMMARY} WHERE ${where.sql} ORDER BY ${buildOrderBy(sort, merged.scope)} LIMIT ?`,
      [...where.params, 50],
    )
    .map((row) => row.detail)
    .join(' | ');
}

describe('notes query plans', () => {
  it('reads each scope through its partial index', () => {
    assert.match(plan({}), /idx_notes_active/);
    assert.match(plan({ scope: 'favorites' }), /idx_notes_favorite/);
    assert.match(plan({ scope: 'archived' }), /idx_notes_archived/);
    assert.match(plan({ scope: 'trash' }), /idx_notes_deleted/);
  });

  it('uses the folder index for folder filters', () => {
    assert.match(plan({ folderIds: ['a', 'b'] }), /idx_notes_folder/);
  });

  it('never scans the tag, attachment or folder tables once per note', () => {
    const detail = plan({ search: 'x', tagIds: ['t'], withAttachments: true, color: '#7B2FF7' });
    assert.doesNotMatch(detail, /SCAN (nt|a|c|f)\b/);
    assert.doesNotMatch(detail, /SCAN (note_tags|note_attachments|categories|folders)\b/);
  });

  it('finds due reminders and trashed notes by index', () => {
    const reminders = db
      .getAllSync<{ detail: string }>(
        `EXPLAIN QUERY PLAN SELECT id FROM notes WHERE reminder_at IS NOT NULL AND reminder_at < ?`,
        [1],
      )
      .map((row) => row.detail)
      .join('|');
    assert.match(reminders, /idx_notes_reminder/);
    const expired = db
      .getAllSync<{ detail: string }>(
        `EXPLAIN QUERY PLAN SELECT id FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?`,
        [1],
      )
      .map((row) => row.detail)
      .join('|');
    assert.match(expired, /idx_notes_deleted/);
  });

  it('looks up a note’s tags and attachments by note', () => {
    const detail = db
      .getAllSync<{ detail: string }>(
        `EXPLAIN QUERY PLAN SELECT category_id FROM note_tags WHERE note_id = ? UNION ALL SELECT id FROM note_attachments WHERE note_id = ?`,
        ['n', 'n'],
      )
      .map((row) => row.detail)
      .join('|');
    assert.doesNotMatch(detail, /SCAN (note_tags|note_attachments)/);
  });
});

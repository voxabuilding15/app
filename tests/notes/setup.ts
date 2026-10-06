import { createCategoryUseCases, createId, type KeyValueStorage } from '@/core';
import { SqliteCategoryRepository } from '@/database/category-repository';
import { SqliteAttachmentRepository } from '@/features/notes/data/sqlite-attachment-repository';
import { SqliteFolderRepository } from '@/features/notes/data/sqlite-folder-repository';
import { SqliteNoteRepository } from '@/features/notes/data/sqlite-note-repository';
import { StorageLockStore, StorageWidgetPublisher } from '@/features/notes/data/storage-adapters';
import { createAttachmentUseCases } from '@/features/notes/domain/attachment-usecases';
import { createFolderUseCases } from '@/features/notes/domain/folder-usecases';
import { createLockUseCases } from '@/features/notes/domain/lock';
import { createNoteUseCases } from '@/features/notes/domain/note-usecases';
import { createWidgetUseCases } from '@/features/notes/domain/widget-usecases';
import { emptyNoteDraft, type NoteDraft } from '@/features/notes/domain/validation';

import { createTestDatabase } from '../tasks/test-database';

import { FakeAuthenticator, FakePicker, FakeReminders, FakeStorage } from './fakes';

export { FakeAuthenticator, FakePicker, FakeStorage } from './fakes';

export const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

export function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    setString: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}

/** The Notes use cases on a fresh in-memory database, with a clock the test controls. */
export function createNotes(start = at(2026, 10, 15)) {
  const state = { now: start };
  const clock = { now: () => state.now };
  const db = createTestDatabase();
  const storage = memoryStorage();
  const files = new FakeStorage();
  const picker = new FakePicker();
  const authenticator = new FakeAuthenticator();
  const reminders = new FakeReminders();

  const noteRepository = new SqliteNoteRepository(db);
  const folderRepository = new SqliteFolderRepository(db);
  const attachmentRepository = new SqliteAttachmentRepository(db);
  const tagRepository = new SqliteCategoryRepository(db, 'note', clock.now);
  const widgets = createWidgetUseCases({
    notes: noteRepository,
    publisher: new StorageWidgetPublisher(storage),
    clock,
  });
  const changes = { count: 0 };
  const onChanged = () => {
    changes.count += 1;
    void widgets.publish();
  };

  let salts = 0;
  return {
    db,
    state,
    storage,
    files,
    picker,
    authenticator,
    reminders,
    changes,
    widgets,
    notes: createNoteUseCases({
      notes: noteRepository,
      folders: folderRepository,
      attachments: attachmentRepository,
      storage: files,
      reminders,
      onChanged,
      clock,
    }),
    folders: createFolderUseCases({ folders: folderRepository, clock }),
    attachments: createAttachmentUseCases({
      notes: noteRepository,
      attachments: attachmentRepository,
      storage: files,
      picker,
      onChanged,
      clock,
    }),
    lock: createLockUseCases({
      store: new StorageLockStore(storage),
      authenticator,
      clock,
      newSalt: () => `salt${(salts += 1)}`,
    }),
    tags: createCategoryUseCases(tagRepository),
  };
}

export type Notes = ReturnType<typeof createNotes>;

export const draft = (overrides: Partial<NoteDraft> = {}): NoteDraft => ({
  ...emptyNoteDraft(),
  title: 'Note',
  body: 'Body',
  ...overrides,
});

export async function mustSave<T extends { ok: boolean }>(
  result: Promise<T>,
): Promise<Extract<T, { ok: true }>> {
  const saved = await result;
  if (!saved.ok) {
    throw new Error(`save failed: ${JSON.stringify(saved)}`);
  }
  return saved as Extract<T, { ok: true }>;
}

export const newId = createId;

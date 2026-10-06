import {
  StorageLockStore,
  createCategoryUseCases,
  createId,
  createLockUseCases,
  useContainer,
  type Authenticator,
  type Container,
  type LockUseCases,
} from '@/core';

import { DocumentAttachmentStorage } from '../data/file-attachment-storage';
import { NotificationNoteReminderScheduler } from '../data/notification-reminder-scheduler';
import { SqliteAttachmentRepository } from '../data/sqlite-attachment-repository';
import { SqliteFolderRepository } from '../data/sqlite-folder-repository';
import { SqliteNoteRepository } from '../data/sqlite-note-repository';
import { StorageWidgetPublisher } from '../data/storage-adapters';
import { SystemFilePicker } from '../data/system-file-picker';
import { createAttachmentUseCases, type AttachmentUseCases } from '../domain/attachment-usecases';
import { createFolderUseCases, type FolderUseCases } from '../domain/folder-usecases';
import { createNoteUseCases, type NoteUseCases } from '../domain/note-usecases';
import type { AttachmentStorage, FilePicker } from '../domain/ports';
import { createWidgetUseCases, type WidgetUseCases } from '../domain/widget-usecases';

/** The device-facing pieces of Notes, swappable so tests need no real files or biometrics. */
export interface NotesAdapters {
  storage: AttachmentStorage;
  picker: FilePicker;
  /** Defaults to the one on the container. */
  authenticator?: Authenticator;
}

export interface NotesModule {
  notes: NoteUseCases;
  folders: FolderUseCases;
  attachments: AttachmentUseCases;
  lock: LockUseCases;
  widgets: WidgetUseCases;
  tags: ReturnType<typeof createCategoryUseCases>;
}

const modules = new WeakMap<Container, NotesModule>();

function deviceAdapters(): NotesAdapters {
  return {
    storage: new DocumentAttachmentStorage(),
    picker: new SystemFilePicker(),
  };
}

/** Wires the Notes use cases to SQLite, files, notifications and biometrics, once per container. */
export function getNotesModule(
  container: Container,
  adapters: NotesAdapters = deviceAdapters(),
): NotesModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }

  const { db, clock } = container;
  const notes = new SqliteNoteRepository(db);
  const folders = new SqliteFolderRepository(db);
  const attachments = new SqliteAttachmentRepository(db);

  const widgets = createWidgetUseCases({
    notes,
    publisher: new StorageWidgetPublisher(container.storage),
    clock,
  });
  // Refreshing the widget is best effort: it must never fail a save.
  const onChanged = () => void widgets.publish().catch(() => undefined);

  const module: NotesModule = {
    notes: createNoteUseCases({
      notes,
      folders,
      attachments,
      storage: adapters.storage,
      reminders: new NotificationNoteReminderScheduler(container.notifications),
      onChanged,
      clock,
    }),
    folders: createFolderUseCases({ folders, clock }),
    attachments: createAttachmentUseCases({
      notes,
      attachments,
      storage: adapters.storage,
      picker: adapters.picker,
      onChanged,
      clock,
    }),
    lock: createLockUseCases({
      store: new StorageLockStore(container.storage, 'notes.lock'),
      authenticator: adapters.authenticator ?? container.authenticator,
      clock,
      newSalt: createId,
    }),
    widgets,
    tags: createCategoryUseCases(container.categories('note')),
  };
  modules.set(container, module);
  return module;
}

export function useNotesModule(): NotesModule {
  return getNotesModule(useContainer());
}

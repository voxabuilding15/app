import { DAY_MINUTES, MINUTE_MS, createId, type Clock } from '@/core';

import type { Attachment, NoteDetail, NoteRecord, NoteSummary } from './entities';
import {
  TRASH_RETENTION_DAYS,
  type NoteFilter,
  type NoteQuery,
  type NoteSort,
  NO_FOLDER,
} from './filters';
import { folderAndDescendantIds } from './folders';
import { excerptOf, normalizeBody, toggleTask } from './markdown';
import type {
  AttachmentRepository,
  AttachmentStorage,
  FolderRepository,
  NoteReminderScheduler,
  NoteRepository,
} from './ports';
import { hasErrors, validateNote, type NoteDraft, type NoteErrors } from './validation';
import { currentTranslator } from '@/i18n/translate';

export type ReminderStatus = 'none' | 'scheduled' | 'blocked' | 'past';

export type SaveNoteResult =
  { ok: true; id: string; reminder: ReminderStatus } | { ok: false; errors: NoteErrors };

interface NoteUseCaseDeps {
  notes: NoteRepository;
  folders: FolderRepository;
  attachments: AttachmentRepository;
  storage: AttachmentStorage;
  reminders: NoteReminderScheduler;
  /** Called after anything that changes what the notes list shows, e.g. to refresh a widget. */
  onChanged: () => void;
  clock: Clock;
}

const REMINDER_BODY_CHARS = 120;

function isActive(note: Pick<NoteRecord, 'archivedAt' | 'deletedAt'>): boolean {
  return note.archivedAt === null && note.deletedAt === null;
}

function reminderBody(note: NoteRecord): string {
  const { t } = currentTranslator();
  if (note.locked) {
    return t('Locked note');
  }
  return excerptOf(note.body, REMINDER_BODY_CHARS) || t('Open your note');
}

export function createNoteUseCases({
  notes,
  folders,
  attachments,
  storage,
  reminders,
  onChanged,
  clock,
}: NoteUseCaseDeps) {
  const { t } = currentTranslator();
  /** Brings the OS notification in line with the note's current state. */
  async function syncReminder(record: NoteRecord): Promise<ReminderStatus> {
    if (record.notificationId !== null) {
      await reminders.cancel(record.notificationId);
    }
    if (record.reminderAt === null) {
      await notes.setReminder(record.id, null, null);
      return 'none';
    }
    if (!isActive(record)) {
      await notes.setReminder(record.id, record.reminderAt, null);
      return 'none';
    }
    if (record.reminderAt <= clock.now()) {
      await notes.setReminder(record.id, record.reminderAt, null);
      return 'past';
    }
    const outcome = await reminders.schedule({
      noteId: record.id,
      title: record.title.trim() || t('Note'),
      body: reminderBody(record),
      fireAt: record.reminderAt,
    });
    if (outcome.status === 'blocked') {
      await notes.setReminder(record.id, record.reminderAt, null);
      return 'blocked';
    }
    await notes.setReminder(record.id, record.reminderAt, outcome.notificationId);
    return 'scheduled';
  }

  async function syncMany(ids: readonly string[]): Promise<void> {
    for (const record of await notes.getRecords(ids)) {
      await syncReminder(record);
    }
  }

  async function toQuery(filter: NoteFilter): Promise<NoteQuery> {
    const { folderId, ...rest } = filter;
    if (folderId === null) {
      return { ...rest, folderIds: null, withoutFolder: false };
    }
    if (folderId === NO_FOLDER) {
      return { ...rest, folderIds: null, withoutFolder: true };
    }
    return {
      ...rest,
      folderIds: folderAndDescendantIds(await folders.list(), folderId),
      withoutFolder: false,
    };
  }

  /** Permanently removes notes together with their files and pending reminders. */
  async function destroy(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    for (const record of await notes.getRecords(ids)) {
      if (record.notificationId !== null) {
        await reminders.cancel(record.notificationId);
      }
    }
    const files = await attachments.listForNotes(ids);
    await storage.remove(files.map((file) => file.path));
    await notes.delete(ids);
    onChanged();
  }

  return {
    async list(filter: NoteFilter, sort: NoteSort, limit: number): Promise<NoteSummary[]> {
      return notes.list(await toQuery(filter), sort, limit);
    },

    get(id: string): Promise<NoteDetail | null> {
      return notes.get(id);
    },

    async save(draft: NoteDraft, id: string | null): Promise<SaveNoteResult> {
      const errors = validateNote(draft);
      const existing = id === null ? null : await notes.getRecord(id);
      if (id !== null && existing === null) {
        throw new Error(t('This note no longer exists.'));
      }

      const body = normalizeBody(draft.body);
      if (!errors.title && !errors.body && draft.title.trim() === '' && body.trim() === '') {
        const files = existing === null ? [] : await attachments.listFor(existing.id);
        if (files.length === 0) {
          errors.content = t('Add a title or some text');
        }
      }
      if (draft.folderId !== null && (await folders.get(draft.folderId)) === null) {
        errors.folder = t('This folder no longer exists');
      }
      const now = clock.now();
      if (
        !errors.reminder &&
        draft.reminderAt !== null &&
        draft.reminderAt !== existing?.reminderAt &&
        draft.reminderAt <= now
      ) {
        errors.reminder = t('Choose a time in the future');
      }
      if (hasErrors(errors)) {
        return { ok: false, errors };
      }

      const record: NoteRecord = {
        id: existing?.id ?? createId(),
        title: draft.title.trim(),
        body,
        folderId: draft.folderId,
        color: draft.color,
        pinned: draft.pinned,
        favorite: draft.favorite,
        locked: draft.locked,
        archivedAt: existing?.archivedAt ?? null,
        deletedAt: existing?.deletedAt ?? null,
        reminderAt: draft.reminderAt,
        notificationId: existing?.notificationId ?? null,
        tagIds: [...new Set(draft.tagIds)],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (existing === null) {
        await notes.insert(record);
      } else {
        await notes.update(record);
      }
      const reminder = await syncReminder(record);
      onChanged();
      return { ok: true, id: record.id, reminder };
    },

    async setPinned(id: string, pinned: boolean): Promise<void> {
      await notes.setPinned(id, pinned);
      onChanged();
    },

    async setFavorite(id: string, favorite: boolean): Promise<void> {
      await notes.setFavorite(id, favorite);
      onChanged();
    },

    async setLocked(id: string, locked: boolean): Promise<void> {
      await notes.setLocked(id, locked);
      await syncMany([id]); // the reminder text hides a locked note's contents
      onChanged();
    },

    async setFolder(ids: readonly string[], folderId: string | null): Promise<void> {
      if (folderId !== null && (await folders.get(folderId)) === null) {
        throw new Error(t('This folder no longer exists.'));
      }
      await notes.setFolder(ids, folderId);
      onChanged();
    },

    async archive(ids: readonly string[]): Promise<void> {
      await notes.setArchivedAt(ids, clock.now());
      await syncMany(ids);
      onChanged();
    },

    async unarchive(ids: readonly string[]): Promise<void> {
      await notes.setArchivedAt(ids, null);
      await syncMany(ids);
      onChanged();
    },

    /** Moves notes to the trash, where they can be restored for a while. */
    async trash(ids: readonly string[]): Promise<void> {
      await notes.setDeletedAt(ids, clock.now());
      await syncMany(ids);
      onChanged();
    },

    /** Takes notes out of the trash (also what Undo does). */
    async restore(ids: readonly string[]): Promise<void> {
      await notes.setDeletedAt(ids, null);
      await syncMany(ids);
      onChanged();
    },

    deleteForever: destroy,

    async emptyTrash(): Promise<number> {
      const trashed = await notes.listTrashed(null);
      await destroy(trashed.map((note) => note.id));
      return trashed.length;
    },

    /** Removes notes that have been in the trash longer than the retention period. */
    async purgeExpired(): Promise<number> {
      const cutoff = clock.now() - TRASH_RETENTION_DAYS * DAY_MINUTES * MINUTE_MS;
      const expired = await notes.listTrashed(cutoff);
      await destroy(expired.map((note) => note.id));
      return expired.length;
    },

    /** Ticks or unticks a checklist line directly, e.g. from the preview. */
    async toggleTask(id: string, line: number): Promise<string | null> {
      const record = await notes.getRecord(id);
      if (record === null) {
        return null;
      }
      const body = toggleTask(record.body, line);
      if (body === record.body) {
        return body;
      }
      await notes.update({ ...record, body, updatedAt: clock.now() });
      onChanged();
      return body;
    },

    attachments(noteId: string): Promise<Attachment[]> {
      return attachments.listFor(noteId);
    },
  };
}

export type NoteUseCases = ReturnType<typeof createNoteUseCases>;

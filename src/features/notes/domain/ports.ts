import type {
  Attachment,
  Folder,
  FolderWithCount,
  NoteDetail,
  NoteRecord,
  NoteSummary,
} from './entities';
import type { NoteQuery, NoteSort } from './filters';
import type { LockConfig } from './lock';
import type { WidgetSnapshot } from './widget';

export interface NoteRepository {
  list(query: NoteQuery, sort: NoteSort, limit: number): Promise<NoteSummary[]>;
  /** The full note, whether or not it is archived or in the trash. */
  get(id: string): Promise<NoteDetail | null>;
  getRecord(id: string): Promise<NoteRecord | null>;
  /** Inserts a note, or replaces its fields and tags. */
  insert(record: NoteRecord): Promise<void>;
  update(record: NoteRecord): Promise<void>;
  setPinned(id: string, pinned: boolean): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  setLocked(id: string, locked: boolean): Promise<void>;
  setArchivedAt(ids: readonly string[], archivedAt: number | null): Promise<void>;
  setDeletedAt(ids: readonly string[], deletedAt: number | null): Promise<void>;
  setFolder(ids: readonly string[], folderId: string | null): Promise<void>;
  setReminder(id: string, reminderAt: number | null, notificationId: string | null): Promise<void>;
  /** Records for notes in the trash, optionally only those deleted before `cutoff`. */
  listTrashed(cutoff: number | null): Promise<NoteRecord[]>;
  getRecords(ids: readonly string[]): Promise<NoteRecord[]>;
  /** Permanently removes notes; their tags and attachment rows go with them. */
  delete(ids: readonly string[]): Promise<void>;
}

export interface FolderRepository {
  list(): Promise<FolderWithCount[]>;
  get(id: string): Promise<Folder | null>;
  insert(folder: Folder): Promise<void>;
  update(id: string, name: string, parentId: string | null): Promise<void>;
  /** Moves a folder's subfolders and notes to another folder (null for the top level). */
  moveContents(fromId: string, toParentId: string | null): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AttachmentRepository {
  listFor(noteId: string): Promise<Attachment[]>;
  listForNotes(noteIds: readonly string[]): Promise<Attachment[]>;
  get(id: string): Promise<Attachment | null>;
  insert(attachment: Attachment): Promise<void>;
  setSize(id: string, sizeBytes: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface PickedFile {
  uri: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

/** Lets the user choose a file from the device. Resolves to null when they cancel. */
export interface FilePicker {
  pick(mimeTypes: readonly string[]): Promise<PickedFile | null>;
}

/** Keeps attachment files in the app's own storage. Paths are relative to its document folder. */
export interface AttachmentStorage {
  /** Copies a file the user picked or recorded into app storage; returns its size in bytes. */
  copyIn(sourceUri: string, path: string): Promise<number>;
  writeText(path: string, content: string): Promise<number>;
  readText(path: string): Promise<string>;
  /** Missing files are ignored. */
  remove(paths: readonly string[]): Promise<void>;
  /** A URI the UI can display or open. */
  uriOf(path: string): string;
}

export interface ScheduledNoteReminder {
  noteId: string;
  title: string;
  body: string;
  fireAt: number;
}

export type ScheduleOutcome =
  { status: 'scheduled'; notificationId: string } | { status: 'blocked' };

export interface NoteReminderScheduler {
  schedule(reminder: ScheduledNoteReminder): Promise<ScheduleOutcome>;
  cancel(notificationId: string): Promise<void>;
}

/** Device authentication: fingerprint, face or the screen-lock PIN, pattern or password. */
export interface Authenticator {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}

export interface LockStore {
  read(): LockConfig;
  write(config: LockConfig): void;
}

/** Hands a summary of the notes to whatever draws a home screen widget. */
export interface WidgetPublisher {
  publish(snapshot: WidgetSnapshot): void;
}

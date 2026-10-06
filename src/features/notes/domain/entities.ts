import type { Category } from '@/core';

export type AttachmentKind = 'image' | 'pdf' | 'audio' | 'drawing';

export interface Attachment {
  id: string;
  noteId: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  /** Location of the file, relative to the app's document folder. */
  path: string;
  sizeBytes: number;
  /** Length of a voice recording. */
  durationMs: number | null;
  createdAt: number;
}

interface FolderRef {
  id: string;
  name: string;
}

/** A note as listed: enough to draw a card, without the whole body. */
export interface NoteSummary {
  id: string;
  title: string;
  /** One line of plain text from the start of the body; empty for locked notes. */
  preview: string;
  color: string | null;
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
  archivedAt: number | null;
  deletedAt: number | null;
  reminderAt: number | null;
  folder: FolderRef | null;
  tags: Category[];
  attachmentCount: number;
  checklistTotal: number;
  checklistDone: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteDetail {
  id: string;
  title: string;
  body: string;
  folder: FolderRef | null;
  color: string | null;
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
  archivedAt: number | null;
  deletedAt: number | null;
  reminderAt: number | null;
  notificationId: string | null;
  tags: Category[];
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
}

/** A note as stored. */
export interface NoteRecord {
  id: string;
  title: string;
  body: string;
  folderId: string | null;
  color: string | null;
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
  archivedAt: number | null;
  deletedAt: number | null;
  reminderAt: number | null;
  notificationId: string | null;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface FolderWithCount extends Folder {
  /** Notes directly in the folder that are neither archived nor in the trash. */
  noteCount: number;
}

export interface FolderNode extends FolderWithCount {
  /** 0 for a top-level folder. */
  depth: number;
  children: FolderNode[];
}

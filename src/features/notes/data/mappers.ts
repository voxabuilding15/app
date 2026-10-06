import type { Category } from '@/core';

import type {
  Attachment,
  AttachmentKind,
  Folder,
  FolderWithCount,
  NoteDetail,
  NoteRecord,
  NoteSummary,
} from '../domain/entities';
import { excerptOf } from '../domain/markdown';

const PREVIEW_LENGTH = 160;

export interface TagRow {
  note_id: string;
  id: string;
  name: string;
  color: string;
}

export function groupTags(rows: readonly TagRow[]): Map<string, Category[]> {
  const byNote = new Map<string, Category[]>();
  for (const row of rows) {
    byNote.set(row.note_id, [
      ...(byNote.get(row.note_id) ?? []),
      { id: row.id, name: row.name, color: row.color },
    ]);
  }
  return byNote;
}

interface NoteFlags {
  color: string | null;
  pinned: number;
  favorite: number;
  locked: number;
  archived_at: number | null;
  deleted_at: number | null;
  reminder_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SummaryRow extends NoteFlags {
  id: string;
  title: string;
  body_preview: string;
  folder_id: string | null;
  folder_name: string | null;
  attachment_count: number;
  check_total: number;
  check_done: number;
}

export function toSummary(row: SummaryRow, tags: Category[]): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    preview: excerptOf(row.body_preview, PREVIEW_LENGTH),
    color: row.color,
    pinned: row.pinned === 1,
    favorite: row.favorite === 1,
    locked: row.locked === 1,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    reminderAt: row.reminder_at,
    folder: row.folder_id === null ? null : { id: row.folder_id, name: row.folder_name ?? '' },
    tags,
    attachmentCount: row.attachment_count,
    checklistTotal: row.check_total,
    checklistDone: row.check_done,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RecordRow extends NoteFlags {
  id: string;
  title: string;
  body: string;
  folder_id: string | null;
  notification_id: string | null;
}

export function toRecord(row: RecordRow, tagIds: string[]): NoteRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    folderId: row.folder_id,
    color: row.color,
    pinned: row.pinned === 1,
    favorite: row.favorite === 1,
    locked: row.locked === 1,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    reminderAt: row.reminder_at,
    notificationId: row.notification_id,
    tagIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DetailRow extends RecordRow {
  folder_name: string | null;
}

export function toDetail(row: DetailRow, tags: Category[], attachments: Attachment[]): NoteDetail {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    folder: row.folder_id === null ? null : { id: row.folder_id, name: row.folder_name ?? '' },
    color: row.color,
    pinned: row.pinned === 1,
    favorite: row.favorite === 1,
    locked: row.locked === 1,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    reminderAt: row.reminder_at,
    notificationId: row.notification_id,
    tags,
    attachments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface FolderRow {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: number;
  note_count?: number;
}

export function toFolder(row: FolderRow): Folder {
  return { id: row.id, name: row.name, parentId: row.parent_id, createdAt: row.created_at };
}

export function toFolderWithCount(row: FolderRow): FolderWithCount {
  return { ...toFolder(row), noteCount: row.note_count ?? 0 };
}

export interface AttachmentRow {
  id: string;
  note_id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  path: string;
  size_bytes: number;
  duration_ms: number | null;
  created_at: number;
}

export function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    noteId: row.note_id,
    kind: row.kind,
    name: row.name,
    mime: row.mime,
    path: row.path,
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

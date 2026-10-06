import type { Category, Database } from '@/core';

import type { NoteDetail, NoteRecord, NoteSummary } from '../domain/entities';
import type { NoteQuery, NoteSort } from '../domain/filters';
import type { NoteRepository } from '../domain/ports';

import {
  groupTags,
  toAttachment,
  toDetail,
  toRecord,
  toSummary,
  type AttachmentRow,
  type DetailRow,
  type RecordRow,
  type SummaryRow,
  type TagRow,
} from './mappers';
import { SELECT_SUMMARY, buildOrderBy, buildWhere, placeholders } from './note-queries';

const RECORD_COLUMNS = `n.id, n.title, n.body, n.folder_id, n.color, n.pinned, n.favorite, n.locked,
  n.archived_at, n.deleted_at, n.reminder_at, n.notification_id, n.created_at, n.updated_at`;

export class SqliteNoteRepository implements NoteRepository {
  constructor(private readonly db: Database) {}

  async list(query: NoteQuery, sort: NoteSort, limit: number): Promise<NoteSummary[]> {
    const where = buildWhere(query);
    const rows = this.db.getAllSync<SummaryRow>(
      `${SELECT_SUMMARY} WHERE ${where.sql} ORDER BY ${buildOrderBy(sort, query.scope)} LIMIT ?`,
      [...where.params, limit],
    );
    const tags = this.tagsFor(rows.map((row) => row.id));
    return rows.map((row) => toSummary(row, tags.get(row.id) ?? []));
  }

  async get(id: string): Promise<NoteDetail | null> {
    const row = this.db.getFirstSync<DetailRow>(
      `SELECT ${RECORD_COLUMNS}, f.name AS folder_name
       FROM notes n LEFT JOIN folders f ON f.id = n.folder_id WHERE n.id = ?`,
      [id],
    );
    if (row === null) {
      return null;
    }
    const attachments = this.db.getAllSync<AttachmentRow>(
      `SELECT id, note_id, kind, name, mime, path, size_bytes, duration_ms, created_at
       FROM note_attachments WHERE note_id = ? ORDER BY created_at, rowid`,
      [id],
    );
    return toDetail(row, this.tagsFor([id]).get(id) ?? [], attachments.map(toAttachment));
  }

  async getRecord(id: string): Promise<NoteRecord | null> {
    const [record] = await this.getRecords([id]);
    return record ?? null;
  }

  async getRecords(ids: readonly string[]): Promise<NoteRecord[]> {
    return ids.length === 0 ? [] : this.records(`n.id IN (${placeholders(ids.length)})`, [...ids]);
  }

  async listTrashed(cutoff: number | null): Promise<NoteRecord[]> {
    return cutoff === null
      ? this.records('n.deleted_at IS NOT NULL', [])
      : this.records('n.deleted_at IS NOT NULL AND n.deleted_at < ?', [cutoff]);
  }

  async insert(record: NoteRecord): Promise<void> {
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `INSERT INTO notes (id, folder_id, title, body, color, pinned, favorite, locked, archived_at,
           deleted_at, reminder_at, notification_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.folderId,
          record.title,
          record.body,
          record.color,
          record.pinned ? 1 : 0,
          record.favorite ? 1 : 0,
          record.locked ? 1 : 0,
          record.archivedAt,
          record.deletedAt,
          record.reminderAt,
          record.notificationId,
          record.createdAt,
          record.updatedAt,
        ],
      );
      this.setTags(record);
    });
  }

  async update(record: NoteRecord): Promise<void> {
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `UPDATE notes SET folder_id = ?, title = ?, body = ?, color = ?, pinned = ?, favorite = ?,
           locked = ?, reminder_at = ?, updated_at = ? WHERE id = ?`,
        [
          record.folderId,
          record.title,
          record.body,
          record.color,
          record.pinned ? 1 : 0,
          record.favorite ? 1 : 0,
          record.locked ? 1 : 0,
          record.reminderAt,
          record.updatedAt,
          record.id,
        ],
      );
      this.db.runSync('DELETE FROM note_tags WHERE note_id = ?', [record.id]);
      this.setTags(record);
    });
  }

  async setPinned(id: string, pinned: boolean): Promise<void> {
    this.db.runSync('UPDATE notes SET pinned = ? WHERE id = ?', [pinned ? 1 : 0, id]);
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    this.db.runSync('UPDATE notes SET favorite = ? WHERE id = ?', [favorite ? 1 : 0, id]);
  }

  async setLocked(id: string, locked: boolean): Promise<void> {
    this.db.runSync('UPDATE notes SET locked = ? WHERE id = ?', [locked ? 1 : 0, id]);
  }

  async setArchivedAt(ids: readonly string[], archivedAt: number | null): Promise<void> {
    this.updateMany('archived_at', archivedAt, ids);
  }

  async setDeletedAt(ids: readonly string[], deletedAt: number | null): Promise<void> {
    this.updateMany('deleted_at', deletedAt, ids);
  }

  async setFolder(ids: readonly string[], folderId: string | null): Promise<void> {
    this.updateMany('folder_id', folderId, ids);
  }

  async setReminder(
    id: string,
    reminderAt: number | null,
    notificationId: string | null,
  ): Promise<void> {
    this.db.runSync('UPDATE notes SET reminder_at = ?, notification_id = ? WHERE id = ?', [
      reminderAt,
      notificationId,
      id,
    ]);
  }

  async delete(ids: readonly string[]): Promise<void> {
    if (ids.length > 0) {
      this.db.runSync(`DELETE FROM notes WHERE id IN (${placeholders(ids.length)})`, [...ids]);
    }
  }

  /** `column` is one of this class's fixed column names, never user input. */
  private updateMany(
    column: 'archived_at' | 'deleted_at' | 'folder_id',
    value: number | string | null,
    ids: readonly string[],
  ) {
    if (ids.length > 0) {
      this.db.runSync(`UPDATE notes SET ${column} = ? WHERE id IN (${placeholders(ids.length)})`, [
        value,
        ...ids,
      ]);
    }
  }

  private setTags(record: NoteRecord): void {
    for (const tagId of record.tagIds) {
      this.db.runSync('INSERT INTO note_tags (note_id, category_id) VALUES (?, ?)', [
        record.id,
        tagId,
      ]);
    }
  }

  private records(where: string, params: (string | number)[]): NoteRecord[] {
    const rows = this.db.getAllSync<RecordRow>(
      `SELECT ${RECORD_COLUMNS} FROM notes n WHERE ${where} ORDER BY n.updated_at DESC, n.rowid DESC`,
      params,
    );
    if (rows.length === 0) {
      return [];
    }
    const links = this.db.getAllSync<{ note_id: string; category_id: string }>(
      `SELECT note_id, category_id FROM note_tags WHERE note_id IN (${placeholders(rows.length)}) ORDER BY category_id`,
      rows.map((row) => row.id),
    );
    return rows.map((row) =>
      toRecord(
        row,
        links.filter((link) => link.note_id === row.id).map((link) => link.category_id),
      ),
    );
  }

  private tagsFor(ids: readonly string[]): Map<string, Category[]> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = this.db.getAllSync<TagRow>(
      `SELECT nt.note_id, c.id, c.name, c.color FROM note_tags nt
       JOIN categories c ON c.id = nt.category_id
       WHERE nt.note_id IN (${placeholders(ids.length)}) ORDER BY c.name COLLATE NOCASE`,
      [...ids],
    );
    return groupTags(rows);
  }
}

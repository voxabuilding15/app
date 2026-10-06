import type { Database } from '@/core';

import type { Attachment } from '../domain/entities';
import type { AttachmentRepository } from '../domain/ports';

import { toAttachment, type AttachmentRow } from './mappers';
import { placeholders } from './note-queries';

const COLUMNS = 'id, note_id, kind, name, mime, path, size_bytes, duration_ms, created_at';

export class SqliteAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: Database) {}

  async listFor(noteId: string): Promise<Attachment[]> {
    return this.listForNotes([noteId]);
  }

  async listForNotes(noteIds: readonly string[]): Promise<Attachment[]> {
    if (noteIds.length === 0) {
      return [];
    }
    const rows = this.db.getAllSync<AttachmentRow>(
      `SELECT ${COLUMNS} FROM note_attachments WHERE note_id IN (${placeholders(noteIds.length)})
       ORDER BY created_at, rowid`,
      [...noteIds],
    );
    return rows.map(toAttachment);
  }

  async get(id: string): Promise<Attachment | null> {
    const row = this.db.getFirstSync<AttachmentRow>(
      `SELECT ${COLUMNS} FROM note_attachments WHERE id = ?`,
      [id],
    );
    return row === null ? null : toAttachment(row);
  }

  async insert(attachment: Attachment): Promise<void> {
    this.db.runSync(
      `INSERT INTO note_attachments (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachment.id,
        attachment.noteId,
        attachment.kind,
        attachment.name,
        attachment.mime,
        attachment.path,
        attachment.sizeBytes,
        attachment.durationMs,
        attachment.createdAt,
      ],
    );
  }

  async setSize(id: string, sizeBytes: number): Promise<void> {
    this.db.runSync('UPDATE note_attachments SET size_bytes = ? WHERE id = ?', [sizeBytes, id]);
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM note_attachments WHERE id = ?', [id]);
  }
}

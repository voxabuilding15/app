import type { Database } from '@/core';

import type { Folder, FolderWithCount } from '../domain/entities';
import type { FolderRepository } from '../domain/ports';

import { toFolder, toFolderWithCount, type FolderRow } from './mappers';

export class SqliteFolderRepository implements FolderRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<FolderWithCount[]> {
    const rows = this.db.getAllSync<FolderRow>(
      `SELECT f.id, f.parent_id, f.name, f.created_at,
         (SELECT COUNT(*) FROM notes n
          WHERE n.folder_id = f.id AND n.archived_at IS NULL AND n.deleted_at IS NULL) AS note_count
       FROM folders f ORDER BY f.name COLLATE NOCASE, f.rowid`,
    );
    return rows.map(toFolderWithCount);
  }

  async get(id: string): Promise<Folder | null> {
    const row = this.db.getFirstSync<FolderRow>(
      'SELECT id, parent_id, name, created_at FROM folders WHERE id = ?',
      [id],
    );
    return row === null ? null : toFolder(row);
  }

  async insert(folder: Folder): Promise<void> {
    this.db.runSync('INSERT INTO folders (id, parent_id, name, created_at) VALUES (?, ?, ?, ?)', [
      folder.id,
      folder.parentId,
      folder.name,
      folder.createdAt,
    ]);
  }

  async update(id: string, name: string, parentId: string | null): Promise<void> {
    this.db.runSync('UPDATE folders SET name = ?, parent_id = ? WHERE id = ?', [
      name,
      parentId,
      id,
    ]);
  }

  async moveContents(fromId: string, toParentId: string | null): Promise<void> {
    this.db.withTransactionSync(() => {
      this.db.runSync('UPDATE folders SET parent_id = ? WHERE parent_id = ?', [toParentId, fromId]);
      this.db.runSync('UPDATE notes SET folder_id = ? WHERE folder_id = ?', [toParentId, fromId]);
    });
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM folders WHERE id = ?', [id]);
  }
}

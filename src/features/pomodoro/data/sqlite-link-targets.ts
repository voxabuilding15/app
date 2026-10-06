import type { Database } from '@/core';

import type { LinkTarget } from '../domain/entities';
import type { LinkTargets } from '../domain/ports';

/** The open tasks and active habits a focus session can be linked to. */
export class SqliteLinkTargets implements LinkTargets {
  constructor(private readonly db: Database) {}

  async tasks(): Promise<LinkTarget[]> {
    return this.db.getAllSync<LinkTarget>(
      `SELECT id, title FROM tasks
       WHERE completed_at IS NULL AND archived_at IS NULL AND deleted_at IS NULL
       ORDER BY (due_at IS NULL), due_at, title COLLATE NOCASE LIMIT 200`,
    );
  }

  async habits(): Promise<LinkTarget[]> {
    return this.db.getAllSync<LinkTarget>(
      `SELECT id, name AS title FROM habits
       WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE LIMIT 200`,
    );
  }
}

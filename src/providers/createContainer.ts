import type { Container } from '@/core';
import { SqliteCategoryRepository, getDatabase } from '@/database';
import { fileService } from '@/services/files';
import { notificationService } from '@/services/notifications';
import { kvStorage } from '@/services/storage';

/** Composition root: the only place where adapters are bound to core ports. */
export function createContainer(): Container {
  const clock = { now: () => Date.now() };
  const db = getDatabase();
  return {
    clock,
    db,
    categories: (kind) => new SqliteCategoryRepository(db, kind, clock.now),
    storage: kvStorage,
    notifications: notificationService,
    files: fileService,
  };
}

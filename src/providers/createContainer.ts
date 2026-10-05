import type { Container } from '@/core';
import { getDatabase } from '@/database';
import { notificationService } from '@/services/notifications';
import { kvStorage } from '@/services/storage';

/** Composition root: the only place where adapters are bound to core ports. */
export function createContainer(): Container {
  return {
    db: getDatabase(),
    storage: kvStorage,
    notifications: notificationService,
  };
}

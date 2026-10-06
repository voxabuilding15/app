import type { KeyValueStorage, NotificationService } from '@/core';

import type { RestoreEffects } from '../domain/ports';

/**
 * After a restore, notifications scheduled for the old data would point at things that may not
 * exist, so they are cleared, and a running Pomodoro timer (which may be linked to a task that
 * is gone) is stopped. Reminders come back as each item is next saved.
 */
export class DeviceRestoreEffects implements RestoreEffects {
  constructor(
    private readonly notifications: NotificationService,
    private readonly storage: KeyValueStorage,
  ) {}

  async afterRestore(): Promise<void> {
    this.storage.remove('pomodoro.timer');
    this.storage.remove('pomodoro.alerts');
    await this.notifications.cancelAll().catch(() => undefined);
  }
}

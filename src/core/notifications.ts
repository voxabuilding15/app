import type { NotificationService } from './ports';

/**
 * Makes sure notifications can be shown, asking the user the first time. Resolves to false when
 * they are blocked, so callers can save their data and report that reminders will not fire.
 */
export async function ensureNotificationPermission(service: NotificationService): Promise<boolean> {
  await service.initialize();
  const state = await service.getPermissionState();
  return (
    state === 'granted' ||
    (state === 'undetermined' && (await service.requestPermission()) === 'granted')
  );
}

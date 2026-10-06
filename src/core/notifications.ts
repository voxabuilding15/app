import type { NotificationService, ScheduleAtInput } from './ports';

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

type ReminderOutcome = { status: 'scheduled'; notificationId: string } | { status: 'blocked' };

/** Schedules one notification, or reports that the user has blocked notifications. */
export async function scheduleReminder(
  service: NotificationService,
  input: ScheduleAtInput,
): Promise<ReminderOutcome> {
  if (!(await ensureNotificationPermission(service))) {
    return { status: 'blocked' };
  }
  return { status: 'scheduled', notificationId: await service.scheduleAt(input) };
}

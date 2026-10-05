import { ensureNotificationPermission, type NotificationService } from '@/core';

import type { HabitReminder, HabitReminderScheduler, HabitScheduleOutcome } from '../domain/ports';

const ALL_DAYS = 7;

/** Schedules repeating daily or weekly habit reminders through the notification service. */
export class NotificationHabitReminderScheduler implements HabitReminderScheduler {
  constructor(private readonly notifications: NotificationService) {}

  async schedule(reminder: HabitReminder): Promise<HabitScheduleOutcome> {
    if (!(await ensureNotificationPermission(this.notifications))) {
      return { status: 'blocked' };
    }

    // Every day needs one repeating trigger; a subset of days needs one weekly trigger per day.
    const weekdays: (number | null)[] =
      reminder.weekdays.length === ALL_DAYS ? [null] : reminder.weekdays.map((day) => day + 1);

    const notificationIds = await Promise.all(
      weekdays.map((weekday) =>
        this.notifications.scheduleRecurring({
          title: reminder.title,
          body: reminder.body,
          hour: reminder.hour,
          minute: reminder.minute,
          weekday,
          channelId: 'habits',
          categoryId: 'habit',
          data: { habitId: reminder.habitId },
        }),
      ),
    );
    return { status: 'scheduled', notificationIds };
  }

  async cancel(notificationIds: readonly string[]): Promise<void> {
    await Promise.all(notificationIds.map((id) => this.notifications.cancel(id)));
  }
}

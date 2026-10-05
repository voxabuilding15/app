import { ensureNotificationPermission, type NotificationService } from '@/core';

import type { ReminderScheduler, ScheduledReminder, ScheduleOutcome } from '../domain/ports';

/** Delivers task reminders through the app's notification service. */
export class NotificationReminderScheduler implements ReminderScheduler {
  constructor(private readonly notifications: NotificationService) {}

  async schedule(reminder: ScheduledReminder): Promise<ScheduleOutcome> {
    if (!(await ensureNotificationPermission(this.notifications))) {
      return { status: 'blocked' };
    }

    const notificationId = await this.notifications.scheduleAt({
      title: reminder.title,
      body: reminder.body,
      date: new Date(reminder.fireAt),
      channelId: reminder.isAlarm ? 'alarms' : 'tasks',
      categoryId: reminder.isAlarm ? 'alarm' : 'reminder',
      data: { taskId: reminder.taskId },
    });
    return { status: 'scheduled', notificationId };
  }

  cancel(notificationId: string): Promise<void> {
    return this.notifications.cancel(notificationId);
  }
}

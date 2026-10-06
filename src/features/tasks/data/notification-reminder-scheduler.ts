import { scheduleReminder, type NotificationService } from '@/core';

import type { ReminderScheduler, ScheduledReminder, ScheduleOutcome } from '../domain/ports';

/** Delivers task reminders through the app's notification service. */
export class NotificationReminderScheduler implements ReminderScheduler {
  constructor(private readonly notifications: NotificationService) {}

  schedule(reminder: ScheduledReminder): Promise<ScheduleOutcome> {
    return scheduleReminder(this.notifications, {
      title: reminder.title,
      body: reminder.body,
      date: new Date(reminder.fireAt),
      channelId: reminder.isAlarm ? 'alarms' : 'tasks',
      categoryId: reminder.isAlarm ? 'alarm' : 'reminder',
      data: { taskId: reminder.taskId },
    });
  }

  cancel(notificationId: string): Promise<void> {
    return this.notifications.cancel(notificationId);
  }
}

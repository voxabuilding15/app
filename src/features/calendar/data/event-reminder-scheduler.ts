import { ensureNotificationPermission, type NotificationService } from '@/core';

import type {
  EventReminderScheduler,
  EventScheduleOutcome,
  ScheduledEventReminder,
} from '../domain/ports';

/** Schedules one notification per upcoming occurrence through the notification service. */
export class NotificationEventReminderScheduler implements EventReminderScheduler {
  constructor(private readonly notifications: NotificationService) {}

  async schedule(reminders: readonly ScheduledEventReminder[]): Promise<EventScheduleOutcome> {
    if (!(await ensureNotificationPermission(this.notifications))) {
      return { status: 'blocked' };
    }
    const notificationIds = await Promise.all(
      reminders.map((reminder) =>
        this.notifications.scheduleAt({
          title: reminder.title,
          body: reminder.body,
          date: new Date(reminder.fireAt),
          channelId: 'events',
          data: { eventId: reminder.eventId, occurrenceDate: reminder.occurrenceDate },
        }),
      ),
    );
    return { status: 'scheduled', notificationIds };
  }

  async cancel(notificationIds: readonly string[]): Promise<void> {
    await Promise.all(notificationIds.map((id) => this.notifications.cancel(id)));
  }
}

import { scheduleReminder, type NotificationService } from '@/core';

import type {
  NoteReminderScheduler,
  ScheduleOutcome,
  ScheduledNoteReminder,
} from '../domain/ports';

/** Schedules note reminders through the shared notification service. */
export class NotificationNoteReminderScheduler implements NoteReminderScheduler {
  constructor(private readonly notifications: NotificationService) {}

  schedule(reminder: ScheduledNoteReminder): Promise<ScheduleOutcome> {
    return scheduleReminder(this.notifications, {
      title: reminder.title,
      body: reminder.body,
      date: new Date(reminder.fireAt),
      channelId: 'notes',
      data: { noteId: reminder.noteId },
    });
  }

  cancel(notificationId: string): Promise<void> {
    return this.notifications.cancel(notificationId);
  }
}

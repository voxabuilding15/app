import * as Notifications from 'expo-notifications';

const NOTIFICATION_CATEGORIES = {
  reminder: 'reminder',
  alarm: 'alarm',
} as const;

const NOTIFICATION_ACTIONS = {
  complete: 'complete',
  snooze: 'snooze',
  dismiss: 'dismiss',
} as const;

export async function registerNotificationCategories(): Promise<void> {
  await Promise.all([
    Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.reminder, [
      {
        identifier: NOTIFICATION_ACTIONS.complete,
        buttonTitle: 'Complete',
        options: { opensAppToForeground: false },
      },
      {
        identifier: NOTIFICATION_ACTIONS.snooze,
        buttonTitle: 'Snooze',
        options: { opensAppToForeground: false },
      },
    ]),
    Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.alarm, [
      {
        identifier: NOTIFICATION_ACTIONS.snooze,
        buttonTitle: 'Snooze',
        options: { opensAppToForeground: false },
      },
      {
        identifier: NOTIFICATION_ACTIONS.dismiss,
        buttonTitle: 'Dismiss',
        options: { opensAppToForeground: false },
      },
    ]),
  ]);
}

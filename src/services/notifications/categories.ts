import * as Notifications from 'expo-notifications';

const NOTIFICATION_CATEGORIES = {
  reminder: 'reminder',
  alarm: 'alarm',
  habit: 'habit',
  timerRunning: 'timer-running',
  timerPaused: 'timer-paused',
} as const;

const NOTIFICATION_ACTIONS = {
  complete: 'complete',
  snooze: 'snooze',
  skip: 'skip',
  dismiss: 'dismiss',
  pause: 'pause',
  resume: 'resume',
  stop: 'stop',
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
    Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.habit, [
      {
        identifier: NOTIFICATION_ACTIONS.complete,
        buttonTitle: 'Done',
        options: { opensAppToForeground: false },
      },
      {
        identifier: NOTIFICATION_ACTIONS.skip,
        buttonTitle: 'Skip today',
        options: { opensAppToForeground: false },
      },
    ]),
    // The timer's controls open the app, which then applies the action: nothing else can run when
    // the app has been closed.
    Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.timerRunning, [
      {
        identifier: NOTIFICATION_ACTIONS.pause,
        buttonTitle: 'Pause',
        options: { opensAppToForeground: true },
      },
      {
        identifier: NOTIFICATION_ACTIONS.skip,
        buttonTitle: 'Skip',
        options: { opensAppToForeground: true },
      },
      {
        identifier: NOTIFICATION_ACTIONS.stop,
        buttonTitle: 'Stop',
        options: { opensAppToForeground: true },
      },
    ]),
    Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.timerPaused, [
      {
        identifier: NOTIFICATION_ACTIONS.resume,
        buttonTitle: 'Resume',
        options: { opensAppToForeground: true },
      },
      {
        identifier: NOTIFICATION_ACTIONS.stop,
        buttonTitle: 'Stop',
        options: { opensAppToForeground: true },
      },
    ]),
    Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.alarm, [
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
      {
        identifier: NOTIFICATION_ACTIONS.dismiss,
        buttonTitle: 'Dismiss',
        options: { opensAppToForeground: false },
      },
    ]),
  ]);
}

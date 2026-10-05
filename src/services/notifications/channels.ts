import * as Notifications from 'expo-notifications';

export const NOTIFICATION_CHANNELS = {
  default: 'default',
  tasks: 'tasks',
  habits: 'habits',
  expenses: 'expenses',
  pomodoro: 'pomodoro',
  summary: 'summary',
  alarms: 'alarms',
} as const;

export type NotificationChannelId =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

interface ChannelDefinition {
  id: NotificationChannelId;
  name: string;
  description: string;
  importance: Notifications.AndroidImportance;
  vibrationPattern: number[];
  bypassDnd?: boolean;
}

const STANDARD_VIBRATION = [0, 250, 250, 250];
const ALARM_VIBRATION = [0, 800, 400, 800, 400, 800];

const CHANNELS: readonly ChannelDefinition[] = [
  {
    id: NOTIFICATION_CHANNELS.default,
    name: 'General',
    description: 'General FocusFlow notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.tasks,
    name: 'Task reminders',
    description: 'Reminders for tasks that are due',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.habits,
    name: 'Habit reminders',
    description: 'Daily nudges to complete your habits',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.expenses,
    name: 'Expense reminders',
    description: 'Reminders to log expenses and review your budget',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.pomodoro,
    name: 'Pomodoro',
    description: 'Focus and break session alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.summary,
    name: 'Daily summary',
    description: 'A short overview of your day',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
  },
  {
    id: NOTIFICATION_CHANNELS.alarms,
    name: 'Alarms',
    description: 'Alarms that ring at an exact time',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: ALARM_VIBRATION,
    bypassDnd: true,
  },
];

export async function registerNotificationChannels(): Promise<void> {
  await Promise.all(
    CHANNELS.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: channel.importance,
        vibrationPattern: channel.vibrationPattern,
        bypassDnd: channel.bypassDnd ?? false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        lightColor: '#8937FE',
        enableVibrate: true,
      }),
    ),
  );
}

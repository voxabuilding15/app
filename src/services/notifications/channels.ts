import * as Notifications from 'expo-notifications';

import type { NotificationChannelId } from '@/core';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';

const NOTIFICATION_CHANNELS = {
  default: 'default',
  tasks: 'tasks',
  habits: 'habits',
  events: 'events',
  notes: 'notes',
  expenses: 'expenses',
  pomodoro: 'pomodoro',
  summary: 'summary',
  timer: 'timer',
  alarms: 'alarms',
} as const satisfies Record<NotificationChannelId, NotificationChannelId>;

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
    name: msg('General'),
    description: msg('General FocusFlow notifications'),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.tasks,
    name: msg('Task reminders'),
    description: msg('Reminders for tasks that are due'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.habits,
    name: msg('Habit reminders'),
    description: msg('Daily nudges to complete your habits'),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.events,
    name: msg('Event reminders'),
    description: msg('Reminders before calendar events'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.notes,
    name: msg('Note reminders'),
    description: msg('Reminders attached to your notes'),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.expenses,
    name: msg('Expense reminders'),
    description: msg('Reminders to log expenses and review your budget'),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.pomodoro,
    name: msg('Pomodoro'),
    description: msg('Focus and break session alerts'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: STANDARD_VIBRATION,
  },
  {
    id: NOTIFICATION_CHANNELS.summary,
    name: msg('Daily summary'),
    description: msg('A short overview of your day'),
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
  },
  {
    id: NOTIFICATION_CHANNELS.timer,
    name: msg('Running timer'),
    description: msg('The ongoing notification with timer controls'),
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
  },
  {
    id: NOTIFICATION_CHANNELS.alarms,
    name: msg('Alarms'),
    description: msg('Alarms that ring at an exact time'),
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: ALARM_VIBRATION,
    bypassDnd: true,
  },
];

export async function registerNotificationChannels(): Promise<void> {
  const { t } = currentTranslator();
  await Promise.all(
    CHANNELS.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: t(channel.name),
        description: t(channel.description),
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

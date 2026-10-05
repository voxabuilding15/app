import * as Notifications from 'expo-notifications';

import { registerNotificationCategories } from './categories';
import { NOTIFICATION_CHANNELS, registerNotificationChannels } from './channels';
import type { NotificationChannelId } from './channels';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface ScheduleAtInput {
  title: string;
  body: string;
  date: Date;
  channelId?: NotificationChannelId;
  categoryId?: string;
  data?: Record<string, string>;
}

export interface NotificationService {
  initialize(): Promise<void>;
  getPermissionState(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  scheduleAt(input: ScheduleAtInput): Promise<string>;
  cancel(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
}

function toPermissionState(response: Notifications.NotificationPermissionsStatus): PermissionState {
  if (response.granted) {
    return 'granted';
  }
  return response.canAskAgain ? 'undetermined' : 'denied';
}

class ExpoNotificationService implements NotificationService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    await registerNotificationChannels();
    await registerNotificationCategories();
  }

  async getPermissionState(): Promise<PermissionState> {
    return toPermissionState(await Notifications.getPermissionsAsync());
  }

  async requestPermission(): Promise<PermissionState> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return 'granted';
    }
    return toPermissionState(await Notifications.requestPermissionsAsync());
  }

  scheduleAt(input: ScheduleAtInput): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
        categoryIdentifier: input.categoryId,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.date,
        channelId: input.channelId ?? NOTIFICATION_CHANNELS.default,
      },
    });
  }

  cancel(identifier: string): Promise<void> {
    return Notifications.cancelScheduledNotificationAsync(identifier);
  }

  cancelAll(): Promise<void> {
    return Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const notificationService: NotificationService = new ExpoNotificationService();

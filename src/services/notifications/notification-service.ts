import * as Notifications from 'expo-notifications';

import type {
  NotificationActionId,
  NotificationResponse,
  NotificationService,
  PermissionState,
  ScheduleAtInput,
} from '@/core';

import { registerNotificationCategories } from './categories';
import { registerNotificationChannels } from './channels';

function toPermissionState(response: Notifications.NotificationPermissionsStatus): PermissionState {
  if (response.granted) {
    return 'granted';
  }
  return response.canAskAgain ? 'undetermined' : 'denied';
}

const KNOWN_ACTIONS: readonly NotificationActionId[] = ['complete', 'snooze', 'dismiss'];

function toResponse(response: Notifications.NotificationResponse): NotificationResponse {
  const actionId = KNOWN_ACTIONS.find((known) => known === response.actionIdentifier) ?? 'default';
  return { actionId, data: response.notification.request.content.data ?? {} };
}

async function setup(): Promise<void> {
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

class ExpoNotificationService implements NotificationService {
  private setupPromise: Promise<void> | null = null;

  initialize(): Promise<void> {
    if (this.setupPromise === null) {
      this.setupPromise = setup().catch((error: unknown) => {
        this.setupPromise = null;
        throw error;
      });
    }
    return this.setupPromise;
  }

  async getPermissionState(): Promise<PermissionState> {
    return toPermissionState(await Notifications.getPermissionsAsync());
  }

  async requestPermission(): Promise<PermissionState> {
    await this.initialize();
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
        channelId: input.channelId ?? 'default',
      },
    });
  }

  cancel(identifier: string): Promise<void> {
    return Notifications.cancelScheduledNotificationAsync(identifier);
  }

  cancelAll(): Promise<void> {
    return Notifications.cancelAllScheduledNotificationsAsync();
  }

  onResponse(listener: (response: NotificationResponse) => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      listener(toResponse(response)),
    );
    return () => subscription.remove();
  }

  consumeInitialResponse(): NotificationResponse | null {
    const response = Notifications.getLastNotificationResponse();
    if (response === null) {
      return null;
    }
    Notifications.clearLastNotificationResponse();
    return toResponse(response);
  }
}

export const notificationService: NotificationService = new ExpoNotificationService();

import * as Notifications from 'expo-notifications';

import type {
  NotificationActionId,
  NotificationResponse,
  NotificationService,
  PermissionState,
  PresentInput,
  ScheduleAtInput,
  ScheduleRecurringInput,
} from '@/core';

import { registerNotificationCategories } from './categories';
import { registerNotificationChannels } from './channels';
import { withPrivacy } from './privacy';

function toPermissionState(response: Notifications.NotificationPermissionsStatus): PermissionState {
  if (response.granted) {
    return 'granted';
  }
  return response.canAskAgain ? 'undetermined' : 'denied';
}

const KNOWN_ACTIONS: readonly NotificationActionId[] = [
  'complete',
  'snooze',
  'skip',
  'dismiss',
  'pause',
  'resume',
  'stop',
];

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

  scheduleAt(raw: ScheduleAtInput): Promise<string> {
    const input = withPrivacy(raw);
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

  scheduleRecurring(raw: ScheduleRecurringInput): Promise<string> {
    const input = withPrivacy(raw);
    const channelId = input.channelId ?? 'default';
    return Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
        categoryIdentifier: input.categoryId,
      },
      trigger:
        input.weekday === null
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: input.hour,
              minute: input.minute,
              channelId,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: input.weekday,
              hour: input.hour,
              minute: input.minute,
              channelId,
            },
    });
  }

  present(raw: PresentInput): Promise<string> {
    const input = withPrivacy(raw);
    return Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
        categoryIdentifier: input.categoryId,
        sticky: input.ongoing ?? false,
        autoDismiss: !(input.ongoing ?? false),
      },
      trigger: { channelId: input.channelId ?? 'default' },
    });
  }

  async cancel(identifier: string): Promise<void> {
    await Promise.all([
      Notifications.cancelScheduledNotificationAsync(identifier),
      Notifications.dismissNotificationAsync(identifier),
    ]);
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

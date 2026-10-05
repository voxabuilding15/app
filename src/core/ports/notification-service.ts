export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type NotificationChannelId =
  'default' | 'tasks' | 'habits' | 'expenses' | 'pomodoro' | 'summary' | 'alarms';

type NotificationCategoryId = 'reminder' | 'alarm';

export interface ScheduleAtInput {
  title: string;
  body: string;
  date: Date;
  channelId?: NotificationChannelId;
  categoryId?: NotificationCategoryId;
  data?: Record<string, string>;
}

/** What the user did with a delivered notification. `default` means they tapped it. */
export type NotificationActionId = 'default' | 'complete' | 'snooze' | 'dismiss';

export interface NotificationResponse {
  actionId: NotificationActionId;
  data: Record<string, unknown>;
}

export interface NotificationService {
  initialize(): Promise<void>;
  getPermissionState(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  scheduleAt(input: ScheduleAtInput): Promise<string>;
  cancel(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
  /** Subscribes to user responses (taps and action buttons). Returns an unsubscribe function. */
  onResponse(listener: (response: NotificationResponse) => void): () => void;
  /** The response that launched the app from a cold start, returned once. */
  consumeInitialResponse(): NotificationResponse | null;
}

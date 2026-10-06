export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type NotificationChannelId =
  | 'default'
  | 'tasks'
  | 'habits'
  | 'events'
  | 'notes'
  | 'expenses'
  | 'pomodoro'
  | 'summary'
  | 'alarms';

type NotificationCategoryId = 'reminder' | 'alarm' | 'habit';

export interface ScheduleAtInput {
  title: string;
  body: string;
  date: Date;
  channelId?: NotificationChannelId;
  categoryId?: NotificationCategoryId;
  data?: Record<string, string>;
}

export interface ScheduleRecurringInput {
  title: string;
  body: string;
  /** Local clock time of day. */
  hour: number;
  minute: number;
  /** 1 = Sunday ... 7 = Saturday for a weekly repeat, or null to repeat every day. */
  weekday: number | null;
  channelId?: NotificationChannelId;
  categoryId?: NotificationCategoryId;
  data?: Record<string, string>;
}

/** What the user did with a delivered notification. `default` means they tapped it. */
export type NotificationActionId = 'default' | 'complete' | 'snooze' | 'skip' | 'dismiss';

export interface NotificationResponse {
  actionId: NotificationActionId;
  data: Record<string, unknown>;
}

export interface NotificationService {
  initialize(): Promise<void>;
  getPermissionState(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  scheduleAt(input: ScheduleAtInput): Promise<string>;
  scheduleRecurring(input: ScheduleRecurringInput): Promise<string>;
  cancel(identifier: string): Promise<void>;
  cancelAll(): Promise<void>;
  /** Subscribes to user responses (taps and action buttons). Returns an unsubscribe function. */
  onResponse(listener: (response: NotificationResponse) => void): () => void;
  /** The response that launched the app from a cold start, returned once. */
  consumeInitialResponse(): NotificationResponse | null;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type NotificationChannelId =
  'default' | 'tasks' | 'habits' | 'expenses' | 'pomodoro' | 'summary' | 'alarms';

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

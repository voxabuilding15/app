import {
  ensureNotificationPermission,
  type Clock,
  type KeyValueStorage,
  type NotificationService,
} from '@/core';

import type { AlertOutcome, AlertPlan, PhaseAlerts } from '../domain/ports';

const IDS_KEY = 'pomodoro.alerts';

function readIds(storage: KeyValueStorage): string[] {
  const raw = storage.getString(IDS_KEY);
  if (raw === undefined) {
    return [];
  }
  try {
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Puts the timer on the notification shade through the shared notification service: an ongoing
 * notification with Pause / Skip / Stop buttons, plus one scheduled alert per upcoming phase end.
 * The alerts are scheduled with the system, so they fire even when the app has been killed. With
 * the exact-alarm setting they ring through the alarm channel, which is allowed to use exact alarms
 * and to break through Do Not Disturb.
 */
export class NotificationPhaseAlerts implements PhaseAlerts {
  constructor(
    private readonly notifications: NotificationService,
    private readonly storage: KeyValueStorage,
    private readonly clock: Clock,
  ) {}

  async sync(plan: AlertPlan | null): Promise<AlertOutcome> {
    await Promise.all(readIds(this.storage).map((id) => this.notifications.cancel(id)));
    this.storage.remove(IDS_KEY);
    if (plan === null) {
      return 'none';
    }
    if (!(await ensureNotificationPermission(this.notifications))) {
      return 'blocked';
    }

    const ids: string[] = [];
    const now = this.clock.now();
    for (const boundary of plan.boundaries) {
      if (boundary.at > now) {
        ids.push(
          await this.notifications.scheduleAt({
            title: boundary.title,
            body: boundary.body,
            date: new Date(boundary.at),
            channelId: plan.exact ? 'alarms' : 'pomodoro',
            data: { pomodoro: 'phase-end' },
          }),
        );
      }
    }
    ids.push(
      await this.notifications.present({
        title: plan.live.title,
        body: plan.live.body,
        channelId: 'timer',
        categoryId: plan.live.paused ? 'timer-paused' : 'timer-running',
        data: { pomodoro: 'timer' },
        ongoing: true,
      }),
    );
    this.storage.setString(IDS_KEY, JSON.stringify(ids));
    return 'scheduled';
  }
}

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type {
  NotificationResponse,
  NotificationService,
  PermissionState,
  PresentInput,
  ScheduleAtInput,
} from '@/core';
import { NotificationPhaseAlerts } from '@/features/pomodoro/data/notification-phase-alerts';
import { buildAlertPlan } from '@/features/pomodoro/domain/alerts';
import { DEFAULT_SETTINGS } from '@/features/pomodoro/domain/settings';
import { IDLE_STATE, startPhase } from '@/features/pomodoro/domain/timer';
import { SqliteSessionRepository } from '@/features/pomodoro/data/sqlite-session-repository';
import { SqliteLinkTargets } from '@/features/pomodoro/data/sqlite-link-targets';

import { createTestDatabase } from '../tasks/test-database';

import { at, memoryStorage, MINUTE } from './setup';

class FakeNotifications implements NotificationService {
  permission: PermissionState = 'granted';
  askResult: PermissionState = 'granted';
  scheduled: ScheduleAtInput[] = [];
  shown: PresentInput[] = [];
  cancelled: string[] = [];
  private next = 0;
  async initialize() {}
  async getPermissionState() {
    return this.permission;
  }
  async requestPermission() {
    this.permission = this.askResult;
    return this.askResult;
  }
  async scheduleAt(input: ScheduleAtInput) {
    this.scheduled.push(input);
    return `s${(this.next += 1)}`;
  }
  async scheduleRecurring(): Promise<string> {
    throw new Error('not used');
  }
  async present(input: PresentInput) {
    this.shown.push(input);
    return `p${(this.next += 1)}`;
  }
  async cancel(id: string) {
    this.cancelled.push(id);
  }
  async cancelAll() {}
  onResponse(_listener: (response: NotificationResponse) => void) {
    return () => undefined;
  }
  consumeInitialResponse() {
    return null;
  }
}

const NOW = at(2026, 10, 15, 9);
const clock = { now: () => NOW };
const planFor = (overrides: Partial<typeof DEFAULT_SETTINGS> = {}) => {
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  return buildAlertPlan(startPhase(IDLE_STATE, 'focus', NOW, settings), settings);
};

describe('phase alerts on the notification shade', () => {
  let notifications: FakeNotifications;
  let alerts: NotificationPhaseAlerts;
  beforeEach(() => {
    notifications = new FakeNotifications();
    alerts = new NotificationPhaseAlerts(notifications, memoryStorage(), clock);
  });

  it('shows an ongoing notification with controls and schedules the end of the phase', async () => {
    assert.equal(await alerts.sync(planFor()), 'scheduled');
    assert.equal(notifications.scheduled.length, 1);
    assert.deepEqual(
      [notifications.scheduled[0].channelId, notifications.scheduled[0].date.getTime()],
      ['pomodoro', NOW + 25 * MINUTE],
    );
    assert.deepEqual(
      [
        notifications.shown[0].ongoing,
        notifications.shown[0].categoryId,
        notifications.shown[0].channelId,
      ],
      [true, 'timer-running', 'timer'],
    );
  });

  it('rings through the alarm channel when exact alarms are on', async () => {
    await alerts.sync(planFor({ exactAlarm: true }));
    assert.equal(notifications.scheduled[0].channelId, 'alarms');
  });

  it('replaces the previous alerts and clears them for an idle timer', async () => {
    await alerts.sync(planFor());
    await alerts.sync(planFor({ focusMinutes: 30 }));
    assert.deepEqual(notifications.cancelled.sort(), ['p2', 's1']);
    notifications.cancelled = [];
    assert.equal(await alerts.sync(null), 'none');
    assert.deepEqual(notifications.cancelled.sort(), ['p4', 's3']);
    notifications.cancelled = [];
    await alerts.sync(null);
    assert.deepEqual(notifications.cancelled, []);
  });

  it('does not schedule alerts for moments that have already passed', async () => {
    const plan = planFor();
    assert.ok(plan);
    await alerts.sync({ ...plan, boundaries: [{ ...plan.boundaries[0], at: NOW - 1 }] });
    assert.equal(notifications.scheduled.length, 0);
    assert.equal(notifications.shown.length, 1);
  });

  it('asks for permission once and reports when it is refused', async () => {
    notifications.permission = 'undetermined';
    notifications.askResult = 'denied';
    assert.equal(await alerts.sync(planFor()), 'blocked');
    assert.equal(notifications.shown.length, 0);
    notifications.permission = 'denied';
    assert.equal(await alerts.sync(planFor()), 'blocked');
  });
});

describe('schema and queries', () => {
  it('constrains stored sessions', () => {
    const db = createTestDatabase();
    const insert = (kind: string, planned: number, duration: number, outcome: string) =>
      db.runSync(
        `INSERT INTO pomodoro_sessions (id, kind, planned_seconds, duration_seconds, started_at, ended_at, outcome)
         VALUES (?, ?, ?, ?, 1000, 2000, ?)`,
        [`id${Math.random()}`, kind, planned, duration, outcome],
      );
    insert('focus', 60, 0, 'stopped');
    assert.throws(() => insert('nap', 60, 60, 'completed'));
    assert.throws(() => insert('focus', 0, 60, 'completed'));
    assert.throws(() => insert('focus', 60, -1, 'completed'));
    assert.throws(() => insert('focus', 60, 60, 'abandoned'));
    assert.throws(() =>
      db.runSync(
        `INSERT INTO pomodoro_sessions (id, kind, planned_seconds, duration_seconds, started_at, ended_at, outcome)
         VALUES ('x', 'focus', 60, 60, 2000, 1000, 'completed')`,
      ),
    );
  });

  it('uses the right indexes', () => {
    const db = createTestDatabase();
    const plan = (sql: string, params: number[]) =>
      db
        .getAllSync<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params)
        .map((row) => row.detail)
        .join(' | ');
    assert.match(
      plan(
        `SELECT started_at FROM pomodoro_sessions
         WHERE kind = 'focus' AND started_at >= ? AND started_at < ?`,
        [0, 1],
      ),
      /idx_pomodoro_focus/,
    );
    assert.match(
      plan('SELECT id FROM pomodoro_sessions ORDER BY started_at DESC, rowid DESC LIMIT ?', [50]),
      /idx_pomodoro_started/,
    );
    assert.match(
      plan('SELECT id FROM pomodoro_sessions WHERE task_id = ?', [1]),
      /idx_pomodoro_task/,
    );
  });

  it('lists nothing for tasks and habits that do not exist', async () => {
    const db = createTestDatabase();
    const targets = new SqliteLinkTargets(db);
    assert.deepEqual(await targets.tasks(), []);
    assert.deepEqual(await targets.habits(), []);
    assert.deepEqual(await new SqliteSessionRepository(db).linkTotals(0, 1e15, 5), []);
  });
});

import { SqliteSessionRepository } from '@/features/pomodoro/data/sqlite-session-repository';
import type { SessionRecord } from '@/features/pomodoro/domain/entities';
import { DEFAULT_SETTINGS, type PomodoroSettings } from '@/features/pomodoro/domain/settings';
import { IDLE_STATE, startPhase, type TimerState } from '@/features/pomodoro/domain/timer';

import type { TestApp } from './harness';

const MINUTE = 60_000;

let counter = 0;

/** Saves a history entry directly, ending `minutesAgo` minutes ago. */
export async function addSession(
  app: TestApp,
  overrides: Partial<SessionRecord> & { minutesAgo?: number } = {},
): Promise<string> {
  const { minutesAgo = 60, ...rest } = overrides;
  const durationSeconds = rest.durationSeconds ?? 1500;
  const endedAt = Date.now() - minutesAgo * MINUTE;
  counter += 1;
  const record: SessionRecord = {
    id: `seed-${counter}`,
    kind: 'focus',
    plannedSeconds: durationSeconds,
    durationSeconds,
    startedAt: endedAt - durationSeconds * 1000,
    endedAt,
    outcome: 'completed',
    pauses: 0,
    deepFocus: 100,
    note: '',
    taskId: null,
    habitId: null,
    tagIds: [],
    ...rest,
  };
  await new SqliteSessionRepository(app.container.db).insert(record);
  return record.id;
}

export function saveSettings(app: TestApp, changes: Partial<PomodoroSettings>): void {
  app.container.storage.setString(
    'pomodoro.settings',
    JSON.stringify({ ...DEFAULT_SETTINGS, ...changes }),
  );
}

/** Stores a timer as if the app had been closed while it ran: it started `startedMinutesAgo` ago. */
export function storeRunningTimer(
  app: TestApp,
  startedMinutesAgo: number,
  settings: Partial<PomodoroSettings> = {},
  state: Partial<TimerState> = {},
): void {
  const all = { ...DEFAULT_SETTINGS, ...settings };
  const running = startPhase(IDLE_STATE, 'focus', Date.now() - startedMinutesAgo * MINUTE, all);
  app.container.storage.setString('pomodoro.timer', JSON.stringify({ ...running, ...state }));
}

import { createCategoryUseCases, createId, type KeyValueStorage } from '@/core';
import { SqliteCategoryRepository } from '@/database/category-repository';
import { SqliteLinkTargets } from '@/features/pomodoro/data/sqlite-link-targets';
import { SqliteSessionRepository } from '@/features/pomodoro/data/sqlite-session-repository';
import { StorageSettingsStore, StorageTimerStore } from '@/features/pomodoro/data/storage-adapters';
import type { AlertOutcome, AlertPlan, PhaseAlerts } from '@/features/pomodoro/domain/ports';
import { createSessionUseCases } from '@/features/pomodoro/domain/session-usecases';
import { createStatsUseCases } from '@/features/pomodoro/domain/stats-usecases';
import { createTimerUseCases } from '@/features/pomodoro/domain/timer-usecases';

import { createTestDatabase } from '../tasks/test-database';

export const at = (y: number, m: number, d: number, h = 12, min = 0, sec = 0) =>
  new Date(y, m - 1, d, h, min, sec).getTime();

export const MINUTE = 60_000;

export function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    setString: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}

class FakeAlerts implements PhaseAlerts {
  plans: (AlertPlan | null)[] = [];
  outcome: AlertOutcome = 'scheduled';
  fail = false;
  async sync(plan: AlertPlan | null): Promise<AlertOutcome> {
    if (this.fail) {
      throw new Error('notifications unavailable');
    }
    this.plans.push(plan);
    return plan === null ? 'none' : this.outcome;
  }
  get last(): AlertPlan | null | undefined {
    return this.plans.at(-1);
  }
}

/** The Pomodoro use cases on a fresh in-memory database, with a clock the test controls. */
export function createPomodoro(start = at(2026, 10, 15, 9)) {
  const state = { now: start };
  const clock = { now: () => state.now };
  const db = createTestDatabase();
  const storage = memoryStorage();
  const alerts = new FakeAlerts();

  const sessionRepository = new SqliteSessionRepository(db);
  const timerStore = new StorageTimerStore(storage);
  const settingsStore = new StorageSettingsStore(storage);
  const tags = createCategoryUseCases(new SqliteCategoryRepository(db, 'pomodoro', clock.now));

  const build = () =>
    createTimerUseCases({
      timers: new StorageTimerStore(storage),
      settings: settingsStore,
      sessions: sessionRepository,
      alerts,
      clock,
    });

  return {
    db,
    state,
    storage,
    alerts,
    timerStore,
    settingsStore,
    timer: build(),
    /** A second set of use cases over the same storage, as after the app was killed and reopened. */
    reopen: build,
    sessions: createSessionUseCases({
      sessions: sessionRepository,
      targets: new SqliteLinkTargets(db),
    }),
    stats: createStatsUseCases({ sessions: sessionRepository, clock }),
    repository: sessionRepository,
    tags,
    async addTag(name: string): Promise<string> {
      const saved = await tags.save({ id: null, name, color: '#112233' });
      if (!saved.ok) {
        throw new Error(saved.error);
      }
      return saved.id;
    },
    /** Moves the clock forward. */
    advance(minutes: number, seconds = 0) {
      state.now += minutes * MINUTE + seconds * 1000;
    },
    addTask(title: string, extra: { completed?: boolean; deleted?: boolean } = {}) {
      const id = createId();
      db.runSync(
        `INSERT INTO tasks (id, title, created_at, updated_at, completed_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          title,
          state.now,
          state.now,
          extra.completed === true ? state.now : null,
          extra.deleted === true ? state.now : null,
        ],
      );
      return id;
    },
    addHabit(name: string) {
      const id = createId();
      db.runSync(
        `INSERT INTO habits (id, name, icon, color, goal_period, created_at) VALUES (?, ?, 'star', '#000000', 'daily', ?)`,
        [id, name, state.now],
      );
      return id;
    },
  };
}

export type Pomodoro = ReturnType<typeof createPomodoro>;

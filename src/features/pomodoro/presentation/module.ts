import { createCategoryUseCases, useContainer, type Container } from '@/core';

import { NotificationPhaseAlerts } from '../data/notification-phase-alerts';
import { SqliteLinkTargets } from '../data/sqlite-link-targets';
import { SqliteSessionRepository } from '../data/sqlite-session-repository';
import { StorageSettingsStore, StorageTimerStore } from '../data/storage-adapters';
import { createSessionUseCases, type SessionUseCases } from '../domain/session-usecases';
import { createStatsUseCases, type StatsUseCases } from '../domain/stats-usecases';
import { createTimerUseCases, type TimerUseCases } from '../domain/timer-usecases';

export interface PomodoroModule {
  timer: TimerUseCases;
  sessions: SessionUseCases;
  stats: StatsUseCases;
  tags: ReturnType<typeof createCategoryUseCases>;
}

const modules = new WeakMap<Container, PomodoroModule>();

/** Wires the Pomodoro use cases to SQLite, key-value storage and notifications, once per container. */
export function getPomodoroModule(container: Container): PomodoroModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }

  const { db, clock, storage, notifications } = container;
  const repository = new SqliteSessionRepository(db);

  const module: PomodoroModule = {
    timer: createTimerUseCases({
      timers: new StorageTimerStore(storage),
      settings: new StorageSettingsStore(storage),
      sessions: repository,
      alerts: new NotificationPhaseAlerts(notifications, storage, clock),
      clock,
    }),
    sessions: createSessionUseCases({ sessions: repository, targets: new SqliteLinkTargets(db) }),
    stats: createStatsUseCases({ sessions: repository, clock }),
    tags: createCategoryUseCases(container.categories('pomodoro')),
  };
  modules.set(container, module);
  return module;
}

export function usePomodoroModule(): PomodoroModule {
  return getPomodoroModule(useContainer());
}

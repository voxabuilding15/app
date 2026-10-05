import { useContainer, type Container } from '@/core';

import { NotificationHabitReminderScheduler } from '../data/habit-reminder-scheduler';
import { SqliteHabitRepository } from '../data/sqlite-habit-repository';
import { createHabitUseCases, type HabitUseCases } from '../domain/usecases';

export interface HabitsModule {
  habits: HabitUseCases;
}

const modules = new WeakMap<Container, HabitsModule>();

/** Wires the Habits use cases to their SQLite and notification adapters, once per container. */
export function getHabitsModule(container: Container): HabitsModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }

  const module: HabitsModule = {
    habits: createHabitUseCases({
      habits: new SqliteHabitRepository(container.db),
      categories: container.categories('habit'),
      reminders: new NotificationHabitReminderScheduler(container.notifications),
      clock: container.clock,
    }),
  };
  modules.set(container, module);
  return module;
}

export function useHabitsModule(): HabitsModule {
  return getHabitsModule(useContainer());
}

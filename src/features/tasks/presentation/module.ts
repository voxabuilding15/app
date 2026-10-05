import { useContainer, type Container } from '@/core';

import { SqliteTaskRepository } from '../data/sqlite-task-repository';
import { SqliteLabelRepository } from '../data/sqlite-label-repository';
import { NotificationReminderScheduler } from '../data/notification-reminder-scheduler';
import {
  createTaskUseCases,
  createTaxonomyUseCases,
  type TaskUseCases,
  type TaxonomyUseCases,
} from '../domain/usecases';

export interface TasksModule {
  tasks: TaskUseCases;
  taxonomy: TaxonomyUseCases;
}

const modules = new WeakMap<Container, TasksModule>();

/** Wires the Tasks use cases to their SQLite and notification adapters, once per container. */
export function getTasksModule(container: Container): TasksModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }

  const module: TasksModule = {
    tasks: createTaskUseCases({
      tasks: new SqliteTaskRepository(container.db),
      reminders: new NotificationReminderScheduler(container.notifications),
      clock: container.clock,
    }),
    taxonomy: createTaxonomyUseCases({
      categories: container.categories('task'),
      labels: new SqliteLabelRepository(container.db),
    }),
  };
  modules.set(container, module);
  return module;
}

export function useTasksModule(): TasksModule {
  return getTasksModule(useContainer());
}

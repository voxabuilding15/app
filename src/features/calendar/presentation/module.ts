import { useContainer, type Container } from '@/core';

import { NotificationEventReminderScheduler } from '../data/event-reminder-scheduler';
import { SqliteEventRepository } from '../data/sqlite-event-repository';
import { SqliteHabitAgendaSource } from '../data/habit-agenda-source';
import { SqliteTaskAgendaSource } from '../data/task-agenda-source';
import { createCalendarUseCases, type CalendarUseCases } from '../domain/usecases';

export interface CalendarModule {
  calendar: CalendarUseCases;
}

const modules = new WeakMap<Container, CalendarModule>();

/** Wires the Calendar use cases to SQLite and notifications, once per container. */
export function getCalendarModule(container: Container): CalendarModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }

  const module: CalendarModule = {
    calendar: createCalendarUseCases({
      events: new SqliteEventRepository(container.db),
      categories: container.categories('event'),
      tasks: new SqliteTaskAgendaSource(container.db),
      habits: new SqliteHabitAgendaSource(container.db),
      reminders: new NotificationEventReminderScheduler(container.notifications),
      clock: container.clock,
    }),
  };
  modules.set(container, module);
  return module;
}

export function useCalendarModule(): CalendarModule {
  return getCalendarModule(useContainer());
}

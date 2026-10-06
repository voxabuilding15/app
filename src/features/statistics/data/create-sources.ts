import type { Container } from '@/core';

import { SqliteEventRepository } from '../../calendar/data/sqlite-event-repository';
import { SqliteAccountRepository } from '../../finance/data/sqlite-account-repository';
import { SqliteTransactionRepository } from '../../finance/data/sqlite-transaction-repository';
import { createSettingsUseCases } from '../../finance/domain/settings';
import { SqliteHabitRepository } from '../../habits/data/sqlite-habit-repository';
import { SqliteSessionRepository } from '../../pomodoro/data/sqlite-session-repository';
import type { StatsSources } from '../domain/ports';

import { SqliteNoteSource, SqliteTaskSource } from './sqlite-sources';

/**
 * Reads each feature through its own repository, so the figures always agree with what that
 * feature shows, and only the tasks and notes (which have no history views) have queries of
 * their own.
 */
export function createStatsSources({ db, storage }: Container): StatsSources {
  const habits = new SqliteHabitRepository(db);
  const transactions = new SqliteTransactionRepository(db);
  const settings = createSettingsUseCases({ storage, accounts: new SqliteAccountRepository(db) });
  const events = new SqliteEventRepository(db);
  const sessions = new SqliteSessionRepository(db);

  return {
    tasks: new SqliteTaskSource(db),
    habits: { entries: () => habits.list('active') },
    events: { listInRange: (from, to) => events.listInRange(from, to) },
    focus: { listFocus: (from, to) => sessions.listFocus(from, to) },
    money: {
      flow: (range) => transactions.flow(range),
      categoryTotals: (type, range) => transactions.categoryTotals(type, range),
      currency: settings.currency,
    },
    notes: new SqliteNoteSource(db),
  };
}

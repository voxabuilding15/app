import { createCategoryUseCases, useContainer, type Container } from '@/core';

import { SqliteAccountRepository } from '../data/sqlite-account-repository';
import { SqliteBudgetRepository } from '../data/sqlite-budget-repository';
import { SqliteRecurringRepository } from '../data/sqlite-recurring-repository';
import { SqliteTransactionRepository } from '../data/sqlite-transaction-repository';
import { createAccountUseCases, type AccountUseCases } from '../domain/account-usecases';
import { createBudgetUseCases, type BudgetUseCases } from '../domain/budget-usecases';
import { createRecurringUseCases, type RecurringUseCases } from '../domain/recurring-usecases';
import { createSettingsUseCases, type SettingsUseCases } from '../domain/settings';
import { createStatsUseCases, type StatsUseCases } from '../domain/stats-usecases';
import {
  createTransactionUseCases,
  type TransactionUseCases,
} from '../domain/transaction-usecases';

type CategoryUseCases = ReturnType<typeof createCategoryUseCases>;

export interface FinanceModule {
  accounts: AccountUseCases;
  transactions: TransactionUseCases;
  budgets: BudgetUseCases;
  recurring: RecurringUseCases;
  stats: StatsUseCases;
  settings: SettingsUseCases;
  expenseCategories: CategoryUseCases;
  incomeCategories: CategoryUseCases;
}

const modules = new WeakMap<Container, FinanceModule>();

/** Wires the Finance use cases to their SQLite adapters, once per container. */
export function getFinanceModule(container: Container): FinanceModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }

  const { db, clock } = container;
  const accountRepository = new SqliteAccountRepository(db);
  const transactionRepository = new SqliteTransactionRepository(db);
  const expenseCategories = container.categories('expense');

  const budgets = createBudgetUseCases({
    budgets: new SqliteBudgetRepository(db),
    transactions: transactionRepository,
    categories: expenseCategories,
    clock,
  });
  const module: FinanceModule = {
    accounts: createAccountUseCases({ accounts: accountRepository, clock }),
    transactions: createTransactionUseCases({
      transactions: transactionRepository,
      accounts: accountRepository,
      overspentBy: budgets.overspentBy,
      clock,
    }),
    budgets,
    recurring: createRecurringUseCases({
      recurring: new SqliteRecurringRepository(db),
      accounts: accountRepository,
      clock,
    }),
    stats: createStatsUseCases({ transactions: transactionRepository, clock }),
    settings: createSettingsUseCases({ storage: container.storage, accounts: accountRepository }),
    expenseCategories: createCategoryUseCases(expenseCategories),
    incomeCategories: createCategoryUseCases(container.categories('income')),
  };
  modules.set(container, module);
  return module;
}

export function useFinanceModule(): FinanceModule {
  return getFinanceModule(useContainer());
}

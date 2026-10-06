import { createCategoryUseCases, type KeyValueStorage } from '@/core';
import { SqliteCategoryRepository } from '@/database/category-repository';
import { SqliteAccountRepository } from '@/features/finance/data/sqlite-account-repository';
import { SqliteBudgetRepository } from '@/features/finance/data/sqlite-budget-repository';
import { SqliteRecurringRepository } from '@/features/finance/data/sqlite-recurring-repository';
import { SqliteTransactionRepository } from '@/features/finance/data/sqlite-transaction-repository';
import { createAccountUseCases } from '@/features/finance/domain/account-usecases';
import { createBudgetUseCases } from '@/features/finance/domain/budget-usecases';
import { createRecurringUseCases } from '@/features/finance/domain/recurring-usecases';
import { createSettingsUseCases } from '@/features/finance/domain/settings';
import { createStatsUseCases } from '@/features/finance/domain/stats-usecases';
import { createTransactionUseCases } from '@/features/finance/domain/transaction-usecases';
import type { AccountDraft, TransactionDraft } from '@/features/finance/domain/validation';

import { createTestDatabase } from '../tasks/test-database';

export const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    setString: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}

/** The Finance use cases on a fresh in-memory database, with a clock the test controls. */
export function createFinance(start = at(2026, 10, 15)) {
  const state = { now: start };
  const clock = { now: () => state.now };
  const db = createTestDatabase();
  const storage = memoryStorage();

  const accountRepository = new SqliteAccountRepository(db);
  const transactionRepository = new SqliteTransactionRepository(db);
  const expense = new SqliteCategoryRepository(db, 'expense', clock.now);
  const income = new SqliteCategoryRepository(db, 'income', clock.now);

  const budgets = createBudgetUseCases({
    budgets: new SqliteBudgetRepository(db),
    transactions: transactionRepository,
    categories: expense,
    clock,
  });
  return {
    db,
    state,
    storage,
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
    settings: createSettingsUseCases({ storage, accounts: accountRepository }),
    expenseCategories: createCategoryUseCases(expense),
    incomeCategories: createCategoryUseCases(income),
  };
}

export type Finance = ReturnType<typeof createFinance>;

export const accountDraft = (overrides: Partial<AccountDraft> = {}): AccountDraft => ({
  name: 'Wallet',
  type: 'cash',
  color: '#16A34A',
  initialBalanceMinor: 0,
  ...overrides,
});

export const transactionDraft = (
  accountId: string,
  overrides: Partial<TransactionDraft> = {},
): TransactionDraft => ({
  type: 'expense',
  amountMinor: 1000,
  accountId,
  toAccountId: null,
  categoryId: null,
  note: '',
  occurredAt: at(2026, 10, 10),
  ...overrides,
});

/** Saves and unwraps, failing the test when validation rejects the draft. */
export async function mustSave<T extends { ok: boolean }>(
  result: Promise<T>,
): Promise<Extract<T, { ok: true }>> {
  const saved = await result;
  if (!saved.ok) {
    throw new Error(`save failed: ${JSON.stringify(saved)}`);
  }
  return saved as Extract<T, { ok: true }>;
}

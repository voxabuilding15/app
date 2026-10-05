import { act } from '@testing-library/react-native';

import type { AccountType } from '@/features/finance/domain/entities';
import type {
  BudgetDraft,
  RecurringDraft,
  TransactionDraft,
} from '@/features/finance/domain/validation';

import type { TestApp } from './harness';

type Result = { ok: boolean };

async function must<T extends Result>(result: Promise<T>): Promise<Extract<T, { ok: true }>> {
  const saved = await result;
  if (!saved.ok) {
    throw new Error(`seed failed: ${JSON.stringify(saved)}`);
  }
  return saved as Extract<T, { ok: true }>;
}

/** Refreshes every mounted Finance query after seeding behind the screen's back. */
export const refresh = (app: TestApp) =>
  act(async () => {
    await app.client.invalidateQueries({ queryKey: ['finance'] });
  });

export async function addAccount(
  app: TestApp,
  name: string,
  options: { initial?: number; type?: AccountType; color?: string } = {},
): Promise<string> {
  const saved = await must(
    app.finance.accounts.save(
      {
        name,
        type: options.type ?? 'bank',
        color: options.color ?? '#2563EB',
        initialBalanceMinor: options.initial ?? 0,
      },
      null,
    ),
  );
  return saved.id;
}

export async function addTransaction(
  app: TestApp,
  accountId: string,
  overrides: Partial<TransactionDraft> = {},
): Promise<string> {
  const saved = await must(
    app.finance.transactions.save(
      {
        type: 'expense',
        amountMinor: 1_000,
        accountId,
        toAccountId: null,
        categoryId: null,
        note: '',
        occurredAt: Date.now(),
        ...overrides,
      },
      null,
    ),
  );
  return saved.id;
}

export async function addCategory(
  app: TestApp,
  name: string,
  kind: 'expense' | 'income' = 'expense',
  color = '#16A34A',
): Promise<string> {
  const cases = kind === 'expense' ? app.finance.expenseCategories : app.finance.incomeCategories;
  const saved = await must(cases.save({ id: null, name, color }));
  return saved.id;
}

export async function addBudget(
  app: TestApp,
  overrides: Partial<BudgetDraft> = {},
): Promise<string> {
  const saved = await must(
    app.finance.budgets.save(
      {
        name: 'Monthly',
        period: 'monthly',
        amountMinor: 10_000,
        startDate: null,
        endDate: null,
        categoryIds: [],
        ...overrides,
      },
      null,
    ),
  );
  return saved.id;
}

export async function addRecurring(
  app: TestApp,
  accountId: string,
  overrides: Partial<RecurringDraft> = {},
): Promise<string> {
  const saved = await must(
    app.finance.recurring.save(
      {
        type: 'expense',
        amountMinor: 900,
        accountId,
        toAccountId: null,
        categoryId: null,
        note: 'Rent',
        rule: { unit: 'month', interval: 1, weekdays: 0 },
        // Far in the future, so seeding does not post anything unless a test asks for it.
        startDate: '2099-01-01',
        endDate: null,
        ...overrides,
      },
      null,
    ),
  );
  return saved.id;
}

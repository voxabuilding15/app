import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { budgetCovers, budgetDays, budgetProgress } from '@/features/finance/domain/budgets';
import type { Budget } from '@/features/finance/domain/entities';
import {
  DEFAULT_FILTER,
  countActiveFilters,
  dayRange,
  presetRange,
} from '@/features/finance/domain/filters';
import {
  cashflowSeries,
  compareCategories,
  monthRanges,
  percentChange,
  rankCategories,
} from '@/features/finance/domain/stats';
import {
  validateAccount,
  validateBudget,
  validateRecurring,
  validateTransaction,
  type TransactionDraft,
} from '@/features/finance/domain/validation';

import { at } from './setup';

describe('presetRange', () => {
  const now = at(2026, 10, 15, 14, 30); // Thursday

  it('covers whole local days', () => {
    assert.deepEqual(presetRange('today', now), {
      from: at(2026, 10, 15, 0),
      to: at(2026, 10, 16, 0),
    });
    assert.equal(presetRange('all', now), null);
  });

  it('starts the week on Monday and ends on Sunday', () => {
    assert.deepEqual(presetRange('week', now), {
      from: at(2026, 10, 12, 0),
      to: at(2026, 10, 19, 0),
    });
    // On a Sunday the week still began six days earlier.
    assert.deepEqual(presetRange('week', at(2026, 10, 18, 23)), {
      from: at(2026, 10, 12, 0),
      to: at(2026, 10, 19, 0),
    });
    assert.deepEqual(presetRange('week', at(2026, 10, 19, 0, 1)), {
      from: at(2026, 10, 19, 0),
      to: at(2026, 10, 26, 0),
    });
  });

  it('covers this month, last month and the year, across year boundaries', () => {
    assert.deepEqual(presetRange('month', now), {
      from: at(2026, 10, 1, 0),
      to: at(2026, 11, 1, 0),
    });
    assert.deepEqual(presetRange('lastMonth', now), {
      from: at(2026, 9, 1, 0),
      to: at(2026, 10, 1, 0),
    });
    assert.deepEqual(presetRange('lastMonth', at(2026, 1, 10)), {
      from: at(2025, 12, 1, 0),
      to: at(2026, 1, 1, 0),
    });
    assert.deepEqual(presetRange('month', at(2024, 2, 29)), {
      from: at(2024, 2, 1, 0),
      to: at(2024, 3, 1, 0),
    });
    assert.deepEqual(presetRange('year', now), { from: at(2026, 1, 1, 0), to: at(2027, 1, 1, 0) });
  });

  it('counts a day range inclusively', () => {
    assert.deepEqual(dayRange('2026-03-28', '2026-03-29'), {
      from: at(2026, 3, 28, 0),
      to: at(2026, 3, 30, 0),
    });
  });
});

describe('countActiveFilters', () => {
  it('counts each active filter once and ignores search', () => {
    assert.equal(countActiveFilters(DEFAULT_FILTER), 0);
    assert.equal(countActiveFilters({ ...DEFAULT_FILTER, search: 'x' }), 0);
    assert.equal(
      countActiveFilters({
        search: '',
        types: ['income', 'expense'],
        accountId: 'a',
        categoryId: 'c',
        range: 'week',
      }),
      4,
    );
  });
});

describe('budgets', () => {
  const budget = (overrides: Partial<Budget> = {}): Budget => ({
    id: 'b',
    name: 'B',
    period: 'monthly',
    amountMinor: 10_000,
    startDate: null,
    endDate: null,
    categoryIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  });

  it('works out the days a budget covers', () => {
    assert.deepEqual(budgetDays(budget(), '2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(budgetDays(budget(), '2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
    assert.deepEqual(budgetDays(budget({ period: 'weekly' }), '2026-10-18'), {
      from: '2026-10-12',
      to: '2026-10-18',
    });
    assert.deepEqual(budgetDays(budget({ period: 'weekly' }), '2026-10-19'), {
      from: '2026-10-19',
      to: '2026-10-25',
    });
    assert.deepEqual(
      budgetDays(
        budget({ period: 'custom', startDate: '2026-05-01', endDate: '2026-05-09' }),
        '2030-01-01',
      ),
      { from: '2026-05-01', to: '2026-05-09' },
    );
  });

  it('switches to warning at 80% and to over only past the limit', () => {
    const state = (spent: number) =>
      budgetProgress(budget({ amountMinor: 100 }), [], spent, '2026-10-15').state;
    assert.equal(state(0), 'ok');
    assert.equal(state(79), 'ok');
    assert.equal(state(80), 'warning');
    assert.equal(state(100), 'warning');
    assert.equal(state(101), 'over');
  });

  it('derives remaining, fraction and phase', () => {
    const p = budgetProgress(
      budget(),
      [{ id: 'c', name: 'C', color: '#000' }],
      12_500,
      '2026-10-15',
    );
    assert.deepEqual(
      [p.remainingMinor, p.fraction, p.state, p.phase],
      [-2_500, 1.25, 'over', 'active'],
    );
    assert.deepEqual(p.categories, []);
    const custom = budget({
      period: 'custom',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      categoryIds: ['c'],
    });
    const upcoming = budgetProgress(
      custom,
      [{ id: 'c', name: 'C', color: '#000' }],
      0,
      '2026-10-15',
    );
    assert.deepEqual([upcoming.phase, upcoming.categories.length], ['upcoming', 1]);
    assert.equal(budgetProgress(custom, [], 0, '2026-11-03').phase, 'ended');
  });

  it('matches categories, and every expense when none are chosen', () => {
    assert.equal(budgetCovers({ categoryIds: [] }, null), true);
    assert.equal(budgetCovers({ categoryIds: [] }, 'x'), true);
    assert.equal(budgetCovers({ categoryIds: ['a'] }, 'a'), true);
    assert.equal(budgetCovers({ categoryIds: ['a'] }, 'b'), false);
    assert.equal(budgetCovers({ categoryIds: ['a'] }, null), false);
  });
});

describe('statistics helpers', () => {
  const row = (name: string, totalMinor: number, id: string | null = name) => ({
    id,
    name,
    color: '#000',
    totalMinor,
  });

  it('lists the months ending with the current one, across a year boundary', () => {
    const months = monthRanges('2026-01-20', 3);
    assert.deepEqual(
      months.map((m) => m.month),
      ['2025-11', '2025-12', '2026-01'],
    );
    assert.equal(months[0]?.range.to, months[1]?.range.from, 'months are contiguous');
    assert.equal(months[2]?.range.to, at(2026, 2, 1, 0));
  });

  it('ranks categories and folds the tail into Other', () => {
    assert.deepEqual(rankCategories([], 5), []);
    assert.deepEqual(rankCategories([row('A', 0), row('B', -5)], 5), []);
    const ranked = rankCategories([row('B', 200), row('A', 300), row('C', 100), row('D', 50)], 3);
    assert.deepEqual(
      ranked.map((s) => [s.name, s.totalMinor]),
      [
        ['A', 300],
        ['B', 200],
        ['Other', 150],
      ],
    );
    assert.ok(Math.abs(ranked.reduce((sum, s) => sum + s.share, 0) - 1) < 1e-9);
    assert.equal(rankCategories([row('A', 1), row('B', 1)], 2).length, 2, 'fits without folding');
  });

  it('compares periods, biggest swings first, with ties by name', () => {
    const changes = compareCategories(
      [row('Food', 500), row('New', 100, 'n'), row('Same', 50)],
      [row('Food', 300), row('Gone', 400), row('Same', 50)],
    );
    assert.deepEqual(
      changes.map((c) => [c.name, c.deltaMinor]),
      [
        ['Gone', -400],
        ['Food', 200],
        ['New', 100],
        ['Same', 0],
      ],
    );
    assert.equal(compareCategories([row('A', 10), row('B', -10)], []).length, 2);
    assert.deepEqual(compareCategories([], []), []);
  });

  it('builds a cumulative cashflow', () => {
    const months = monthRanges('2026-03-01', 3).map((m, index) => ({
      ...m,
      incomeMinor: [100, 50, 80][index] ?? 0,
      expenseMinor: [30, 90, 80][index] ?? 0,
    }));
    assert.deepEqual(
      cashflowSeries(months).map((p) => [p.netMinor, p.cumulativeMinor]),
      [
        [70, 70],
        [-40, 30],
        [0, 30],
      ],
    );
  });

  it('computes a percent change only when there is a basis', () => {
    assert.equal(percentChange(150, 100), 0.5);
    assert.equal(percentChange(50, 100), -0.5);
    assert.equal(percentChange(5, 0), null);
  });
});

describe('validation', () => {
  const transaction = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
    type: 'expense',
    amountMinor: 100,
    accountId: 'a',
    toAccountId: null,
    categoryId: null,
    note: '',
    occurredAt: 1,
    ...overrides,
  });

  it('accepts a valid transaction and explains each problem otherwise', () => {
    assert.deepEqual(validateTransaction(transaction()), {});
    assert.equal(
      validateTransaction(transaction({ amountMinor: null })).amount,
      'Enter an amount greater than zero',
    );
    assert.equal(
      validateTransaction(transaction({ amountMinor: 1e13 })).amount,
      'This amount is too large',
    );
    assert.equal(
      validateTransaction(transaction({ accountId: null })).account,
      'Choose an account',
    );
    const transfer = transaction({ type: 'transfer', accountId: null });
    assert.equal(validateTransaction(transfer).account, 'Choose the account to move money from');
    assert.equal(
      validateTransaction(transaction({ type: 'transfer' })).toAccount,
      'Choose the account to move money to',
    );
    assert.equal(
      validateTransaction(transaction({ type: 'transfer', toAccountId: 'a' })).toAccount,
      'Choose a different account',
    );
    assert.deepEqual(validateTransaction(transaction({ type: 'transfer', toAccountId: 'b' })), {});
    assert.ok(validateTransaction(transaction({ note: 'x'.repeat(501) })).note);
    assert.equal(
      validateTransaction(transaction({ occurredAt: Number.NaN })).date,
      'Choose a date',
    );
  });

  it('validates accounts and budgets', () => {
    assert.deepEqual(
      validateAccount({ name: 'Ok', type: 'bank', color: '#000', initialBalanceMinor: -5 }),
      {},
    );
    assert.ok(
      validateAccount({ name: 'Ok', type: 'bank', color: '#000', initialBalanceMinor: 1e13 })
        .balance,
    );
    assert.ok(
      validateAccount({ name: 'Ok', type: 'bank', color: '#000', initialBalanceMinor: 1.5 })
        .balance,
    );
    assert.deepEqual(
      validateBudget({
        name: 'B',
        period: 'weekly',
        amountMinor: 1,
        startDate: null,
        endDate: null,
        categoryIds: [],
      }),
      {},
    );
    assert.ok(
      validateBudget({
        name: 'B',
        period: 'custom',
        amountMinor: 1,
        startDate: '2026-02-30x',
        endDate: '2026-03-01',
        categoryIds: [],
      }).dates,
    );
    assert.deepEqual(
      validateBudget({
        name: 'B',
        period: 'custom',
        amountMinor: 1,
        startDate: '2026-03-01',
        endDate: '2026-03-01',
        categoryIds: [],
      }),
      {},
    );
  });

  it('validates recurring rules', () => {
    const base = {
      type: 'expense' as const,
      amountMinor: 1,
      accountId: 'a',
      toAccountId: null,
      categoryId: null,
      note: '',
      rule: { unit: 'month' as const, interval: 1, weekdays: 0 },
      startDate: '2026-01-31',
      endDate: null,
    };
    assert.deepEqual(validateRecurring(base), {});
    assert.ok(validateRecurring({ ...base, rule: { ...base.rule, interval: 1.5 } }).repeat);
    assert.ok(validateRecurring({ ...base, rule: { ...base.rule, weekdays: -1 } }).repeat);
    assert.ok(validateRecurring({ ...base, endDate: '2026-01-30' }).dates);
    assert.deepEqual(validateRecurring({ ...base, endDate: '2026-01-31' }), {});
  });
});

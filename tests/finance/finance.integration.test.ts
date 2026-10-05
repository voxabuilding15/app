import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { NO_CATEGORY, weekdayBit } from '@/core';
import { AccountInUseError, totalBalanceMinor } from '@/features/finance/domain/account-usecases';
import { DEFAULT_FILTER, DEFAULT_SORT } from '@/features/finance/domain/filters';
import type { BudgetDraft, RecurringDraft } from '@/features/finance/domain/validation';

import { accountDraft, at, createFinance, mustSave, transactionDraft, type Finance } from './setup';

let f: Finance;
beforeEach(() => {
  f = createFinance(at(2026, 10, 15)); // a Thursday
});

async function wallet(initial = 0, name = 'Wallet') {
  const saved = await mustSave(
    f.accounts.save(accountDraft({ name, initialBalanceMinor: initial }), null),
  );
  return saved.id;
}

const balances = async () =>
  Object.fromEntries((await f.accounts.list(true)).map((a) => [a.name, a.balanceMinor]));

describe('accounts', () => {
  it('computes balances from the opening balance, income, expenses and transfers', async () => {
    const a = await wallet(10_000, 'A');
    const b = await wallet(0, 'B');
    await mustSave(
      f.transactions.save(transactionDraft(a, { type: 'income', amountMinor: 5_000 }), null),
    );
    await mustSave(
      f.transactions.save(transactionDraft(a, { type: 'expense', amountMinor: 1_500 }), null),
    );
    await mustSave(
      f.transactions.save(
        transactionDraft(a, { type: 'transfer', amountMinor: 2_000, toAccountId: b }),
        null,
      ),
    );
    assert.deepEqual(await balances(), { A: 11_500, B: 2_000 });
  });

  it('allows a negative opening balance for debt and reports the total of active accounts', async () => {
    await wallet(30_000, 'Bank');
    const card = await mustSave(
      f.accounts.save(
        accountDraft({ name: 'Card', type: 'credit_card', initialBalanceMinor: -12_000 }),
        null,
      ),
    );
    assert.equal(totalBalanceMinor(await f.accounts.list()), 18_000);
    await f.accounts.setArchived(card.id, true);
    assert.equal(totalBalanceMinor(await f.accounts.list(true)), 30_000);
  });

  it('hides archived accounts until asked, and can unarchive them', async () => {
    const id = await wallet(0, 'Old');
    await wallet(0, 'New');
    await f.accounts.setArchived(id, true);
    assert.deepEqual(
      (await f.accounts.list()).map((a) => a.name),
      ['New'],
    );
    assert.deepEqual(
      (await f.accounts.list(true)).map((a) => a.name),
      ['New', 'Old'],
    );
    await f.accounts.setArchived(id, false);
    assert.equal((await f.accounts.list()).length, 2);
  });

  it('validates names and balances and rejects duplicates ignoring case', async () => {
    await wallet(0, 'Wallet');
    const dup = await f.accounts.save(accountDraft({ name: ' wallet ' }), null);
    assert.deepEqual(dup, { ok: false, errors: { name: 'This name is already in use' } });
    const empty = await f.accounts.save(
      accountDraft({ name: '  ', initialBalanceMinor: null }),
      null,
    );
    assert.deepEqual(empty, {
      ok: false,
      errors: { name: 'Enter a name', balance: 'Enter a valid balance' },
    });
    const long = await f.accounts.save(accountDraft({ name: 'x'.repeat(41) }), null);
    assert.equal(long.ok, false);
  });

  it('edits an account without tripping over its own name', async () => {
    const id = await wallet(0, 'Wallet');
    await mustSave(
      f.accounts.save(accountDraft({ name: 'WALLET', type: 'bank', initialBalanceMinor: 700 }), id),
    );
    const [only] = await f.accounts.list();
    assert.equal(only?.name, 'WALLET');
    assert.equal(only?.type, 'bank');
    assert.equal(only?.balanceMinor, 700);
    await assert.rejects(f.accounts.save(accountDraft({ name: 'Other' }), 'missing'));
  });

  it('deletes an unused account and can restore it exactly', async () => {
    const id = await wallet(500, 'Wallet');
    const removed = await f.accounts.remove(id);
    assert.equal((await f.accounts.list(true)).length, 0);
    await f.accounts.restore(removed);
    const [back] = await f.accounts.list(true);
    assert.equal(back?.id, id);
    assert.equal(back?.balanceMinor, 500);
    assert.equal(back?.createdAt, removed.createdAt);
  });

  it('refuses to delete an account that transactions or recurring rules use', async () => {
    const used = await wallet(0, 'Used');
    const ruled = await wallet(0, 'Ruled');
    await mustSave(f.transactions.save(transactionDraft(used), null));
    await assert.rejects(f.accounts.remove(used), AccountInUseError);
    await mustSave(f.recurring.save(recurringDraft(ruled, { startDate: '2026-12-01' }), null));
    await assert.rejects(f.accounts.remove(ruled), AccountInUseError);
    assert.equal((await f.accounts.list()).length, 2);
  });
});

describe('transactions', () => {
  it('stores and lists a transaction with its account and category names', async () => {
    const id = await wallet(0, 'Cash');
    const cat = await mustSave(f.expenseCategories.save({ id: null, name: 'Food', color: '#f00' }));
    const saved = await mustSave(
      f.transactions.save(
        transactionDraft(id, { amountMinor: 1250, categoryId: cat.id, note: ' Lunch ' }),
        null,
      ),
    );
    const [row] = await f.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 10);
    assert.equal(row?.id, saved.id);
    assert.equal(row?.amountMinor, 1250);
    assert.equal(row?.note, 'Lunch');
    assert.deepEqual(row?.category, { id: cat.id, name: 'Food', color: '#f00' });
    assert.equal(row?.account.name, 'Cash');
    assert.equal(row?.toAccount, null);
  });

  it('reports validation problems without saving', async () => {
    const a = await wallet();
    const b = await wallet(0, 'B');
    const save = (overrides: Parameters<typeof transactionDraft>[1]) =>
      f.transactions.save(transactionDraft(a, overrides), null);

    assert.deepEqual(await save({ amountMinor: null }), {
      ok: false,
      errors: { amount: 'Enter an amount greater than zero' },
    });
    assert.equal((await save({ amountMinor: 0 })).ok, false);
    assert.equal((await save({ amountMinor: -5 })).ok, false);
    assert.equal((await save({ amountMinor: 1.5 })).ok, false);
    assert.equal((await save({ amountMinor: 2e12 })).ok, false);
    assert.equal((await save({ accountId: null })).ok, false);
    assert.equal((await save({ type: 'transfer' })).ok, false, 'a transfer needs a destination');
    assert.equal((await save({ type: 'transfer', toAccountId: a })).ok, false, 'not to itself');
    assert.equal((await save({ note: 'x'.repeat(501) })).ok, false);
    assert.equal((await save({ occurredAt: Number.NaN })).ok, false);
    assert.equal((await save({ accountId: 'ghost' })).ok, false);
    assert.equal((await f.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 10)).length, 0);
    assert.ok((await save({ type: 'transfer', toAccountId: b })).ok);
  });

  it('drops the category from transfers and keeps links when edited', async () => {
    const a = await wallet();
    const b = await wallet(0, 'B');
    const cat = await mustSave(f.expenseCategories.save({ id: null, name: 'Food', color: '#f00' }));
    const { id } = await mustSave(
      f.transactions.save(transactionDraft(a, { categoryId: cat.id }), null),
    );
    const before = await f.transactions.get(id);

    await f.transactions.save(
      transactionDraft(a, {
        type: 'transfer',
        toAccountId: b,
        categoryId: cat.id,
        amountMinor: 700,
      }),
      id,
    );
    const after = await f.transactions.get(id);
    assert.equal(after?.categoryId, null);
    assert.equal(after?.toAccountId, b);
    assert.equal(after?.createdAt, before?.createdAt);

    await f.transactions.save(transactionDraft(a, { amountMinor: 900, categoryId: cat.id }), id);
    const back = await f.transactions.get(id);
    assert.equal(back?.toAccountId, null);
    assert.equal(back?.categoryId, cat.id);
    await assert.rejects(f.transactions.save(transactionDraft(a), 'ghost'));
  });

  it('keeps archived accounts out of new transactions but lets old ones be edited', async () => {
    const a = await wallet();
    const { id } = await mustSave(f.transactions.save(transactionDraft(a), null));
    await f.accounts.setArchived(a, true);

    const fresh = await f.transactions.save(transactionDraft(a), null);
    assert.deepEqual(fresh, { ok: false, errors: { account: 'This account is archived' } });
    assert.ok((await f.transactions.save(transactionDraft(a, { amountMinor: 2000 }), id)).ok);
  });

  it('searches notes, category and account names, treating wildcards literally', async () => {
    const cash = await wallet(0, 'Cash');
    const bank = await wallet(0, 'Bank');
    const food = await mustSave(
      f.expenseCategories.save({ id: null, name: 'Groceries', color: '#0f0' }),
    );
    await mustSave(f.transactions.save(transactionDraft(cash, { note: 'Pizza night' }), null));
    await mustSave(f.transactions.save(transactionDraft(bank, { note: '50% off sale' }), null));
    await mustSave(
      f.transactions.save(transactionDraft(bank, { categoryId: food.id, note: 'x' }), null),
    );
    await mustSave(
      f.transactions.save(transactionDraft(cash, { type: 'transfer', toAccountId: bank }), null),
    );
    const search = async (text: string) =>
      (await f.transactions.list({ ...DEFAULT_FILTER, search: text }, DEFAULT_SORT, 50)).length;

    assert.equal(await search('pizza'), 1);
    assert.equal(await search('GROCER'), 1);
    assert.equal(await search('bank'), 3, 'matches the account and the transfer destination');
    assert.equal(await search('50%'), 1);
    assert.equal(await search('%'), 1, 'a lone % is not a wildcard');
    assert.equal(await search('_'), 0);
    assert.equal(await search('nothing'), 0);
  });

  it('filters by type, account, category and date range', async () => {
    const a = await wallet(0, 'A');
    const b = await wallet(0, 'B');
    const cat = await mustSave(f.expenseCategories.save({ id: null, name: 'Food', color: '#0f0' }));
    const add = (overrides: Parameters<typeof transactionDraft>[1], account = a) =>
      mustSave(f.transactions.save(transactionDraft(account, overrides), null));
    await add({ occurredAt: at(2026, 10, 15, 8), categoryId: cat.id }); // today
    await add({ occurredAt: at(2026, 10, 12, 0, 0) }); // Monday of this week
    await add({ occurredAt: at(2026, 10, 11, 23, 59) }); // Sunday before
    await add({ occurredAt: at(2026, 9, 30, 23, 59) }); // last month
    await add({ occurredAt: at(2025, 12, 31) }); // last year
    await add({ type: 'income', occurredAt: at(2026, 10, 3) }, b);
    await add({ type: 'transfer', toAccountId: b, occurredAt: at(2026, 10, 2) });

    const count = async (changes: Partial<typeof DEFAULT_FILTER>) =>
      (await f.transactions.list({ ...DEFAULT_FILTER, ...changes }, DEFAULT_SORT, 50)).length;

    assert.equal(await count({}), 7);
    assert.equal(await count({ range: 'today' }), 1);
    assert.equal(await count({ range: 'week' }), 2);
    assert.equal(await count({ range: 'month' }), 5);
    assert.equal(await count({ range: 'lastMonth' }), 1);
    assert.equal(await count({ range: 'year' }), 6);
    assert.equal(await count({ types: ['income'] }), 1);
    assert.equal(await count({ types: ['income', 'transfer'] }), 2);
    assert.equal(await count({ accountId: b }), 2, 'income on B plus the transfer into B');
    assert.equal(await count({ accountId: a }), 6, 'everything from A, including the transfer out');
    assert.equal(await count({ categoryId: cat.id }), 1);
    assert.equal(
      await count({ categoryId: NO_CATEGORY }),
      5,
      'transfers have no category to be missing',
    );
    assert.equal(await count({ accountId: a, types: ['expense'], range: 'month' }), 3);
  });

  it('sorts by date or amount in either direction with stable ties', async () => {
    const a = await wallet();
    const add = (amountMinor: number, occurredAt: number) =>
      mustSave(f.transactions.save(transactionDraft(a, { amountMinor, occurredAt }), null));
    await add(300, at(2026, 10, 1));
    await add(100, at(2026, 10, 3));
    await add(200, at(2026, 10, 2));
    await add(200, at(2026, 10, 2)); // identical to the one before
    const amounts = async (field: 'date' | 'amount', direction: 'asc' | 'desc') =>
      (await f.transactions.list(DEFAULT_FILTER, { field, direction }, 10)).map(
        (t) => t.amountMinor,
      );

    assert.deepEqual(await amounts('date', 'desc'), [100, 200, 200, 300]);
    assert.deepEqual(await amounts('date', 'asc'), [300, 200, 200, 100]);
    assert.deepEqual(await amounts('amount', 'desc'), [300, 200, 200, 100]);
    assert.deepEqual(await amounts('amount', 'asc'), [100, 200, 200, 300]);
    assert.equal((await f.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 2)).length, 2);
  });

  it('totals income and expenses for the month, ignoring transfers', async () => {
    const a = await wallet();
    const b = await wallet(0, 'B');
    const add = (overrides: Parameters<typeof transactionDraft>[1]) =>
      mustSave(f.transactions.save(transactionDraft(a, overrides), null));
    await add({ type: 'income', amountMinor: 9_000, occurredAt: at(2026, 10, 1) });
    await add({ amountMinor: 2_500, occurredAt: at(2026, 10, 14) });
    await add({
      type: 'transfer',
      toAccountId: b,
      amountMinor: 4_000,
      occurredAt: at(2026, 10, 14),
    });
    await add({ amountMinor: 700, occurredAt: at(2026, 9, 30) });
    assert.deepEqual(await f.transactions.monthFlow(), { incomeMinor: 9_000, expenseMinor: 2_500 });
  });

  it('deletes and restores a transaction with balances following', async () => {
    const a = await wallet(1_000);
    const { id } = await mustSave(
      f.transactions.save(transactionDraft(a, { amountMinor: 400 }), null),
    );
    assert.equal((await balances()).Wallet, 600);
    const record = await f.transactions.remove(id);
    assert.equal((await balances()).Wallet, 1_000);
    await f.transactions.restore(record);
    assert.equal((await balances()).Wallet, 600);
    assert.deepEqual(await f.transactions.get(id), record);
    await assert.rejects(f.transactions.remove('ghost'));
  });

  it('keeps transactions when their category is deleted', async () => {
    const a = await wallet();
    const cat = await mustSave(f.expenseCategories.save({ id: null, name: 'Food', color: '#0f0' }));
    await mustSave(f.transactions.save(transactionDraft(a, { categoryId: cat.id }), null));
    await f.expenseCategories.delete(cat.id);
    const [row] = await f.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 10);
    assert.equal(row?.category, null);
  });

  it('keeps income and expense categories separate', async () => {
    await mustSave(f.expenseCategories.save({ id: null, name: 'Gifts', color: '#0f0' }));
    await mustSave(f.incomeCategories.save({ id: null, name: 'Gifts', color: '#00f' }));
    assert.equal((await f.expenseCategories.list()).length, 1);
    assert.equal((await f.incomeCategories.list()).length, 1);
  });
});

const budgetDraft = (overrides: Partial<BudgetDraft> = {}): BudgetDraft => ({
  name: 'Monthly',
  period: 'monthly',
  amountMinor: 10_000,
  startDate: null,
  endDate: null,
  categoryIds: [],
  ...overrides,
});

describe('budgets', () => {
  async function spend(
    account: string,
    amountMinor: number,
    occurredAt: number,
    categoryId: string | null = null,
    type: 'expense' | 'income' = 'expense',
  ) {
    return mustSave(
      f.transactions.save(
        transactionDraft(account, { amountMinor, occurredAt, categoryId, type }),
        null,
      ),
    );
  }

  it('tracks spending against a monthly budget and flags warning and overspending', async () => {
    const a = await wallet();
    const { id } = await mustSave(f.budgets.save(budgetDraft(), null));
    const progress = async () => (await f.budgets.list()).find((p) => p.budget.id === id)!;

    let p = await progress();
    assert.deepEqual(
      [p.spentMinor, p.remainingMinor, p.fraction, p.state, p.phase],
      [0, 10_000, 0, 'ok', 'active'],
    );
    assert.deepEqual([p.from, p.to], ['2026-10-01', '2026-10-31']);

    await spend(a, 7_999, at(2026, 10, 5));
    assert.equal((await progress()).state, 'ok');
    await spend(a, 1, at(2026, 10, 6)); // exactly 80%
    p = await progress();
    assert.equal(p.state, 'warning');
    assert.equal(p.fraction, 0.8);

    await spend(a, 2_000, at(2026, 10, 7)); // exactly the limit
    p = await progress();
    assert.deepEqual([p.spentMinor, p.remainingMinor, p.state], [10_000, 0, 'warning']);

    await spend(a, 1, at(2026, 10, 8));
    p = await progress();
    assert.deepEqual([p.remainingMinor, p.state], [-1, 'over']);
  });

  it('only counts expenses in the period, ignoring income, transfers and other months', async () => {
    const a = await wallet();
    const b = await wallet(0, 'B');
    const { id } = await mustSave(f.budgets.save(budgetDraft(), null));
    await spend(a, 1_000, at(2026, 10, 1, 0, 0));
    await spend(a, 1_000, at(2026, 10, 31, 23, 59));
    await spend(a, 5_000, at(2026, 9, 30, 23, 59));
    await spend(a, 5_000, at(2026, 11, 1, 0, 0));
    await spend(a, 5_000, at(2026, 10, 10), null, 'income');
    await mustSave(
      f.transactions.save(
        transactionDraft(a, { type: 'transfer', toAccountId: b, occurredAt: at(2026, 10, 10) }),
        null,
      ),
    );
    const p = (await f.budgets.list()).find((x) => x.budget.id === id)!;
    assert.equal(p.spentMinor, 2_000);
  });

  it('limits a budget to its categories', async () => {
    const a = await wallet();
    const food = await mustSave(
      f.expenseCategories.save({ id: null, name: 'Food', color: '#0f0' }),
    );
    const fun = await mustSave(f.expenseCategories.save({ id: null, name: 'Fun', color: '#00f' }));
    const { id } = await mustSave(f.budgets.save(budgetDraft({ categoryIds: [food.id] }), null));
    await spend(a, 3_000, at(2026, 10, 5), food.id);
    await spend(a, 4_000, at(2026, 10, 5), fun.id);
    await spend(a, 5_000, at(2026, 10, 5), null);
    const p = (await f.budgets.list()).find((x) => x.budget.id === id)!;
    assert.equal(p.spentMinor, 3_000);
    assert.deepEqual(
      p.categories.map((c) => c.name),
      ['Food'],
    );

    await f.expenseCategories.delete(food.id);
    assert.deepEqual(
      (await f.budgets.get(id))?.categoryIds,
      [],
      'deleting a category frees the budget',
    );
  });

  it('runs weekly budgets from Monday to Sunday', async () => {
    const a = await wallet();
    const { id } = await mustSave(
      f.budgets.save(budgetDraft({ name: 'Weekly', period: 'weekly' }), null),
    );
    await spend(a, 100, at(2026, 10, 11, 23, 59)); // Sunday before
    await spend(a, 200, at(2026, 10, 12, 0, 0)); // Monday
    await spend(a, 400, at(2026, 10, 18, 23, 59)); // Sunday
    await spend(a, 800, at(2026, 10, 19, 0, 0)); // next Monday
    const p = (await f.budgets.list()).find((x) => x.budget.id === id)!;
    assert.deepEqual([p.from, p.to, p.spentMinor], ['2026-10-12', '2026-10-18', 600]);
  });

  it('covers custom budgets inclusively and reports upcoming and ended phases', async () => {
    const a = await wallet();
    const active = await mustSave(
      f.budgets.save(
        budgetDraft({
          name: 'Trip',
          period: 'custom',
          startDate: '2026-10-10',
          endDate: '2026-10-20',
        }),
        null,
      ),
    );
    const upcoming = await mustSave(
      f.budgets.save(
        budgetDraft({
          name: 'Later',
          period: 'custom',
          startDate: '2026-11-01',
          endDate: '2026-11-05',
        }),
        null,
      ),
    );
    const ended = await mustSave(
      f.budgets.save(
        budgetDraft({
          name: 'Past',
          period: 'custom',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
        }),
        null,
      ),
    );
    await spend(a, 100, at(2026, 10, 10, 0, 0));
    await spend(a, 200, at(2026, 10, 20, 23, 59));
    await spend(a, 400, at(2026, 10, 21, 0, 0));
    await spend(a, 800, at(2026, 9, 2, 12));

    const list = await f.budgets.list();
    const get = (id: string) => list.find((x) => x.budget.id === id)!;
    assert.deepEqual([get(active.id).spentMinor, get(active.id).phase], [300, 'active']);
    assert.deepEqual([get(upcoming.id).spentMinor, get(upcoming.id).phase], [0, 'upcoming']);
    assert.deepEqual([get(ended.id).spentMinor, get(ended.id).phase], [800, 'ended']);
    assert.deepEqual(
      list.map((x) => x.phase),
      ['active', 'upcoming', 'ended'],
      'current budgets come first',
    );
  });

  it('puts overspent budgets before healthy ones', async () => {
    const a = await wallet();
    await mustSave(f.budgets.save(budgetDraft({ name: 'A fine', amountMinor: 100_000 }), null));
    await mustSave(f.budgets.save(budgetDraft({ name: 'B over', amountMinor: 100 }), null));
    await spend(a, 500, at(2026, 10, 5));
    assert.deepEqual(
      (await f.budgets.list()).map((x) => x.budget.name),
      ['B over', 'A fine'],
    );
  });

  it('validates budgets and rejects duplicate names', async () => {
    await mustSave(f.budgets.save(budgetDraft(), null));
    assert.deepEqual(await f.budgets.save(budgetDraft({ name: 'monthly' }), null), {
      ok: false,
      errors: { name: 'This name is already in use' },
    });
    const bad = await f.budgets.save(budgetDraft({ name: '', amountMinor: 0 }), null);
    assert.deepEqual(bad, {
      ok: false,
      errors: { name: 'Enter a name', amount: 'Enter an amount greater than zero' },
    });
    const noDates = await f.budgets.save(budgetDraft({ name: 'C', period: 'custom' }), null);
    assert.equal(noDates.ok, false);
    const reversed = await f.budgets.save(
      budgetDraft({ name: 'D', period: 'custom', startDate: '2026-02-01', endDate: '2026-01-01' }),
      null,
    );
    assert.equal(reversed.ok, false);
  });

  it('edits, deletes and restores budgets', async () => {
    const food = await mustSave(
      f.expenseCategories.save({ id: null, name: 'Food', color: '#0f0' }),
    );
    const { id } = await mustSave(f.budgets.save(budgetDraft({ categoryIds: [food.id] }), null));
    await mustSave(
      f.budgets.save(budgetDraft({ name: 'Renamed', amountMinor: 500, categoryIds: [] }), id),
    );
    const edited = await f.budgets.get(id);
    assert.deepEqual(
      [edited?.name, edited?.amountMinor, edited?.categoryIds],
      ['Renamed', 500, []],
    );

    const removed = await f.budgets.remove(id);
    assert.equal(await f.budgets.get(id), null);
    await f.budgets.restore({ ...removed, categoryIds: [food.id] });
    assert.deepEqual((await f.budgets.get(id))?.categoryIds, [food.id]);
    await assert.rejects(f.budgets.remove('ghost'));
    await assert.rejects(f.budgets.save(budgetDraft(), 'ghost'));
  });

  it('reports the budgets an expense pushes over, for the period of its own date', async () => {
    const a = await wallet();
    const food = await mustSave(
      f.expenseCategories.save({ id: null, name: 'Food', color: '#0f0' }),
    );
    await mustSave(
      f.budgets.save(
        budgetDraft({ name: 'Food', amountMinor: 1_000, categoryIds: [food.id] }),
        null,
      ),
    );
    await mustSave(f.budgets.save(budgetDraft({ name: 'Everything', amountMinor: 1_500 }), null));

    const within = await mustSave(
      f.transactions.save(
        transactionDraft(a, {
          amountMinor: 1_000,
          categoryId: food.id,
          occurredAt: at(2026, 10, 2),
        }),
        null,
      ),
    );
    assert.deepEqual(within.overBudgets, [], 'exactly at the limit is not over');

    const over = await mustSave(
      f.transactions.save(
        transactionDraft(a, { amountMinor: 600, categoryId: food.id, occurredAt: at(2026, 10, 3) }),
        null,
      ),
    );
    assert.deepEqual(over.overBudgets, [
      { name: 'Food', overByMinor: 600 },
      { name: 'Everything', overByMinor: 100 },
    ]);

    const other = await mustSave(
      f.transactions.save(
        transactionDraft(a, { amountMinor: 50, occurredAt: at(2026, 10, 3) }),
        null,
      ),
    );
    assert.deepEqual(
      other.overBudgets,
      [{ name: 'Everything', overByMinor: 150 }],
      'the food budget does not cover it',
    );

    const lastMonth = await mustSave(
      f.transactions.save(
        transactionDraft(a, { amountMinor: 50, occurredAt: at(2026, 9, 3) }),
        null,
      ),
    );
    assert.deepEqual(lastMonth.overBudgets, [], 'September was fine');

    const income = await mustSave(
      f.transactions.save(transactionDraft(a, { type: 'income', amountMinor: 99_999 }), null),
    );
    assert.deepEqual(income.overBudgets, []);
  });
});

function recurringDraft(
  accountId: string,
  overrides: Partial<RecurringDraft> = {},
): RecurringDraft {
  return {
    type: 'expense',
    amountMinor: 900,
    accountId,
    toAccountId: null,
    categoryId: null,
    note: 'Rent',
    rule: { unit: 'month', interval: 1, weekdays: 0 },
    startDate: '2026-10-15',
    endDate: null,
    ...overrides,
  };
}

describe('recurring transactions', () => {
  const posted = async () =>
    (await f.transactions.list(DEFAULT_FILTER, { field: 'date', direction: 'asc' }, 2_000)).map(
      (t) => new Date(t.occurredAt).toLocaleDateString('en-CA'),
    );

  it('posts today’s occurrence right away and stamps it at 9:00', async () => {
    const a = await wallet();
    const saved = await mustSave(f.recurring.save(recurringDraft(a), null));
    assert.equal(saved.posted, 1);
    const [row] = await f.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 5);
    assert.equal(row?.occurredAt, at(2026, 10, 15, 9));
    assert.equal(row?.recurringId, saved.id);
    assert.equal(row?.note, 'Rent');
    assert.equal((await f.recurring.get(saved.id))?.nextDate, '2026-11-15');
  });

  it('back-posts missed occurrences once, anchored to the start day (a 31st never drifts)', async () => {
    const a = await wallet();
    const { id } = await mustSave(
      f.recurring.save(recurringDraft(a, { startDate: '2026-07-31' }), null),
    );
    assert.deepEqual(await posted(), ['2026-07-31', '2026-08-31', '2026-09-30']);
    assert.equal((await f.recurring.get(id))?.nextDate, '2026-10-31');

    assert.equal(await f.recurring.postDue(), 0, 'running again posts nothing');
    f.state.now = at(2026, 10, 31, 8);
    assert.equal(await f.recurring.postDue(), 1);
    f.state.now = at(2026, 12, 1);
    assert.equal(await f.recurring.postDue(), 1);
    assert.deepEqual((await posted()).slice(-2), ['2026-10-31', '2026-11-30']);
  });

  it('never brings back a posted transaction the user deleted', async () => {
    const a = await wallet();
    const { id } = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          startDate: '2026-10-13',
          rule: { unit: 'day', interval: 1, weekdays: 0 },
        }),
        null,
      ),
    );
    const [first] = await f.transactions.list(
      DEFAULT_FILTER,
      { field: 'date', direction: 'asc' },
      10,
    );
    await f.transactions.remove(first!.id);
    assert.equal(await f.recurring.postDue(), 0);
    assert.deepEqual(await posted(), ['2026-10-14', '2026-10-15']);
    assert.equal((await f.recurring.get(id))?.nextDate, '2026-10-16');
  });

  it('supports daily, custom-interval and weekday schedules', async () => {
    const a = await wallet();
    await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          note: 'daily',
          startDate: '2026-10-12',
          rule: { unit: 'day', interval: 1, weekdays: 0 },
        }),
        null,
      ),
    );
    const every3 = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          note: 'every3',
          startDate: '2026-10-01',
          rule: { unit: 'day', interval: 3, weekdays: 0 },
        }),
        null,
      ),
    );
    const notes = async (note: string) =>
      (
        await f.transactions.list(
          { ...DEFAULT_FILTER, search: note },
          { field: 'date', direction: 'asc' },
          50,
        )
      ).map((t) => new Date(t.occurredAt).toLocaleDateString('en-CA'));
    assert.equal((await notes('daily')).length, 4);
    assert.deepEqual(await notes('every3'), [
      '2026-10-01',
      '2026-10-04',
      '2026-10-07',
      '2026-10-10',
      '2026-10-13',
    ]);
    assert.equal((await f.recurring.get(every3.id))?.nextDate, '2026-10-16');

    const mwf = weekdayBit(1) | weekdayBit(3) | weekdayBit(5);
    await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          note: 'gym',
          startDate: '2026-10-05',
          rule: { unit: 'week', interval: 1, weekdays: mwf },
        }),
        null,
      ),
    );
    assert.deepEqual(await notes('gym'), [
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
      '2026-10-14',
    ]);
  });

  it('moves a start date that is not on a selected weekday forward to one that is', async () => {
    const a = await wallet();
    const tuesdays = weekdayBit(2);
    const { id } = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          startDate: '2026-10-14',
          rule: { unit: 'week', interval: 1, weekdays: tuesdays },
        }),
        null,
      ),
    );
    assert.equal((await f.recurring.get(id))?.startDate, '2026-10-20');
    assert.deepEqual(await posted(), []);
  });

  it('supports weekly and yearly rules, including leap days', async () => {
    const a = await wallet();
    await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          note: 'weekly',
          startDate: '2026-09-24',
          rule: { unit: 'week', interval: 1, weekdays: 0 },
        }),
        null,
      ),
    );
    const leap = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          note: 'yearly',
          startDate: '2024-02-29',
          rule: { unit: 'year', interval: 1, weekdays: 0 },
        }),
        null,
      ),
    );
    const dates = async (note: string) =>
      (
        await f.transactions.list(
          { ...DEFAULT_FILTER, search: note },
          { field: 'date', direction: 'asc' },
          50,
        )
      ).map((t) => new Date(t.occurredAt).toLocaleDateString('en-CA'));
    assert.deepEqual(await dates('weekly'), [
      '2026-09-24',
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
    ]);
    assert.deepEqual(await dates('yearly'), ['2024-02-29', '2025-02-28', '2026-02-28']);
    assert.equal((await f.recurring.get(leap.id))?.nextDate, '2027-02-28');
  });

  it('stops at the end date and reports the series as finished', async () => {
    const a = await wallet();
    const { id } = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          startDate: '2026-10-13',
          endDate: '2026-10-14',
          rule: { unit: 'day', interval: 1, weekdays: 0 },
        }),
        null,
      ),
    );
    assert.deepEqual(await posted(), ['2026-10-13', '2026-10-14']);
    assert.equal((await f.recurring.get(id))?.nextDate, null);
    f.state.now = at(2026, 11, 20);
    assert.equal(await f.recurring.postDue(), 0);
    const [listed] = await f.recurring.list();
    assert.equal(listed?.nextDate, null);
  });

  it('does not post while paused and resumes from today without back-posting', async () => {
    const a = await wallet();
    const { id } = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          startDate: '2026-10-15',
          rule: { unit: 'day', interval: 1, weekdays: 0 },
        }),
        null,
      ),
    );
    await f.recurring.setPaused(id, true);
    f.state.now = at(2026, 10, 20);
    assert.equal(await f.recurring.postDue(), 0);
    assert.equal((await f.recurring.list())[0]?.paused, true);

    await f.recurring.setPaused(id, false);
    assert.equal((await f.recurring.get(id))?.nextDate, '2026-10-20');
    assert.equal(await f.recurring.postDue(), 1);
    assert.deepEqual(await posted(), ['2026-10-15', '2026-10-20']);
    await f.recurring.setPaused(id, false); // already running: no change
    await f.recurring.setPaused('ghost', true);
  });

  it('keeps its place when only the amount changes, and restarts from today when the schedule does', async () => {
    const a = await wallet();
    const { id } = await mustSave(
      f.recurring.save(recurringDraft(a, { startDate: '2026-09-15' }), null),
    );
    assert.equal((await posted()).length, 2);

    const edit = await mustSave(
      f.recurring.save(recurringDraft(a, { startDate: '2026-09-15', amountMinor: 1_200 }), id),
    );
    assert.equal(edit.posted, 0);
    assert.equal((await f.recurring.get(id))?.amountMinor, 1_200);
    assert.equal((await f.recurring.get(id))?.nextDate, '2026-11-15');

    f.state.now = at(2026, 11, 15);
    await f.recurring.postDue();
    const newest = (await f.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 1))[0];
    assert.equal(newest?.amountMinor, 1_200, 'later postings use the new amount');
    assert.equal(
      (await f.transactions.list(DEFAULT_FILTER, { field: 'date', direction: 'asc' }, 1))[0]
        ?.amountMinor,
      900,
    );

    const changed = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          startDate: '2026-09-15',
          rule: { unit: 'week', interval: 2, weekdays: 0 },
        }),
        id,
      ),
    );
    assert.equal(
      changed.posted,
      0,
      'fortnightly from the original start next falls on 24 November',
    );
    assert.equal((await f.recurring.get(id))?.nextDate, '2026-11-24');
    await assert.rejects(f.recurring.save(recurringDraft(a), 'ghost'));
  });

  it('posts transfers, which move money between accounts', async () => {
    const a = await wallet(10_000, 'A');
    const b = await wallet(0, 'B');
    await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          type: 'transfer',
          toAccountId: b,
          amountMinor: 2_500,
          categoryId: null,
        }),
        null,
      ),
    );
    assert.deepEqual(await balances(), { A: 7_500, B: 2_500 });
  });

  it('deleting a rule keeps what it posted, and undo brings the rule back in place', async () => {
    const a = await wallet();
    const { id } = await mustSave(f.recurring.save(recurringDraft(a), null));
    const record = await f.recurring.remove(id);
    assert.equal((await f.recurring.list()).length, 0);
    const [row] = await f.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 5);
    assert.equal(row?.recurringId, null);

    await f.recurring.restore(record);
    assert.equal((await f.recurring.get(id))?.nextDate, '2026-11-15');
    assert.equal(await f.recurring.postDue(), 0, 'nothing is posted twice after an undo');
    await assert.rejects(f.recurring.remove('ghost'));
  });

  it('catches up in bounded batches after a very long absence', async () => {
    const a = await wallet();
    const { id } = await mustSave(
      f.recurring.save(
        recurringDraft(a, {
          startDate: '2024-01-01',
          rule: { unit: 'day', interval: 1, weekdays: 0 },
        }),
        null,
      ),
    );
    // The save already ran one batch.
    assert.equal((await posted()).length, 366);
    let total = 366;
    for (let run = 0; run < 5; run += 1) {
      const count = await f.recurring.postDue();
      total += count;
      if (count === 0) {
        break;
      }
    }
    assert.equal(total, 1_019, 'every day from 2024-01-01 to 2026-10-15');
    assert.equal(new Set(await posted()).size, 1_019, 'no day is posted twice');
    assert.equal((await f.recurring.get(id))?.nextDate, '2026-10-16');
  });

  it('validates rules', async () => {
    const a = await wallet();
    const b = await wallet(0, 'B');
    const attempt = (overrides: Partial<RecurringDraft>) =>
      f.recurring.save(recurringDraft(a, overrides), null);
    assert.equal((await attempt({ amountMinor: 0 })).ok, false);
    assert.equal((await attempt({ rule: { unit: 'day', interval: 0, weekdays: 0 } })).ok, false);
    assert.equal((await attempt({ rule: { unit: 'day', interval: 366, weekdays: 0 } })).ok, false);
    assert.equal((await attempt({ rule: { unit: 'week', interval: 1, weekdays: 200 } })).ok, false);
    assert.equal((await attempt({ startDate: 'tomorrow' })).ok, false);
    assert.equal((await attempt({ endDate: '2026-01-01' })).ok, false);
    assert.equal((await attempt({ type: 'transfer' })).ok, false);
    assert.equal((await attempt({ type: 'transfer', toAccountId: a })).ok, false);
    assert.equal((await attempt({ accountId: 'ghost' })).ok, false);
    assert.equal((await attempt({ note: 'x'.repeat(501) })).ok, false);
    await f.accounts.setArchived(b, true);
    assert.equal((await attempt({ accountId: b })).ok, false);
    assert.equal((await f.recurring.list()).length, 0);
  });
});

describe('statistics', () => {
  it('summarises income against expenses per month, with a running cashflow', async () => {
    const a = await wallet();
    const b = await wallet(0, 'B');
    const add = (type: 'income' | 'expense', amountMinor: number, month: number, day = 5) =>
      mustSave(
        f.transactions.save(
          transactionDraft(a, { type, amountMinor, occurredAt: at(2026, month, day) }),
          null,
        ),
      );
    await add('income', 100_000, 8);
    await add('expense', 40_000, 8);
    await add('income', 100_000, 9);
    await add('expense', 70_000, 9);
    await add('income', 50_000, 10);
    await add('expense', 80_000, 10, 31);
    await mustSave(
      f.transactions.save(
        transactionDraft(a, {
          type: 'transfer',
          toAccountId: b,
          amountMinor: 9_999,
          occurredAt: at(2026, 10, 5),
        }),
        null,
      ),
    );
    await add('expense', 111, 6); // outside a three-month window

    const stats = await f.stats.overview(3, 'expense');
    assert.deepEqual(
      stats.months.map((m) => [m.month, m.incomeMinor, m.expenseMinor]),
      [
        ['2026-08', 100_000, 40_000],
        ['2026-09', 100_000, 70_000],
        ['2026-10', 50_000, 80_000],
      ],
    );
    assert.deepEqual(
      stats.cashflow.map((c) => [c.netMinor, c.cumulativeMinor]),
      [
        [60_000, 60_000],
        [30_000, 90_000],
        [-30_000, 60_000],
      ],
    );
    assert.deepEqual(
      [stats.comparison.current.month, stats.comparison.previous.month],
      ['2026-10', '2026-09'],
    );
    const twelve = await f.stats.overview(12, 'expense');
    assert.equal(twelve.months.length, 12);
    assert.equal(twelve.months[0]?.month, '2025-11');
    assert.equal(twelve.months.find((m) => m.month === '2026-06')?.expenseMinor, 111);
  });

  it('breaks spending down by category with an Uncategorized and an Other slice', async () => {
    const a = await wallet();
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (const [index, name] of names.entries()) {
      const cat = await mustSave(
        f.expenseCategories.save({ id: null, name, color: `#00000${index}` }),
      );
      await mustSave(
        f.transactions.save(
          transactionDraft(a, {
            amountMinor: (names.length - index) * 100,
            categoryId: cat.id,
            occurredAt: at(2026, 10, 3),
          }),
          null,
        ),
      );
    }
    await mustSave(
      f.transactions.save(
        transactionDraft(a, { amountMinor: 50, occurredAt: at(2026, 10, 4) }),
        null,
      ),
    );
    await mustSave(
      f.transactions.save(
        transactionDraft(a, { type: 'income', amountMinor: 5_000, occurredAt: at(2026, 10, 4) }),
        null,
      ),
    );

    const stats = await f.stats.overview(3, 'expense');
    assert.deepEqual(
      stats.categories.map((c) => c.name),
      ['A', 'B', 'C', 'D', 'E', 'Other'],
    );
    assert.equal(
      stats.categories.at(-1)?.totalMinor,
      100 + 200 + 50,
      'F, G and Uncategorized folded together',
    );
    assert.equal(stats.categoryTotalMinor, 2_800 + 50);
    assert.ok(Math.abs(stats.categories.reduce((sum, c) => sum + c.share, 0) - 1) < 1e-9);

    const income = await f.stats.overview(3, 'income');
    assert.deepEqual(
      income.categories.map((c) => [c.name, c.totalMinor]),
      [['Uncategorized', 5_000]],
    );
  });

  it('compares this month with last month per category', async () => {
    const a = await wallet();
    const food = await mustSave(
      f.expenseCategories.save({ id: null, name: 'Food', color: '#0f0' }),
    );
    const fun = await mustSave(f.expenseCategories.save({ id: null, name: 'Fun', color: '#00f' }));
    const add = (categoryId: string | null, amountMinor: number, month: number) =>
      mustSave(
        f.transactions.save(
          transactionDraft(a, { amountMinor, categoryId, occurredAt: at(2026, month, 5) }),
          null,
        ),
      );
    await add(food.id, 3_000, 9);
    await add(food.id, 4_500, 10);
    await add(fun.id, 2_000, 9);
    await add(null, 700, 10);

    const { comparison } = await f.stats.overview(3, 'expense');
    assert.deepEqual(
      comparison.changes.map((c) => [c.name, c.previousMinor, c.currentMinor, c.deltaMinor]),
      [
        ['Fun', 2_000, 0, -2_000],
        ['Food', 3_000, 4_500, 1_500],
        ['Uncategorized', 0, 700, 700],
      ],
    );
  });

  it('returns empty statistics for an empty database', async () => {
    const stats = await f.stats.overview(6, 'expense');
    assert.equal(stats.months.length, 6);
    assert.deepEqual(stats.categories, []);
    assert.equal(stats.categoryTotalMinor, 0);
    assert.ok(stats.cashflow.every((c) => c.netMinor === 0));
  });
});

describe('currency setting', () => {
  it('defaults to USD and remembers a change', async () => {
    assert.equal(f.settings.currency(), 'USD');
    assert.deepEqual(await f.settings.setCurrency('EUR'), { ok: true });
    assert.equal(f.settings.currency(), 'EUR');
    assert.deepEqual(await f.settings.setCurrency('EUR'), { ok: true });
  });

  it('rejects unknown currencies and ignores a stored value that is no longer valid', async () => {
    assert.equal((await f.settings.setCurrency('XXX')).ok, false);
    f.storage.setString('finance.currency', 'ZZZ');
    assert.equal(f.settings.currency(), 'USD');
  });

  it('only allows changes that keep the number of decimals once accounts exist', async () => {
    assert.deepEqual(
      await f.settings.setCurrency('JPY'),
      { ok: true },
      'free to switch with no data',
    );
    assert.deepEqual(await f.settings.setCurrency('USD'), { ok: true });
    await wallet(1_000);
    assert.deepEqual(await f.settings.setCurrency('GBP'), { ok: true });
    const blocked = await f.settings.setCurrency('JPY');
    assert.equal(blocked.ok, false);
    assert.equal(f.settings.currency(), 'GBP');
  });
});

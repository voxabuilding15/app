import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { AccountsSection } from '@/features/finance/presentation/screens/AccountsSection';
import { BudgetsSection } from '@/features/finance/presentation/screens/BudgetsSection';
import { FinanceScreen } from '@/features/finance/presentation/screens/FinanceScreen';
import { RecurringSection } from '@/features/finance/presentation/screens/RecurringSection';
import { StatsSection } from '@/features/finance/presentation/screens/StatsSection';

import { addAccount, addBudget, addCategory, addRecurring, addTransaction } from './finance-seed';
import { createApp, renderWithApp, router } from './harness';

const gone = (pattern: RegExp | string) =>
  waitFor(() =>
    expect(
      typeof pattern === 'string' ? screen.queryByText(pattern) : screen.queryByLabelText(pattern),
    ).toBeNull(),
  );

describe('AccountsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds, edits and shows balances for accounts', async () => {
    const app = createApp();
    await renderWithApp(<AccountsSection onShowTransactions={jest.fn()} />, app);
    expect(await screen.findByText('No accounts yet')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Add account')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Savings jar');
    await fireEvent.press(screen.getByLabelText('Savings'));
    await fireEvent.changeText(screen.getByLabelText(/^Opening balance/), '1,250.50');
    await fireEvent.press(screen.getByLabelText('Save'));

    expect(await screen.findByLabelText(/^Savings jar, Savings, balance \$1,250\.50/)).toBeTruthy();
    expect(screen.getByLabelText(/^Total balance: \$1,250\.50/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(/^Savings jar/));
    await fireEvent.changeText(await screen.findByDisplayValue('Savings jar'), 'Rainy day');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByLabelText(/^Rainy day/)).toBeTruthy();
  });

  it('accepts a negative balance for a credit card and shows it as owed', async () => {
    const app = createApp();
    await renderWithApp(<AccountsSection onShowTransactions={jest.fn()} />, app);
    await fireEvent.press((await screen.findAllByLabelText('Add account'))[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Visa');
    await fireEvent.press(screen.getByLabelText('Credit card'));
    await fireEvent.changeText(screen.getByLabelText(/^Opening balance/), '-300');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByLabelText(/^Visa, Credit card, balance -\$300\.00/)).toBeTruthy();
  });

  it('explains problems in the account sheet', async () => {
    const app = createApp();
    await addAccount(app, 'Bank');
    await renderWithApp(<AccountsSection onShowTransactions={jest.fn()} />, app);
    await fireEvent.press((await screen.findAllByLabelText('Add account'))[0]!);

    await fireEvent.press(await screen.findByLabelText('Save'));
    expect(await screen.findByText('Enter a name')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'bank');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('This name is already in use')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Fresh');
    await fireEvent.changeText(screen.getByLabelText(/^Opening balance/), 'lots');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Enter a valid amount')).toBeTruthy();
    expect((await app.finance.accounts.list(true)).length).toBe(1);
  });

  it('archives an account and can show or restore archived ones', async () => {
    const app = createApp();
    await addAccount(app, 'Old card');
    await addAccount(app, 'Wallet');
    await renderWithApp(<AccountsSection onShowTransactions={jest.fn()} />, app);
    await screen.findByLabelText(/^Old card/);

    await fireEvent.press(screen.getAllByLabelText('Archive')[0]!);
    expect(await screen.findByText('Account archived')).toBeTruthy();
    await gone(/^Old card/);

    await fireEvent(screen.getByLabelText('Show archived accounts'), 'valueChange', true);
    const archived = await screen.findByLabelText(/^Old card.*archived$/);
    expect(archived).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Restore'));
    expect(await screen.findByText('Account restored')).toBeTruthy();
    expect((await app.finance.accounts.list()).length).toBe(2);
  });

  it('deletes an unused account with Undo, but refuses one that has transactions', async () => {
    const app = createApp();
    const used = await addAccount(app, 'Used');
    await addAccount(app, 'Spare');
    await addTransaction(app, used);
    await renderWithApp(<AccountsSection onShowTransactions={jest.fn()} />, app);
    await screen.findByLabelText(/^Spare/);

    // Rows are ordered by creation: Used first, Spare second.
    const deletes = screen.getAllByLabelText('Delete');
    await fireEvent.press(deletes[0]!);
    expect(
      await screen.findByText('This account has transactions. Archive it instead.'),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^Used/)).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Delete')[1]!);
    expect(await screen.findByText('Account deleted')).toBeTruthy();
    await gone(/^Spare/);
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByLabelText(/^Spare/)).toBeTruthy();
  });

  it('shows an account’s transactions on the activity tab', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    const cash = await addAccount(app, 'Cash');
    await addTransaction(app, bank, { note: 'In the bank' });
    await addTransaction(app, cash, { note: 'In cash' });
    await renderWithApp(<FinanceScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Accounts'));
    await screen.findByLabelText(/^Cash/);

    // The first "Activity" is the tab; then each account row's swipe action in list order.
    await fireEvent.press(screen.getAllByLabelText('Activity')[2]!);
    expect(await screen.findByLabelText(/In cash/)).toBeTruthy();
    await gone(/In the bank/);
    expect(screen.getByLabelText('Filter (1)')).toBeTruthy();
  });
});

describe('BudgetsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state with a working add action', async () => {
    await renderWithApp(<BudgetsSection />);
    expect(await screen.findByText('No budgets yet')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Add budget')[0]!);
    expect(router.push).toHaveBeenCalledWith('/finance/budget/new');
  });

  it('shows spending against the limit and what is left', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    const food = await addCategory(app, 'Food');
    await addBudget(app, { name: 'Food', amountMinor: 20_000, categoryIds: [food] });
    await addTransaction(app, bank, { amountMinor: 5_000, categoryId: food });
    await addTransaction(app, bank, { amountMinor: 9_000 });
    await renderWithApp(<BudgetsSection />, app);

    const card = await screen.findByLabelText(
      'Food, monthly budget, $50.00 of $200.00 spent, $150.00 left',
    );
    expect(card).toBeTruthy();
    expect(screen.getByText('$150.00 left')).toBeTruthy();
    expect(screen.getByLabelText('25% of the budget spent').props.accessibilityValue.now).toBe(25);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('flags overspending with a banner, an icon and the amount over', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addBudget(app, { name: 'Tight', amountMinor: 1_000 });
    await addBudget(app, { name: 'Loose', amountMinor: 900_000 });
    await addTransaction(app, bank, { amountMinor: 1_550 });
    await renderWithApp(<BudgetsSection />, app);

    expect(await screen.findByText('Over by $5.50')).toBeTruthy();
    expect(screen.getByText('1 budget is over its limit')).toBeTruthy();
    expect(
      screen.getByLabelText(/^Tight, monthly budget, \$15\.50 of \$10\.00 spent, over by \$5\.50/),
    ).toBeTruthy();
    expect(screen.getByLabelText('155% of the budget spent')).toBeTruthy();
  });

  it('opens a budget when pressed and deletes with Undo', async () => {
    const app = createApp();
    const id = await addBudget(app, { name: 'Fun' });
    await renderWithApp(<BudgetsSection />, app);
    await fireEvent.press(await screen.findByLabelText(/^Fun, monthly budget/));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/finance/budget/[id]', params: { id } });

    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(await screen.findByText('Budget deleted')).toBeTruthy();
    await gone(/^Fun/);
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByLabelText(/^Fun, monthly budget/)).toBeTruthy();
  });

  it('labels weekly, custom and upcoming budgets', async () => {
    const app = createApp();
    await addBudget(app, { name: 'Week', period: 'weekly' });
    await addBudget(app, {
      name: 'Trip',
      period: 'custom',
      startDate: '2099-05-01',
      endDate: '2099-05-09',
    });
    await renderWithApp(<BudgetsSection />, app);
    expect(await screen.findByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Custom · Not started')).toBeTruthy();
  });
});

describe('RecurringSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state with a working add action', async () => {
    await renderWithApp(<RecurringSection />);
    expect(await screen.findByText('Nothing recurring yet')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Add recurring transaction')[0]!);
    expect(router.push).toHaveBeenCalledWith('/finance/recurring/new');
  });

  it('describes each rule and its next date', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addRecurring(app, bank, { note: 'Rent', amountMinor: 120_000 });
    await addRecurring(app, bank, {
      type: 'income',
      note: 'Salary',
      amountMinor: 300_000,
      rule: { unit: 'week', interval: 2, weekdays: 0 },
    });
    await renderWithApp(<RecurringSection />, app);

    expect(await screen.findByText('-$1,200.00')).toBeTruthy();
    expect(screen.getByText('+$3,000.00')).toBeTruthy();
    expect(
      screen.getByLabelText(/^Expense \$1,200\.00, Rent, Bank, Monthly · next .*2099/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Every 2 weeks · next .*2099/)).toBeTruthy();
  });

  it('pauses and resumes a rule', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addRecurring(app, bank);
    await renderWithApp(<RecurringSection />, app);
    await screen.findByLabelText(/^Expense/);

    await fireEvent.press(screen.getByLabelText('Pause'));
    expect(await screen.findByText('Paused')).toBeTruthy();
    expect(await screen.findByLabelText(/Monthly · paused$/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Resume'));
    expect(await screen.findByText('Resumed')).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText(/paused/)).toBeNull());
  });

  it('opens a rule when pressed and deletes with Undo', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    const id = await addRecurring(app, bank);
    await renderWithApp(<RecurringSection />, app);
    await fireEvent.press(await screen.findByLabelText(/^Expense/));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/finance/recurring/[id]',
      params: { id },
    });
    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(await screen.findByText('Recurring transaction deleted')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByLabelText(/^Expense/)).toBeTruthy();
  });
});

describe('StatsSection', () => {
  it('shows empty statistics without crashing', async () => {
    await renderWithApp(<StatsSection />);
    expect(await screen.findByText('Income vs expenses')).toBeTruthy();
    expect(screen.getByText('Cashflow')).toBeTruthy();
    expect(screen.getByText('No spending in this period.')).toBeTruthy();
    expect(screen.getByText('No change in spending between these months.')).toBeTruthy();
  });

  it('charts income against expenses, categories, the month comparison and cashflow', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    const food = await addCategory(app, 'Food', 'expense', '#EA580C');
    const rent = await addCategory(app, 'Rent', 'expense', '#2563EB');
    await addCategory(app, 'Pay', 'income');
    const now = Date.now();
    const lastMonth = new Date(now);
    lastMonth.setDate(1);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await addTransaction(app, bank, { type: 'income', amountMinor: 200_000, occurredAt: now });
    await addTransaction(app, bank, { amountMinor: 30_000, categoryId: food, occurredAt: now });
    await addTransaction(app, bank, { amountMinor: 80_000, categoryId: rent, occurredAt: now });
    await addTransaction(app, bank, {
      amountMinor: 50_000,
      categoryId: food,
      occurredAt: lastMonth.getTime(),
    });
    await renderWithApp(<StatsSection />, app);

    expect(await screen.findByLabelText(/^Income and expenses for the last 6 months/)).toBeTruthy();
    expect(screen.getByLabelText('Total income $2,000.00')).toBeTruthy();
    expect(screen.getByLabelText('Total expenses $1,600.00')).toBeTruthy();
    expect(screen.getByLabelText(/^Net cashflow for the last 6 months/)).toBeTruthy();
    expect(screen.getByLabelText('Net over the period +$400.00')).toBeTruthy();
    expect(screen.getByLabelText('Food, $800.00, 50%')).toBeTruthy();
    expect(screen.getByLabelText('Rent, $800.00, 50%')).toBeTruthy();
    expect(screen.getByLabelText(/^Spending by category: /)).toBeTruthy();
    // Food fell from $500 to $300 and rent rose from nothing to $800.
    expect(screen.getByLabelText('Rent: up $800.00')).toBeTruthy();
    expect(screen.getByLabelText('Food: down $200.00')).toBeTruthy();
    expect(
      screen.getByLabelText(/^Expenses: \$1,100\.00 this month, \$500\.00 last month, \+120%/),
    ).toBeTruthy();
  });

  it('switches the period and the breakdown', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addTransaction(app, bank, { type: 'income', amountMinor: 70_000 });
    await renderWithApp(<StatsSection />, app);
    await screen.findByLabelText(/^Income and expenses for the last 6 months/);

    await fireEvent.press(screen.getByLabelText('12 months'));
    expect(
      await screen.findByLabelText(/^Income and expenses for the last 12 months/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('3 months'));
    expect(await screen.findByLabelText(/^Income and expenses for the last 3 months/)).toBeTruthy();

    expect(screen.getByText('No spending in this period.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Income'));
    expect(await screen.findByLabelText('Uncategorized, $700.00, 100%')).toBeTruthy();
  });
});

describe('currency', () => {
  it('changes how amounts are shown, and protects data when decimals would change', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank', { initial: 123_456 });
    await addTransaction(app, bank, { amountMinor: 100 });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithApp(<FinanceScreen />, app);
    await screen.findByText('-$1.00');

    await fireEvent.press(screen.getByLabelText('Change currency'));
    await fireEvent.press(await screen.findByLabelText('Euro (EUR)'));
    await waitFor(() => expect(screen.getByText('-€1.00')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Japanese yen (JPY)'));
    expect(await screen.findByText(/different number of decimals/)).toBeTruthy();
    expect(app.finance.settings.currency()).toBe('EUR');
  });
});
